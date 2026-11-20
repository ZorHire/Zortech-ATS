const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function render() {
  const s = await send({ type: "status" });
  const connected = !!s?.token;
  $("connect").classList.toggle("hidden", connected);
  $("main").classList.toggle("hidden", !connected);
  if (!connected) { $("server").value = s?.apiBase || "https://zorhire.zortechs.in/v1"; return; }
  $("status").textContent = s.status?.text || "Ready";
  $("running").checked = !!s.running;
  $("ws").value = s.workStart; $("we").value = s.workEnd;
  const a = s.account;
  $("acct").innerHTML = a
    ? `<b>${esc(a.name || "LinkedIn account")}</b><div class="muted">${esc(a.headline || "")}</div>
       <div style="margin-top:6px">
         <span class="pill ${a.has_premium ? "ok" : ""}">${a.has_premium ? "Premium" : "Free LinkedIn"}</span>
         <span class="pill ${a.recruiter_lite ? "ok" : ""}">${a.recruiter_lite ? "Recruiter Lite" : "No Recruiter Lite"}</span>
         ${a.paused_reason ? `<span class="pill warn">Paused</span>` : ""}
       </div>
       ${a.limits ? `<div class="muted" style="margin-top:6px">Invitations: ${a.limits.sent_today} today · ${a.limits.sent_this_week}/${a.limits.weekly_cap} this week</div>` : ""}`
    : `<b>LinkedIn not detected yet</b><div class="muted">Open <a href="https://www.linkedin.com/login" target="_blank">linkedin.com</a>, sign in, then click Run now.</div>`;
}

$("go").onclick = async () => {
  $("err").textContent = "";
  const code = $("code").value.trim();
  if (!/^zhli_/.test(code)) { $("err").textContent = "That doesn't look like a ZorHire connection code."; return; }
  $("go").disabled = true; $("go").textContent = "Connecting…";
  const r = await send({ type: "connect", code, apiBase: $("server").value });
  $("go").disabled = false; $("go").textContent = "Connect";
  if (!r?.ok) $("err").textContent = r?.error === "Not signed in to LinkedIn" ? "Connected to ZorHire. Now sign in to LinkedIn in this browser." : r?.error || "Could not connect.";
  render();
};
$("running").onchange = () => send({ type: "setRunning", running: $("running").checked });
$("ws").onchange = $("we").onchange = () => send({ type: "setHours", workStart: $("ws").value || "09:30", workEnd: $("we").value || "19:00" });
$("run").onclick = async () => { await send({ type: "runNow" }); $("status").textContent = "Working…"; setTimeout(render, 4000); };
$("open").onclick = async () => { const s = await send({ type: "status" }); chrome.tabs.create({ url: s.apiBase.replace(/\/v1$/, "").replace(":5000", ":5173") + "/linkedin-agent" }); };
$("capture").onclick = async () => {
  const r = await send({ type: "captureActiveTab" });
  if (r?.ok) window.close(); else $("cerr").textContent = r?.error || "Can't read this page.";
};
$("disc").onclick = async () => { await send({ type: "disconnect" }); render(); };
render();
setInterval(render, 5000);
