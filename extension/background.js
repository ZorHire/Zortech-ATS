/* ZorHire Assistant: background service worker.
 *
 * Every 30 s (while the browser is open) it asks ZorHire what to do and does at most one
 * LinkedIn action, in a pinned background tab of the recruiter's own signed-in LinkedIn:
 *   - run a campaign's people search and import the results,
 *   - send one approved connection request (with gaps of 2-5 minutes, inside working hours),
 *   - once a day, check which invitations were accepted.
 * It also opens free job-board "post a job" pages that the recruiter queued in ZorHire and
 * fills the forms (autofill.js); the recruiter signs in and presses the board's Post button.
 *
 * Safety rails: ZorHire's limits (per campaign/day, 40/day, 100/week), randomised gaps,
 * working hours only, and an immediate stop when LinkedIn shows a limit, a security check
 * or a "search paused" notice. No passwords are ever read, stored or sent.
 */
importScripts("inpage.js");

const VERSION = chrome.runtime.getManifest().version;
const DEFAULTS = {
  apiBase: "https://zorhire.zortechs.in/v1",
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
  agentTabId: null,
  busyUntil: 0,
  status: { text: "Not connected", at: 0 },
  account: null,
  boardTabs: {}, // tabId -> post
};

const get = async (keys) => ({ ...DEFAULTS, ...(await chrome.storage.local.get(keys ?? Object.keys(DEFAULTS))) });
const set = (obj) => chrome.storage.local.set(obj);
const rand = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setStatus = (text) => set({ status: { text, at: Date.now() } });

/* ─────────────────────────────── ZorHire API ─────────────────────────────── */

async function api(path, { method = "GET", body } = {}) {
  const { apiBase, token } = await get(["apiBase", "token"]);
  if (!token) throw Object.assign(new Error("Not connected to ZorHire"), { code: "no_token" });
  const res = await fetch(apiBase.replace(/\/$/, "") + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    await set({ token: "" });
    await setStatus("Disconnected: reconnect with a new code from ZorHire");
    throw Object.assign(new Error("Unauthorised"), { code: "unauthorised" });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `ZorHire error ${res.status}`);
  return data;
}

/* ─────────────────────────────── Agent tab ─────────────────────────────── */

async function agentTab(url) {
  let { agentTabId } = await get(["agentTabId"]);
  let tab = agentTabId ? await chrome.tabs.get(agentTabId).catch(() => null) : null;
  if (!tab) {
    tab = await chrome.tabs.create({ url: url ?? "https://www.linkedin.com/feed/", active: false, pinned: true });
    await set({ agentTabId: tab.id });
  } else if (url) {
    await chrome.tabs.update(tab.id, { url });
  }
  await waitForLoad(tab.id);
  await sleep(rand(2500, 4000));
  return tab.id;
}

function waitForLoad(tabId, timeout = 30000) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listener); clearTimeout(timer); resolve(); };
    const listener = (id, info) => { if (id === tabId && info.status === "complete") done(); };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => { if (t.status === "complete") done(); }).catch(done);
  });
}

async function runInTab(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res?.result;
}

/* ─────────────────────────────── Scheduling ─────────────────────────────── */

function inWorkingHours(s) {
  const now = new Date();
  if (!s.workDays.includes(now.getDay())) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = s.workStart.split(":").map(Number);
  const [eh, em] = s.workEnd.split(":").map(Number);
  return mins >= sh * 60 + sm && mins < eh * 60 + em;
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 0.5 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("tick", { periodInMinutes: 0.5 }));
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "tick") tick().catch((e) => console.warn("tick", e)); });

