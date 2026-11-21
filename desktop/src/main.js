/* ZorHire desktop app (Windows).
 * One window: a tab bar (shell.html) over tabs for ZorHire, LinkedIn, Naukri and job boards,
 * plus an Assistant side panel. The LinkedIn agent, "Save to ZorHire" and job-board autofill
 * from the Chrome extension run built in (agent.js), so no extension is needed.
 * Closing the window keeps ZorHire running in the system tray for alerts and the agent.
 */
const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, session, dialog } = require("electron");
const store = require("./store");
const { Tabs } = require("./tabs");
const { Agent } = require("./agent");
const { Alerts } = require("./alerts");

const APP_URL = (process.env.ZORHIRE_APP_URL || "https://zorhire.zortechs.in").replace(/\/$/, "");
const API_URL = (process.env.ZORHIRE_API_URL || `${APP_URL}/v1`).replace(/\/$/, "");
const DEV = !app.isPackaged;
const EXT_DIR = DEV ? path.join(__dirname, "..", "..", "extension") : path.join(process.resourcesPath, "extension");

app.setAppUserModelId("in.zortechs.zorhire");
// Development self-test keeps its own profile so it never touches a real one.
if (DEV && process.env.ZORHIRE_SELFTEST) app.setPath("userData", path.join(process.env.ZORHIRE_SELFTEST, "profile"));
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
let tray = null;
let tabs = null;
let agent = null;
let alerts = null;
let quitting = false;
let unread = 0;

// A plain Chrome user agent for websites (LinkedIn and job boards treat "Electron" as an
// unsupported browser). The version tracks the Chromium inside this Electron.
const chromeUA = () => app.userAgentFallback.replace(/ Electron\/\S+/, "").replace(/ zorhire-desktop\/\S+/i, "").replace(/ ZorHire\/\S+/, "");

async function getJwt() {
  const t = tabs?.appTab();
  if (!t || t.view.webContents.isDestroyed()) return null;
  if (!t.view.webContents.getURL().startsWith(APP_URL)) return null;
  try { return await t.view.webContents.executeJavaScript('localStorage.getItem("jwt")', false); } catch { return null; }
}

function openInApp(route) {
  showWindow();
  const t = tabs.appTab();
  if (!t) return;
  tabs.activate(t.id);
  // Client-side navigation keeps the user's place and sign-in (react-router listens to popstate).
  t.view.webContents.executeJavaScript(`history.pushState({}, "", ${JSON.stringify(route)}); dispatchEvent(new PopStateEvent("popstate"));`).catch(() => {});
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function sendShell(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  const bounds = store.get({ bounds: { width: 1360, height: 860 } }).bounds;
  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "ZorHire",
    icon: path.join(__dirname, "icon128.png"),
    backgroundColor: "#1A4277",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload-shell.js"), contextIsolation: true, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "shell.html"));
  if (store.get({ maximized: false }).maximized) win.maximize();
  win.once("ready-to-show", () => { if (!process.argv.includes("--hidden")) win.show(); });

  const saveBounds = () => { if (!win.isMaximized() && !win.isMinimized()) store.set({ bounds: win.getBounds() }); store.set({ maximized: win.isMaximized() }); };
  win.on("resize", saveBounds);
  win.on("move", saveBounds);
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!store.get({ trayHintShown: false }).trayHintShown) {
      store.set({ trayHintShown: true });
      tray?.displayBalloon?.({ title: "ZorHire is still running", content: "Alerts and the LinkedIn agent keep working. Right-click the tray icon to quit.", iconType: "info" });
    }
  });

  tabs = new Tabs(win, {
    appOrigin: APP_URL,
    onChange: (state) => sendShell("tabs:state", state),
    onLoad: (tab) => agent?.onPageLoad(tab),
  });
  tabs.onCapture = (tab) => agent.capture(tab).then((r) => !r.ok && sendShell("assistant:error", r.error));

  tabs.create({ kind: "app", url: `${APP_URL}/`, title: "ZorHire", closable: false });
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "tray.png"));
  tray = new Tray(icon);
  tray.setToolTip("ZorHire");
  tray.on("click", showWindow);
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const s = agent?.publicState();
  const login = app.getLoginItemSettings();
  tray.setToolTip(unread ? `ZorHire: ${unread} unread` : "ZorHire");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open ZorHire", click: showWindow },
    { type: "separator" },
    { label: "LinkedIn agent running", type: "checkbox", checked: !!s?.running, click: (i) => { store.set({ running: i.checked }); agent.onStatus(agent.publicState()); } },
    { label: "Run the agent now", click: () => agent.tick(true) },
    { type: "separator" },
    { label: "Start with Windows", type: "checkbox", checked: login.openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked, args: ["--hidden"] }) },
    { label: "Check for updates", click: () => checkUpdates(true) },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { type: "separator" },
    { label: "Quit ZorHire", click: () => { quitting = true; app.quit(); } },
  ]));
}

