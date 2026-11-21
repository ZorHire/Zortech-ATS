/* Tabs inside the ZorHire window. Each tab is a WebContentsView under the shell's tab bar.
 *   app    ZorHire itself (session "persist:zorhire")
 *   web    LinkedIn, Naukri, job boards and other sites (session "persist:web": the recruiter
 *          signs in once and stays signed in, like a normal browser profile)
 *   agent  the LinkedIn agent's own tab (same "persist:web" session), visible so the
 *          recruiter can watch it or answer a LinkedIn security check
 */
const path = require("path");
const { WebContentsView, Menu, clipboard, shell } = require("electron");

const TOPBAR = 44;
const PANEL = 340;
const SAFE_EXTERNAL = /^(mailto:|tel:|whatsapp:|https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/)/i;

class Tabs {
  constructor(win, { appOrigin, onChange, onLoad }) {
    this.win = win;
    this.appOrigin = appOrigin;
    this.onChange = onChange;
    this.onLoad = onLoad;
    this.tabs = new Map();
    this.order = [];
    this.activeId = null;
    this.panelOpen = false;
    this.nextId = 1;
    win.on("resize", () => this.layout());
  }

  create({ kind, url, title, closable = true, background = false, meta = {} }) {
    const isApp = kind === "app";
    const view = new WebContentsView({
      webPreferences: {
        partition: isApp ? "persist:zorhire" : "persist:web",
        preload: path.join(__dirname, isApp ? "preload-app.js" : "preload-tools.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true,
      },
    });
    view.setBackgroundColor("#ffffff");
    const id = this.nextId++;
    const tab = { id, kind, view, title: title || "Loading…", closable, meta, loading: true };
    this.tabs.set(id, tab);
    this.order.push(id);
    this.win.contentView.addChildView(view);
    view.setVisible(false);
    this.wire(tab);
    if (url) view.webContents.loadURL(url).catch(() => {});
    if (!background || !this.activeId) this.activate(id);
    else this.emit();
    return id;
  }

  wire(tab) {
    const wc = tab.view.webContents;
    const update = () => this.emit();
    wc.on("page-title-updated", (_e, t) => { tab.title = t; update(); });
    wc.on("did-start-loading", () => { tab.loading = true; update(); });
    wc.on("did-stop-loading", () => { tab.loading = false; update(); });
    wc.on("did-navigate", update);
    wc.on("did-finish-load", () => this.onLoad?.(tab, "load"));
    wc.on("did-navigate-in-page", (_e, _url, isMainFrame) => { update(); if (isMainFrame) this.onLoad?.(tab, "spa"); });
    wc.setWindowOpenHandler(({ url }) => {
      this.openLink(url, { from: tab });
      return { action: "deny" };
    });
    wc.on("will-navigate", (e, url) => {
      // Never let a dropped file or a stray link replace ZorHire itself.
      if (tab.kind === "app" && !url.startsWith(this.appOrigin)) {
        e.preventDefault();
        this.openLink(url, { from: tab });
      }
    });
    wc.on("context-menu", (_e, p) => this.contextMenu(tab, p));
    wc.on("before-input-event", (e, input) => this.shortcut(e, input, tab));
  }

  /** Where a link should open: ZorHire pages in a ZorHire tab, websites in a web tab. */
  openLink(url, { from, background = false } = {}) {
    if (SAFE_EXTERNAL.test(url)) return shell.openExternal(url);
    if (!/^https?:\/\//i.test(url)) return;
    if (url.startsWith(this.appOrigin)) {
      return this.create({ kind: "app", url, background });
    }
    return this.create({ kind: "web", url, background });
  }

  get(id) { return this.tabs.get(id); }
  byWebContents(wc) { for (const t of this.tabs.values()) if (t.view.webContents === wc) return t; return null; }
  active() { return this.tabs.get(this.activeId); }
  appTab() { for (const id of this.order) { const t = this.tabs.get(id); if (t.kind === "app") return t; } return null; }
  find(pred) { for (const id of this.order) { const t = this.tabs.get(id); if (pred(t)) return t; } return null; }

  activate(id) {
    if (!this.tabs.has(id)) return;
    this.activeId = id;
    for (const t of this.tabs.values()) t.view.setVisible(t.id === id);
    this.layout();
    this.tabs.get(id).view.webContents.focus();
    this.emit();
  }

  close(id) {
    const tab = this.tabs.get(id);
    if (!tab || !tab.closable) return;
    this.win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.delete(id);
    const idx = this.order.indexOf(id);
    this.order.splice(idx, 1);
    tab.onClosed?.();
    if (this.activeId === id) this.activate(this.order[Math.max(0, idx - 1)]);
    else this.emit();
  }

  setPanel(open) { this.panelOpen = open; this.layout(); this.emit(); }

  layout() {
    const [w, h] = this.win.getContentSize();
    const width = Math.max(200, w - (this.panelOpen ? PANEL : 0));
    for (const t of this.tabs.values()) t.view.setBounds({ x: 0, y: TOPBAR, width, height: Math.max(100, h - TOPBAR) });
  }

  state() {
    return {
      panelOpen: this.panelOpen,
      tabs: this.order.map((id) => {
        const t = this.tabs.get(id);
        const wc = t.view.webContents;
        return {
          id, kind: t.kind, title: t.title, closable: t.closable, loading: t.loading,
          active: id === this.activeId, url: wc.getURL(),
          canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(),
        };
      }),
    };
  }

  emit() { this.onChange?.(this.state()); }

  nav(id, action) {
    const t = this.tabs.get(id ?? this.activeId);
    if (!t) return;
    const wc = t.view.webContents;
    if (action === "back" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === "forward" && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === "reload") wc.reload();
    if (action === "external") shell.openExternal(wc.getURL());
  }

  shortcut(e, input, tab) {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    const wc = tab.view.webContents;
    let handled = true;
    if ((ctrl && key === "r") || key === "f5") wc.reload();
    else if (ctrl && key === "w") this.close(tab.id);
    else if (ctrl && key === "tab") {
      const i = this.order.indexOf(this.activeId);
      const n = this.order.length;
      this.activate(this.order[(i + (input.shift ? n - 1 : 1)) % n]);
    } else if (input.alt && key === "arrowleft") this.nav(tab.id, "back");
    else if (input.alt && key === "arrowright") this.nav(tab.id, "forward");
    else if (ctrl && (key === "=" || key === "+")) wc.setZoomLevel(wc.getZoomLevel() + 0.5);
    else if (ctrl && key === "-") wc.setZoomLevel(wc.getZoomLevel() - 0.5);
    else if (ctrl && key === "0") wc.setZoomLevel(0);
    else if (ctrl && input.shift && key === "i") wc.openDevTools({ mode: "detach" });
    else handled = false;
    if (handled) e.preventDefault();
  }

  contextMenu(tab, p) {
    const wc = tab.view.webContents;
    const items = [];
    if (p.linkURL) {
      items.push({ label: "Open link in new tab", click: () => this.openLink(p.linkURL, { from: tab, background: true }) });
      items.push({ label: "Open link in browser", click: () => /^https?:/.test(p.linkURL) && shell.openExternal(p.linkURL) });
      items.push({ label: "Copy link", click: () => clipboard.writeText(p.linkURL) });
      items.push({ type: "separator" });
    }
    if (p.isEditable) {
      for (const w of p.dictionarySuggestions || []) items.push({ label: w, click: () => wc.replaceMisspelling(w) });
      if (p.dictionarySuggestions?.length) items.push({ type: "separator" });
      items.push({ role: "cut", enabled: p.editFlags.canCut }, { role: "copy", enabled: p.editFlags.canCopy }, { role: "paste", enabled: p.editFlags.canPaste }, { role: "selectAll" });
    } else if (p.selectionText) {
      items.push({ role: "copy" });
    }
    if (items.length) items.push({ type: "separator" });
    items.push(
      { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => this.nav(tab.id, "back") },
      { label: "Reload", click: () => wc.reload() },
    );
    if (tab.kind !== "app") {
      items.push({ type: "separator" }, { label: "Save this page to ZorHire", click: () => this.onCapture?.(tab) });
    }
    Menu.buildFromTemplate(items).popup({ window: this.win });
  }
}

module.exports = { Tabs, TOPBAR, PANEL };