async function tick(force = false) {
  const s = await get();
  if (!s.token) return;
  if (Date.now() < s.busyUntil) return;
  await set({ busyUntil: Date.now() + 4 * 60 * 1000 });
  try {
    // Job-board posts don't touch LinkedIn; handle them whenever the browser is open.
    if (force || Date.now() - s.lastPostsCheckAt > 60 * 1000) await openQueuedJobPosts();

    if (!s.running && !force) return;
    if (force || Date.now() - s.lastHelloAt > 30 * 60 * 1000) await hello();

    const work = await api("/extension/work");
    if (work.paused) { await setStatus(`Paused by ZorHire: ${work.paused_reason}`); return; }
    if (!inWorkingHours(s) && !force) { await setStatus(`Waiting for working hours (${s.workStart}-${s.workEnd})`); return; }

    if (work.searches?.length && (force || Date.now() > s.nextSearchAt)) {
      await runSearch(work.searches[0]);
      await set({ nextSearchAt: Date.now() + rand(3, 6) * 60 * 1000 });
      return; // one LinkedIn activity per tick
    }
    if (work.invites_ready > 0 && Date.now() > s.nextInviteAt) {
      await sendOneInvite();
      await set({ nextInviteAt: Date.now() + rand(2, 5) * 60 * 1000 });
      return;
    }
    if (Date.now() - s.lastAcceptCheckAt > 20 * 60 * 60 * 1000) {
      await checkAcceptances();
      return;
    }
    await setStatus(work.invites_ready > 0 ? "Waiting before the next invitation" : "Idle: nothing to send");
  } catch (e) {
    if (e.code !== "no_token" && e.code !== "unauthorised") await setStatus(`Problem: ${e.message}`);
  } finally {
    await set({ busyUntil: 0 });
  }
}

/* ─────────────────────────────── LinkedIn work ─────────────────────────────── */

async function hello() {
  const tabId = await agentTab("https://www.linkedin.com/feed/");
  const me = await runInTab(tabId, zhInpageWhoAmI);
  if (!me?.signedIn) {
    await setStatus("Sign in to LinkedIn in this browser (open linkedin.com and log in)");
    await set({ lastHelloAt: Date.now() - 25 * 60 * 1000, account: null });
    throw new Error("Not signed in to LinkedIn");
  }
  const account = await api("/extension/hello", {
    method: "POST",
    body: { name: me.name, publicId: me.publicId, headline: me.headline, premium: !!me.premium, recruiterLite: !!me.recruiterLite, version: VERSION },
  });
  await set({ lastHelloAt: Date.now(), account: { ...account.linkedin, limits: account.limits } });
  await setStatus(`Connected as ${me.name ?? "LinkedIn user"}${me.recruiterLite ? " · Recruiter Lite" : ""}`);
}

async function warn(kind) {
  await api("/extension/warning", { method: "POST", body: { kind } }).catch(() => {});
  const text = {
    search_paused: "LinkedIn paused search on your account. The agent stopped for 24 hours.",
    captcha: "LinkedIn asked for a security check. Complete it in the LinkedIn tab; the agent stopped for 24 hours.",
    limit_reached: "LinkedIn's weekly invitation limit was reached. The agent stopped for 3 days.",
    restricted: "LinkedIn showed a restriction warning. The agent stopped for a week.",
  }[kind];
  if (text) chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title: "ZorHire LinkedIn agent paused", message: text });
  await setStatus(text ?? `Stopped: ${kind}`);
}

async function runSearch(search) {
  await setStatus(`Searching LinkedIn for "${search.name}"`);
  let url = search.url;
  const unresolved = Object.fromEntries(Object.entries(search.unresolved || {}).filter(([, v]) => v.length));
  if (Object.keys(unresolved).length) {
    const tabId = await agentTab();
    const resolved = await runInTab(tabId, zhInpageResolve, [unresolved]);
    const built = await api(`/extension/campaigns/${search.campaign_id}/resolved`, { method: "POST", body: { resolved } });
    url = built.url;
  }
  let total = 0;
  for (let page = 1; page <= (search.max_pages || 3); page++) {
    const tabId = await agentTab(page === 1 ? url : `${url}&page=${page}`);
    const out = await runInTab(tabId, zhInpageCollectSearch);
    if (out?.warning === "search_paused" || out?.warning === "captcha") { await warn(out.warning); return; }
    const last = !out || out.last || page === (search.max_pages || 3) || out.warning === "monthly_search_limit";
    const r = await api(`/extension/campaigns/${search.campaign_id}/prospects`, {
      method: "POST",
      body: { source: "search", prospects: out?.prospects ?? [], searchDone: last, error: out?.warning ?? undefined },
    });
    total += r.added;
    if (last) break;
    await sleep(rand(8000, 15000));
  }
  await setStatus(`Search done: ${total} new people for "${search.name}"`);
}