function setUnread(n) {
  if (n === unread) return;
  unread = n;
  sendShell("alerts:unread", n);
  if (win && process.platform === "win32") {
    win.setOverlayIcon(n ? nativeImage.createFromPath(path.join(__dirname, "overlay.png")) : null, n ? `${n} unread` : "");
  }
  refreshTray();
}

/* ─────────────────────────────── Updates ─────────────────────────────── */

let updater = null;
function checkUpdates(manual = false) {
  if (DEV) { if (manual) dialog.showMessageBox(win, { message: "Updates are checked in the installed app only." }); return; }
  try {
    updater = updater || require("electron-updater").autoUpdater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    if (!updater.__wired) {
      updater.__wired = true;
      updater.on("update-downloaded", (info) => {
        sendShell("update:ready", info.version);
      });
      updater.on("update-not-available", () => manual && dialog.showMessageBox(win, { message: `ZorHire ${app.getVersion()} is up to date.` }));
      updater.on("error", (e) => manual && dialog.showMessageBox(win, { type: "warning", message: "Could not check for updates.", detail: String(e?.message || e) }));
    }
    updater.checkForUpdates().catch(() => {});
  } catch (e) { console.warn("updater", e); }
}

/* ─────────────────────────────── IPC ─────────────────────────────── */

