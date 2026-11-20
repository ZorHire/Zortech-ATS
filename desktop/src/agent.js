/* The ZorHire Assistant, built into the desktop app. A port of extension/background.js:
 * the same LinkedIn agent loop, job-board autofill and "Save to ZorHire", but driving the
 * app's own tabs instead of Chrome tabs. The page-side scripts are the extension's own
 * files (inpage.js, linkedin-import.js, capture.js, autofill.js), loaded unchanged.
 *
 * Safety rails are unchanged: ZorHire's limits (per campaign/day, 40/day, 100/week),
 * randomised gaps, working hours only, and an immediate stop when LinkedIn shows a limit,
 * a security check or a "search paused" notice. No passwords are read, stored or sent.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { app, Notification } = require("electron");
const store = require("./store");

const VERSION = app.getVersion();
const DEFAULTS = {
  token: "",
  running: true,
  workStart: "09:30",
  workEnd: "19:00",
  workDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  nextInviteAt: 0,
  nextSearchAt: 0,
  lastHelloAt: 0,
  lastAcceptCheckAt: 0,
  lastPostsCheckAt: 0,
  status: { text: "Not connected", at: 0 },
  account: null,
};

const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Content scripts, matched like the extension manifest's content_scripts.
const CONTENT_SCRIPTS = [
  { file: "linkedin-import.js", guard: "__zhImport", match: [/^https:\/\/www\.linkedin\.com\/search\/results\/people\//, /^https:\/\/www\.linkedin\.com\/talent\//] },
  { file: "capture.js", guard: "__zhCapture", match: [/^https:\/\/www\.linkedin\.com\/in\//, /^https:\/\/resdex\.naukri\.com\//, /^https:\/\/recruit\.naukri\.com\//] },
];

class Agent {
  constructor({ tabs, apiBase, appBase, extDir, onStatus, getJwt }) {
    this.tabs = tabs;
    this.apiBase = apiBase.replace(/\/$/, "");
    this.appBase = appBase.replace(/\/$/, "");
    this.extDir = extDir;
    this.onStatus = onStatus;
    this.getJwt = getJwt;
    this.busy = false;
    this.scripts = {};
    for (const f of ["inpage.js", "linkedin-import.js", "capture.js", "autofill.js"]) {
      this.scripts[f] = fs.readFileSync(path.join(extDir, f), "utf8");
    }
  }

  s() { return store.get(DEFAULTS); }
  set(obj) { store.set(obj); if ("status" in obj || "account" in obj || "running" in obj || "token" in obj) this.onStatus?.(this.publicState()); }
  setStatus(text) { this.set({ status: { text, at: Date.now() } }); }

  publicState() {
    const s = this.s();
    return {
      connected: !!s.token, running: s.running, workStart: s.workStart, workEnd: s.workEnd,
      status: s.status, account: s.account, version: VERSION, apiBase: this.apiBase,
    };
  }

  start() {
    this.timer = setInterval(() => this.tick().catch((e) => console.warn("tick", e)), 30 * 1000);
    setTimeout(() => this.tick().catch(() => {}), 8000);
  }

  stop() { clearInterval(this.timer); }

  /* ─────────────────────────────── ZorHire API ─────────────────────────────── */

  async api(p, { method = "GET", body } = {}) {
    const { token } = this.s();
    if (!token) throw Object.assign(new Error("Not connected to ZorHire"), { code: "no_token" });
    const res = await fetch(this.apiBase + p, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      this.set({ token: "" });
      this.setStatus("Disconnected: reconnecting with your ZorHire sign-in");
      throw Object.assign(new Error("Unauthorised"), { code: "unauthorised" });
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `ZorHire error ${res.status}`);
    return data;
  }

  /**
   * Connect automatically: the recruiter is already signed in to ZorHire in the app tab, so
   * ask ZorHire for this PC's own connection code with that sign-in (no copy-paste needed).
   */
  async ensureConnected() {
    if (this.s().token) return true;
    const jwt = await this.getJwt();
    if (!jwt) { this.setStatus("Sign in to ZorHire to start the assistant"); return false; }
    const res = await fetch(`${this.apiBase}/linkedin-agent/connect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label: `Desktop app (${os.hostname()})`.slice(0, 60) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.code) {
      this.setStatus(data.message ? `Could not connect: ${data.message}` : "Could not connect to ZorHire");
      return false;
    }
    this.set({ token: data.code, lastHelloAt: 0 });
    this.setStatus("Connected to ZorHire");
    return true;
  }

  async disconnect() {
    this.set({ token: "", account: null });
    this.setStatus("Not connected");
  }

  /* ─────────────────────────────── Agent tab ─────────────────────────────── */

  async agentTab(url) {
    let tab = this.tabs.find((t) => t.kind === "agent");
    if (!tab) {
      const id = this.tabs.create({ kind: "agent", url: url ?? "https://www.linkedin.com/feed/", title: "LinkedIn agent", closable: false, background: true });
      tab = this.tabs.get(id);
      await this.waitForLoad(tab);
    } else if (url) {
      await tab.view.webContents.loadURL(url).catch(() => {});
    } else if (tab.view.webContents.isLoading()) {
      await this.waitForLoad(tab);
    }
    await sleep(rand(2500, 4000));
    return tab;
  }

  waitForLoad(tab, timeout = 30000) {
    const wc = tab.view.webContents;
    return new Promise((resolve) => {
      if (!wc.isLoading() && wc.getURL()) return resolve();
      const done = () => { wc.removeListener("did-stop-loading", done); clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, timeout);
      wc.on("did-stop-loading", done);
    });
  }

  /** Run one of inpage.js's functions in the tab, in the isolated world (like chrome.scripting). */
  runInTab(tab, fnName, args = []) {
    const code = `${this.scripts["inpage.js"]}\n;(${fnName})(...${JSON.stringify(args)})`;
    return tab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code }], true);
  }

  injectFile(tab, file, guard) {
    const src = this.scripts[file];
    const code = guard ? `if (!window.${guard}) {\n${src}\n}` : src;
    return tab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code }]).catch((e) => console.warn("inject", file, e.message));
  }

  /** Called by the tab manager on every page load or in-page navigation. */
  onPageLoad(tab) {
    if (tab.kind === "app") return;
    const url = tab.view.webContents.getURL();
    for (const cs of CONTENT_SCRIPTS) {
      if (cs.match.some((re) => re.test(url))) this.injectFile(tab, cs.file, cs.guard);
    }
    if (tab.meta.post) {
      this.injectFile(tab, "autofill.js").then(() =>
        tab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `window.__zhShowPanel && window.__zhShowPanel(${JSON.stringify(tab.meta.post)})` }]).catch(() => {}),
      );
    }
  }

  /* ─────────────────────────────── Scheduling ─────────────────────────────── */

  inWorkingHours(s) {
    const now = new Date();
    if (!s.workDays.includes(now.getDay())) return false;
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.workStart.split(":").map(Number);
    const [eh, em] = s.workEnd.split(":").map(Number);
    return mins >= sh * 60 + sm && mins < eh * 60 + em;
  }

  async tick(force = false) {
    if (this.busy) return;
    this.busy = true;
    try {
      if (!(await this.ensureConnected())) return;
      const s = this.s();
      // Job-board posts don't touch LinkedIn; handle them whenever the app is open.
      if (force || Date.now() - s.lastPostsCheckAt > 60 * 1000) await this.openQueuedJobPosts();

      if (!s.running && !force) { this.setStatus("LinkedIn agent paused (turn it on in the Assistant panel)"); return; }
      if (force || Date.now() - s.lastHelloAt > 30 * 60 * 1000) await this.hello();

      const work = await this.api("/extension/work");
      if (work.paused) { this.setStatus(`Paused by ZorHire: ${work.paused_reason}`); return; }
      if (!this.inWorkingHours(s) && !force) { this.setStatus(`Waiting for working hours (${s.workStart}-${s.workEnd})`); return; }

      if (work.searches?.length && (force || Date.now() > s.nextSearchAt)) {
        await this.runSearch(work.searches[0]);
        this.set({ nextSearchAt: Date.now() + rand(3, 6) * 60 * 1000 });
        return; // one LinkedIn activity per tick
      }
      if (work.invites_ready > 0 && Date.now() > s.nextInviteAt) {
        await this.sendOneInvite();
        this.set({ nextInviteAt: Date.now() + rand(2, 5) * 60 * 1000 });
        return;
      }
      if (Date.now() - s.lastAcceptCheckAt > 20 * 60 * 60 * 1000) {
        await this.checkAcceptances();
        return;
      }
      this.setStatus(work.invites_ready > 0 ? "Waiting before the next invitation" : "Idle: nothing to send");
    } catch (e) {
      if (!["no_token", "unauthorised", "li_signed_out"].includes(e.code)) this.setStatus(`Problem: ${e.message}`);
    } finally {
      this.busy = false;
    }
  }

  /* ─────────────────────────────── LinkedIn work ─────────────────────────────── */

  async hello() {
    const tab = await this.agentTab("https://www.linkedin.com/feed/");
    const me = await this.runInTab(tab, "zhInpageWhoAmI");
    if (!me?.signedIn) {
      this.setStatus("Sign in to LinkedIn in the \"LinkedIn agent\" tab");
      this.set({ lastHelloAt: Date.now() - 25 * 60 * 1000, account: null });
      throw Object.assign(new Error("Not signed in to LinkedIn"), { code: "li_signed_out" });
    }
    const account = await this.api("/extension/hello", {
      method: "POST",
      body: { name: me.name, publicId: me.publicId, headline: me.headline, premium: !!me.premium, recruiterLite: !!me.recruiterLite, version: `desktop-${VERSION}` },
    });
    this.set({ lastHelloAt: Date.now(), account: { ...account.linkedin, limits: account.limits } });
    this.setStatus(`Connected as ${me.name ?? "LinkedIn user"}${me.recruiterLite ? " · Recruiter Lite" : ""}`);
  }

  notify(title, body) {
    if (Notification.isSupported()) new Notification({ title, body, icon: path.join(__dirname, "icon128.png") }).show();
  }

  async warn(kind) {
    await this.api("/extension/warning", { method: "POST", body: { kind } }).catch(() => {});
    const text = {
      search_paused: "LinkedIn paused search on your account. The agent stopped for 24 hours.",
      captcha: "LinkedIn asked for a security check. Complete it in the \"LinkedIn agent\" tab; the agent stopped for 24 hours.",
      limit_reached: "LinkedIn's weekly invitation limit was reached. The agent stopped for 3 days.",
      restricted: "LinkedIn showed a restriction warning. The agent stopped for a week.",
    }[kind];
    if (text) this.notify("ZorHire LinkedIn agent paused", text);
    this.setStatus(text ?? `Stopped: ${kind}`);
  }

  async runSearch(search) {
    this.setStatus(`Searching LinkedIn for "${search.name}"`);
    let url = search.url;
    const unresolved = Object.fromEntries(Object.entries(search.unresolved || {}).filter(([, v]) => v.length));
    if (Object.keys(unresolved).length) {
      const tab = await this.agentTab();
      const resolved = await this.runInTab(tab, "zhInpageResolve", [unresolved]);
      const built = await this.api(`/extension/campaigns/${search.campaign_id}/resolved`, { method: "POST", body: { resolved } });
      url = built.url;
    }
    let total = 0;
    const maxPages = search.max_pages || 3;
    for (let page = 1; page <= maxPages; page++) {
      const tab = await this.agentTab(page === 1 ? url : `${url}&page=${page}`);
      const out = await this.runInTab(tab, "zhInpageCollectSearch");
      if (out?.warning === "search_paused" || out?.warning === "captcha") { await this.warn(out.warning); return; }
      const last = !out || out.last || page === maxPages || out.warning === "monthly_search_limit";
      const r = await this.api(`/extension/campaigns/${search.campaign_id}/prospects`, {
        method: "POST",
        body: { source: "search", prospects: out?.prospects ?? [], searchDone: last, error: out?.warning ?? undefined },
      });
      total += r.added;
      if (last) break;
      await sleep(rand(8000, 15000));
    }
    this.setStatus(`Search done: ${total} new people for "${search.name}"`);
  }

  async sendOneInvite() {
    const next = await this.api("/extension/next-invite", { method: "POST" });
    if (!next) return;
    const who = next.full_name ?? next.public_id;
    this.setStatus(`Inviting ${who}`);
    const tab = await this.agentTab(`https://www.linkedin.com/preload/search-custom-invite/?vanityName=${encodeURIComponent(next.public_id)}`);
    let res;
    try { res = await this.runInTab(tab, "zhInpageSendInvite", [next.full_name ?? "", next.note ?? ""]); }
    catch (e) { res = { outcome: "failed", error: String(e.message || e).slice(0, 200) }; }
    res = res || { outcome: "failed", error: "No result from page" };
    await this.api(`/extension/prospects/${next.prospect_id}/result`, { method: "POST", body: { outcome: res.outcome, error: res.error } });
    if (res.warning) await this.warn(res.warning);
    if (res.outcome === "limit_reached") await this.warn("limit_reached");
    this.setStatus(res.outcome === "sent" ? `Invitation sent to ${who}` : `Invite to ${who}: ${res.outcome.replace("_", " ")}`);
  }

  async checkAcceptances() {
    const pending = await this.api("/extension/pending-sent");
    this.set({ lastAcceptCheckAt: Date.now() });
    if (!pending?.length) return;
    const tab = await this.agentTab("https://www.linkedin.com/mynetwork/");
    const recent = await this.runInTab(tab, "zhInpageRecentConnections", [160]);
    const want = new Set(pending.map((p) => p.toLowerCase()));
    const accepted = (recent || []).filter((p) => want.has(p.toLowerCase()));
    if (accepted.length) await this.api("/extension/acceptances", { method: "POST", body: { publicIds: accepted } });
    this.setStatus(`Checked acceptances: ${accepted.length} new`);
  }

  /* ─────────────────────────────── Free job boards ─────────────────────────────── */

  async openQueuedJobPosts() {
    this.set({ lastPostsCheckAt: Date.now() });
    const posts = await this.api("/extension/job-posts");
    const openIds = new Set();
    for (const id of this.tabs.order) { const t = this.tabs.get(id); if (t.meta.post) openIds.add(t.meta.post.id); }
    const toOpen = (posts || []).filter((p) => p.status === "requested" && !openIds.has(p.id) && p.post_url).slice(0, 10);
    if (!toOpen.length) return;
    for (const post of toOpen) {
      const id = this.tabs.create({ kind: "web", url: post.post_url, title: post.board_name || "Job board", background: true, meta: { post } });
      this.tabs.get(id).onClosed = () => {};
      await this.api(`/extension/job-posts/${post.id}`, { method: "POST", body: { status: "opened" } }).catch(() => {});
    }
    this.notify(
      "Job boards ready to post",
      `${toOpen.length} job board${toOpen.length > 1 ? "s" : ""} opened as tabs in ZorHire. Sign in on each, then click "Fill form" in the ZorHire panel.`,
    );
  }

  /* ─────────────────────────────── Messages from page scripts ─────────────────────────────── */

  /** Same messages as the extension's chrome.runtime.onMessage. `tab` is the sender tab. */
  async handleMessage(msg, tab) {
    const url = tab?.view.webContents.getURL() || "";
    switch (msg?.type) {
      case "campaigns": {
        const work = await this.api("/extension/work");
        return { campaigns: work.campaigns };
      }
      case "importPage": {
        const recruiter = /\/talent\//.test(url);
        const out = await this.runInTab(tab, recruiter ? "zhInpageCollectRecruiter" : "zhInpageCollectSearch");
        if (out?.warning === "search_paused" || out?.warning === "captcha") { await this.warn(out.warning); return { ok: false, error: "LinkedIn paused search" }; }
        const r = await this.api(`/extension/campaigns/${msg.campaignId}/prospects`, { method: "POST", body: { source: recruiter ? "recruiter" : "page", prospects: out?.prospects ?? [] } });
        return { ok: true, ...r, found: out?.prospects?.length ?? 0 };
      }
      case "jobPost": {
        const post = tab?.meta.post;
        if (!post) return { ok: false };
        await this.api(`/extension/job-posts/${post.id}`, { method: "POST", body: { status: msg.status, posting_url: msg.status === "posted" ? url : undefined } });
        if (msg.status === "posted" || msg.status === "skipped") delete tab.meta.post;
        return { ok: true };
      }
      case "openUrl":
        if (tab && /^https?:\/\//.test(msg.url)) tab.view.webContents.loadURL(msg.url).catch(() => {});
        return { ok: true };
      case "capturePreview": return { ok: true, data: await this.api("/extension/capture/preview", { method: "POST", body: msg.body }) };
      case "captureSave": return { ok: true, data: await this.api("/extension/capture/save", { method: "POST", body: msg.body }) };
      case "captureJobs": return { ok: true, data: await this.api("/extension/jobs") };
      case "captureResume": {
        const { token } = this.s();
        const form = new FormData();
        form.append("resume", new Blob([new Uint8Array(msg.file.bytes)], { type: msg.file.type }), msg.file.name);
        const res = await fetch(`${this.apiBase}/extension/candidates/${encodeURIComponent(msg.candidateId)}/resume`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        const data = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, data } : { ok: false, error: data.message || `Upload failed (${res.status})` };
      }
      case "openZorHire": {
        const appTab = this.tabs.appTab();
        if (appTab) { this.tabs.activate(appTab.id); appTab.view.webContents.loadURL(this.appBase + (msg.path || "/")).catch(() => {}); }
        return { ok: true };
      }
      default: return { ok: false, error: "unknown message" };
    }
  }

  /** "Save this page to ZorHire" on any web tab (the extension popup's button). */
  async capture(tab) {
    if (!tab || tab.kind === "app") return { ok: false, error: "Open a profile page in a LinkedIn, Naukri or other web tab first." };
    if (!this.s().token && !(await this.ensureConnected())) return { ok: false, error: "Sign in to ZorHire first." };
    await tab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: "window.__zhCaptureOpenNow = true;" }]);
    await this.injectFile(tab, "capture.js");
    this.tabs.activate(tab.id);
    return { ok: true };
  }
}

module.exports = { Agent };