async function sendOneInvite() {
  const next = await api("/extension/next-invite", { method: "POST" });
  if (!next) return;
  await setStatus(`Inviting ${next.full_name ?? next.public_id}`);
  const tabId = await agentTab(`https://www.linkedin.com/preload/search-custom-invite/?vanityName=${encodeURIComponent(next.public_id)}`);
  let res;
  try { res = await runInTab(tabId, zhInpageSendInvite, [next.full_name ?? "", next.note ?? ""]); }
  catch (e) { res = { outcome: "failed", error: String(e.message || e).slice(0, 200) }; }
  res = res || { outcome: "failed", error: "No result from page" };
  await api(`/extension/prospects/${next.prospect_id}/result`, { method: "POST", body: { outcome: res.outcome, error: res.error } });
  if (res.warning) await warn(res.warning);
  if (res.outcome === "limit_reached") await warn("limit_reached");
  await setStatus(res.outcome === "sent" ? `Invitation sent to ${next.full_name ?? next.public_id}` : `Invite to ${next.full_name ?? next.public_id}: ${res.outcome.replace("_", " ")}`);
}

async function checkAcceptances() {
  const pending = await api("/extension/pending-sent");
  await set({ lastAcceptCheckAt: Date.now() });
  if (!pending?.length) return;
  const tabId = await agentTab("https://www.linkedin.com/mynetwork/");
  const recent = await runInTab(tabId, zhInpageRecentConnections, [160]);
  const want = new Set(pending.map((p) => p.toLowerCase()));
  const accepted = (recent || []).filter((p) => want.has(p.toLowerCase()));
  if (accepted.length) await api("/extension/acceptances", { method: "POST", body: { publicIds: accepted } });
  await setStatus(`Checked acceptances: ${accepted.length} new`);
}

/* ─────────────────────────────── Free job boards ─────────────────────────────── */

async function openQueuedJobPosts() {
  await set({ lastPostsCheckAt: Date.now() });
  const posts = await api("/extension/job-posts");
  const { boardTabs } = await get(["boardTabs"]);
  const openIds = new Set(Object.values(boardTabs).map((p) => p.id));
  const toOpen = (posts || []).filter((p) => p.status === "requested" && !openIds.has(p.id) && p.post_url).slice(0, 10);
  if (!toOpen.length) return;
  const tabIds = [];
  for (const post of toOpen) {
    const tab = await chrome.tabs.create({ url: post.post_url, active: false });
    boardTabs[tab.id] = post;
    tabIds.push(tab.id);
    await api(`/extension/job-posts/${post.id}`, { method: "POST", body: { status: "opened" } }).catch(() => {});
  }
  await set({ boardTabs });
  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: "ZorHire job posts", color: "orange" });
  } catch { /* tab groups unsupported */ }
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Job boards ready to post",
    message: `${toOpen.length} job board${toOpen.length > 1 ? "s" : ""} opened in the "ZorHire job posts" tabs. Sign in on each, then click "Fill form" in the ZorHire panel.`,
  });
}

// Show the fill panel on every page load in a job-board tab (the recruiter may sign in first).
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== "complete") return;
  const { boardTabs } = await get(["boardTabs"]);
  const post = boardTabs[tabId];
  if (!post) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["autofill.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, func: (p) => window.__zhShowPanel && window.__zhShowPanel(p), args: [post] });
  } catch (e) { console.warn("autofill inject", e); }
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { boardTabs, agentTabId } = await get(["boardTabs", "agentTabId"]);
  if (boardTabs[tabId]) { delete boardTabs[tabId]; await set({ boardTabs }); }
  if (agentTabId === tabId) await set({ agentTabId: null });
});