function wireIpc() {
  // Shell (tab bar and Assistant panel).
  ipcMain.on("tabs:activate", (_e, id) => tabs.activate(id));
  ipcMain.on("tabs:close", (_e, id) => tabs.close(id));
  ipcMain.on("tabs:nav", (_e, id, action) => tabs.nav(id, action));
  ipcMain.on("tabs:open", (_e, which) => {
    const urls = {
      linkedin: "https://www.linkedin.com/feed/",
      recruiter: "https://www.linkedin.com/talent/home",
      naukri: "https://resdex.naukri.com/",
      naukriRecruit: "https://recruit.naukri.com/",
      zorhire: `${APP_URL}/`,
    };
    if (urls[which]) tabs.openLink(urls[which]);
  });
  ipcMain.on("tabs:menu", (_e, x, y) => {
    const open = (which) => ipcMain.emit("tabs:open", {}, which);
    Menu.buildFromTemplate([
      { label: "LinkedIn", click: () => open("linkedin") },
      { label: "LinkedIn Recruiter Lite", click: () => open("recruiter") },
      { type: "separator" },
      { label: "Naukri Resdex", click: () => open("naukri") },
      { label: "Naukri Recruit", click: () => open("naukriRecruit") },
      { type: "separator" },
      { label: "Another ZorHire tab", click: () => open("zorhire") },
    ]).popup({ window: win, x: Math.round(x), y: Math.round(y) });
  });
  ipcMain.on("panel:set", (_e, open) => tabs.setPanel(!!open));
  ipcMain.handle("shell:init", () => ({ tabs: tabs.state(), assistant: agent.publicState(), unread, version: app.getVersion() }));
  ipcMain.handle("assistant:set", (_e, patch) => {
    const allowed = {};
    if (typeof patch?.running === "boolean") allowed.running = patch.running;
    if (/^\d\d:\d\d$/.test(patch?.workStart || "")) allowed.workStart = patch.workStart;
    if (/^\d\d:\d\d$/.test(patch?.workEnd || "")) allowed.workEnd = patch.workEnd;
    store.set(allowed);
    agent.onStatus(agent.publicState());
    return agent.publicState();
  });
  ipcMain.handle("assistant:run", () => { agent.tick(true); return true; });
  ipcMain.handle("assistant:connect", async () => { await agent.disconnect(); await agent.ensureConnected(); if (agent.s().token) agent.tick(true); return agent.publicState(); });
  ipcMain.handle("assistant:disconnect", async () => { await agent.disconnect(); return agent.publicState(); });
  ipcMain.handle("assistant:capture", () => agent.capture(tabs.active()));
  ipcMain.on("update:install", () => { quitting = true; updater?.quitAndInstall(); });

  // ZorHire tab: tell the web app it runs inside the desktop app.
  ipcMain.on("app:info", (e) => { e.returnValue = { version: app.getVersion(), platform: process.platform }; });
  ipcMain.on("app:open-tool", (_e, url) => { if (typeof url === "string") tabs.openLink(url); });

  // Page scripts in web tabs (chrome.runtime.sendMessage shim in preload-tools.js).
  ipcMain.handle("zh:ext-msg", async (e, msg) => {
    const tab = tabs.byWebContents(e.sender);
    if (!tab || tab.kind === "app") return { ok: false, error: "not allowed" };
    try { return await agent.handleMessage(msg, tab); }
    catch (err) { return { ok: false, error: err.message }; }
  });
}

/* ─────────────────────────────── Start ─────────────────────────────── */

app.on("second-instance", showWindow);
app.on("before-quit", () => { quitting = true; store.flushNow(); });
app.on("window-all-closed", () => { /* stay in the tray */ });

app.whenReady().then(() => {
  store.load();
  const ua = chromeUA();
  session.fromPartition("persist:web").setUserAgent(ua);
  session.fromPartition("persist:zorhire").setUserAgent(`${ua} ZorHireDesktop/${app.getVersion()}`);
  for (const p of ["persist:web", "persist:zorhire"]) {
    // Websites may ask for notifications/clipboard; allow only harmless ones.
    session.fromPartition(p).setPermissionRequestHandler((_wc, permission, cb) => cb(["notifications", "clipboard-sanitized-write", "fullscreen"].includes(permission)));
  }

  if (!fs.existsSync(path.join(EXT_DIR, "inpage.js"))) {
    dialog.showErrorBox("ZorHire", `The assistant scripts are missing (${EXT_DIR}). Reinstall ZorHire.`);
  }

  createWindow();
  agent = new Agent({
    tabs, apiBase: API_URL, appBase: APP_URL, extDir: EXT_DIR, getJwt,
    onStatus: (state) => { sendShell("assistant:state", state); refreshTray(); },
  });
  alerts = new Alerts({ apiBase: API_URL, getJwt, onUnread: setUnread, onOpen: openInApp });
  wireIpc();
  buildTray();
  agent.start();
  alerts.start();
  if (DEV && process.env.ZORHIRE_SELFTEST) require("./selftest")({ tabs, agent, alerts, win, APP_URL, API_URL });
  setTimeout(() => checkUpdates(false), 15 * 1000);
  setInterval(() => checkUpdates(false), 6 * 60 * 60 * 1000);
});

// Anything that tries to open a new top-level window becomes a tab instead.
app.on("web-contents-created", (_e, wc) => {
  wc.on("will-attach-webview", (e) => e.preventDefault());
});

