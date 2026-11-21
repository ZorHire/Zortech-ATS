/* Tab bar and Assistant panel for the ZorHire desktop window. */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let state = { tabs: [], panelOpen: false };

function renderTabs() {
  const box = $("tabs");
  box.innerHTML = state.tabs.map((t) => `
    <div class="tab k-${t.kind} ${t.active ? "active" : ""} ${t.loading ? "loading" : ""}" role="tab" tabindex="0"
         aria-selected="${t.active}" data-id="${t.id}" title="${esc(t.title)}${t.url ? "\n" + esc(t.url) : ""}">
      <span class="dot" aria-hidden="true"></span>
      <span class="t">${esc(t.kind === "agent" ? "LinkedIn agent" : t.title || "Loading…")}</span>
      ${t.closable ? `<button class="x" data-close="${t.id}" aria-label="Close ${esc(t.title)}" title="Close (Ctrl+W)">×</button>` : ""}
    </div>`).join("");
  const active = state.tabs.find((t) => t.active);
  $("back").disabled = !active?.canGoBack;
  $("fwd").disabled = !active?.canGoForward;
  $("assist").setAttribute("aria-pressed", String(state.panelOpen));
  $("panel").classList.toggle("hidden", !state.panelOpen);
}

$("tabs").addEventListener("click", (e) => {
  const close = e.target.closest("[data-close]");
  if (close) { e.stopPropagation(); window.zh.close(Number(close.dataset.close)); return; }
  const tab = e.target.closest(".tab");
  if (tab) window.zh.activate(Number(tab.dataset.id));
});
$("tabs").addEventListener("auxclick", (e) => {
  const tab = e.target.closest(".tab");
  if (e.button === 1 && tab) window.zh.close(Number(tab.dataset.id));
});
$("tabs").addEventListener("keydown", (e) => {
  const tab = e.target.closest(".tab");
  if (tab && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); window.zh.activate(Number(tab.dataset.id)); }
});

const activeId = () => state.tabs.find((t) => t.active)?.id;
$("back").onclick = () => window.zh.nav(activeId(), "back");
$("fwd").onclick = () => window.zh.nav(activeId(), "forward");
$("reload").onclick = () => window.zh.nav(activeId(), "reload");
$("add").onclick = () => { const r = $("add").getBoundingClientRect(); window.zh.openMenu(r.left, r.bottom + 2); };
$("assist").onclick = () => window.zh.setPanel(!state.panelOpen);
$("bell").onclick = () => window.zh.activate(state.tabs.find((t) => t.kind === "app")?.id);
$("update").onclick = () => window.zh.installUpdate();

/* ─────────────── Assistant panel ─────────────── */

function renderAssistant(a) {
  $("status").textContent = a.status?.text || "…";
  $("notConnected").classList.toggle("hidden", a.connected);
  $("connected").classList.toggle("hidden", !a.connected);
  $("running").checked = !!a.running;
  if (document.activeElement !== $("ws")) $("ws").value = a.workStart;
  if (document.activeElement !== $("we")) $("we").value = a.workEnd;
  const li = a.account;
  $("acct").innerHTML = li
    ? `<b>${esc(li.name || "LinkedIn account")}</b><div class="muted">${esc(li.headline || "")}</div>
       <div style="margin-top:6px">
         <span class="tag ${li.has_premium ? "ok" : ""}">${li.has_premium ? "Premium" : "Free LinkedIn"}</span>
         <span class="tag ${li.recruiter_lite ? "ok" : ""}">${li.recruiter_lite ? "Recruiter Lite" : "No Recruiter Lite"}</span>
         ${li.paused_reason ? `<span class="tag warn" title="${esc(li.paused_reason)}">Paused</span>` : ""}
       </div>
       ${li.limits ? `<div class="muted" style="margin-top:6px">Invitations: ${li.limits.sent_today} today · ${li.limits.sent_this_week}/${li.limits.weekly_cap} this week</div>` : ""}`
    : `<span class="muted">LinkedIn not checked yet. Sign in to LinkedIn in the "LinkedIn agent" tab, then click Run now.</span>`;
  $("ver").textContent = `ZorHire desktop ${a.version} · ${a.apiBase.replace(/^https?:\/\//, "").replace(/\/v1$/, "")}`;
}

$("running").onchange = async (e) => renderAssistant(await window.zh.assistantSet({ running: e.target.checked }));
$("ws").onchange = async () => renderAssistant(await window.zh.assistantSet({ workStart: $("ws").value }));
$("we").onchange = async () => renderAssistant(await window.zh.assistantSet({ workEnd: $("we").value }));
$("run").onclick = () => window.zh.run();
$("connect").onclick = async () => renderAssistant(await window.zh.connect());
$("disc").onclick = async () => renderAssistant(await window.zh.disconnect());
$("capture").onclick = async () => {
  $("cerr").textContent = "";
  const r = await window.zh.capture();
  if (!r?.ok) $("cerr").textContent = r?.error || "Could not open the capture panel on this page.";
};

window.zh.on("tabs:state", (s) => { state = s; renderTabs(); });
window.zh.on("assistant:state", renderAssistant);
window.zh.on("assistant:error", (msg) => { window.zh.setPanel(true); $("cerr").textContent = msg; });
window.zh.on("alerts:unread", (n) => {
  $("unread").textContent = n > 99 ? "99+" : String(n);
  $("unread").classList.toggle("hidden", !n);
  $("bell").title = n ? `${n} unread alerts` : "No unread alerts";
});
window.zh.on("update:ready", (v) => { $("update").classList.remove("hidden"); $("update").title = `ZorHire ${v} is ready`; });

window.zh.init().then((s) => {
  state = s.tabs;
  renderTabs();
  renderAssistant(s.assistant);
  if (s.unread) $("unread").classList.remove("hidden"), ($("unread").textContent = String(s.unread));
});