/* ─────────────────────────────── Messages ─────────────────────────────── */

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    switch (msg?.type) {
      case "connect": {
        const apiBase = String(msg.apiBase || DEFAULTS.apiBase).replace(/\/$/, "");
        await set({ apiBase, token: String(msg.code || "").trim(), lastHelloAt: 0 });
        try { await hello(); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
      }
      case "disconnect":
        await set({ token: "", account: null });
        await setStatus("Not connected");
        return { ok: true };
      case "status": return { ...(await get()), version: VERSION };
      case "setRunning": await set({ running: !!msg.running }); return { ok: true };
      case "setHours": await set({ workStart: msg.workStart, workEnd: msg.workEnd }); return { ok: true };
      case "runNow": tick(true); return { ok: true };
      case "campaigns": {
        const work = await api("/extension/work");
        return { campaigns: work.campaigns };
      }
      case "importPage": {
        // From linkedin-import.js (the "Add to ZorHire" button on a search or Recruiter page).
        const tabId = sender.tab?.id;
        const recruiter = /\/talent\//.test(sender.tab?.url || "");
        const out = await runInTab(tabId, recruiter ? zhInpageCollectRecruiter : zhInpageCollectSearch);
        if (out?.warning === "search_paused" || out?.warning === "captcha") { await warn(out.warning); return { ok: false, error: "LinkedIn paused search" }; }
        const r = await api(`/extension/campaigns/${msg.campaignId}/prospects`, { method: "POST", body: { source: recruiter ? "recruiter" : "page", prospects: out?.prospects ?? [] } });
        return { ok: true, ...r, found: out?.prospects?.length ?? 0 };
      }
      case "jobPost": {
        const post = sender.tab ? (await get(["boardTabs"])).boardTabs[sender.tab.id] : null;
        if (!post) return { ok: false };
        await api(`/extension/job-posts/${post.id}`, { method: "POST", body: { status: msg.status, posting_url: msg.status === "posted" ? sender.tab.url : undefined } });
        if (msg.status === "posted" || msg.status === "skipped") {
          const { boardTabs } = await get(["boardTabs"]);
          delete boardTabs[sender.tab.id];
          await set({ boardTabs });
        }
        return { ok: true };
      }
      case "openUrl": await chrome.tabs.update(sender.tab.id, { url: msg.url }); return { ok: true };

      // "Save to ZorHire" (capture.js). Results are wrapped as { ok, data } / { ok:false, error }.
      case "capturePreview": return { ok: true, data: await api("/extension/capture/preview", { method: "POST", body: msg.body }) };
      case "captureSave": return { ok: true, data: await api("/extension/capture/save", { method: "POST", body: msg.body }) };
      case "captureJobs": return { ok: true, data: await api("/extension/jobs") };
      case "captureResume": {
        const { apiBase, token } = await get(["apiBase", "token"]);
        const form = new FormData();
        form.append("resume", new Blob([new Uint8Array(msg.file.bytes)], { type: msg.file.type }), msg.file.name);
        const res = await fetch(`${apiBase}/extension/candidates/${encodeURIComponent(msg.candidateId)}/resume`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
        const data = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, data } : { ok: false, error: data.message || `Upload failed (${res.status})` };
      }
      case "captureActiveTab": {
        // From the popup: inject the capture panel into whatever page is open (activeTab).
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:/.test(tab.url || "")) return { ok: false, error: "Open a web page with a profile first." };
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { window.__zhCaptureOpenNow = true; } });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["capture.js"] });
        return { ok: true };
      }
      case "openZorHire": {
        const { apiBase } = await get(["apiBase"]);
        await chrome.tabs.create({ url: apiBase.replace(/\/v1$/, "").replace(":5000", ":5173") + (msg.path || "/") });
        return { ok: true };
      }
      default: return { ok: false, error: "unknown message" };
    }
  })().then(reply, (e) => reply({ ok: false, error: e.message }));
  return true;
});
