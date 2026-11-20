/* "Save to ZorHire": capture the candidate profile on this page.
 * Runs automatically (as a small button) on LinkedIn profiles and Naukri pages, and on any
 * other page when the recruiter clicks "Save this page" in the extension popup.
 * Reads only what is visible on the page; never clicks "view phone/email" (which can use
 * paid credits) and never downloads anything unless the recruiter ticks the resume box. */
(() => {
  if (window.__zhCapture) { window.__zhCapture.open(); return; }

  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const host = location.hostname;
  const source = /linkedin\.com$/.test(host) ? "linkedin" : /naukri\.com$/.test(host) ? "naukri" : /indeed\./.test(host) ? "indeed" : /monster|foundit/.test(host) ? "monster" : "other";

  function hints() {
    const t = (sel) => document.querySelector(sel)?.innerText?.trim() || null;
    if (source === "linkedin" && /^\/in\//.test(location.pathname)) {
      const top = document.querySelector("main section") || document;
      const h1 = top.querySelector("h1");
      return {
        name: h1?.innerText.trim() || null,
        headline: top.querySelector(".text-body-medium")?.innerText.trim() || null,
        location: top.querySelector(".text-body-small.inline, span.text-body-small")?.innerText.trim() || null,
      };
    }
    // Generic: the page's main heading is usually the person's name on profile pages.
    return { name: t("h1") || t("h2") || null };
  }

  function pageText() {
    const main = document.querySelector("main") || document.body;
    return (main.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 40000);
  }

  function resumeLink() {
    const links = [...document.querySelectorAll("a[href]")];
    return links.find((a) => /\.(pdf|docx?)(\?|$)/i.test(a.href)) ||
      links.find((a) => /download (cv|resume)|view (cv|resume)|^resume$|^cv$/i.test(a.innerText.trim()) && /^https?:/.test(a.href));
  }

  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483646";
  const root = box.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      .fab{background:#1A4277;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
      .panel{display:none;position:absolute;right:0;bottom:52px;width:380px;max-height:80vh;overflow:auto;background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:13px}
      .panel.open{display:block}
      .hd{background:#1A4277;color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0;position:sticky;top:0}
      .x{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
      .bd{padding:12px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      label{display:block;font-size:11px;font-weight:600;color:#4b5563;margin-bottom:2px}
      input,select,textarea{width:100%;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px}
      textarea{min-height:48px}
      .full{grid-column:1/-1}
      .dup{background:#FFF6EB;border:1px solid #f5c58a;border-radius:8px;padding:8px;margin-bottom:10px}
      .dup b{color:#8F4A05}
      .btn{background:#F7911E;color:#fff;border:0;border-radius:8px;padding:9px 12px;font-weight:600;cursor:pointer;width:100%;margin-top:10px}
      .btn2{background:#fff;color:#1A4277;border:1px solid #1A4277;border-radius:8px;padding:7px 10px;font-weight:600;cursor:pointer;margin-top:6px}
      button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #F7911E;outline-offset:1px}
      .msg{margin-top:8px;min-height:18px}.ok{color:#065f46}.err{color:#b91c1c}
      .muted{color:#6b7280;font-size:12px}
      a{color:#1A4277}
    </style>
    <div class="panel" role="dialog" aria-label="Save this profile to ZorHire">
      <div class="hd"><b>Save to ZorHire</b><button class="x" id="x" aria-label="Close">×</button></div>
      <div class="bd" id="bd"><p class="muted">Reading this page…</p></div>
    </div>
    <button class="fab" id="fab" aria-expanded="false">Save to ZorHire</button>`;
  document.documentElement.appendChild(box);
  const $ = (id) => root.getElementById(id);
  const panel = root.querySelector(".panel");

  let state = { fields: null, duplicates: [], profileUrl: null };

  function close() { panel.classList.remove("open"); $("fab").setAttribute("aria-expanded", "false"); }
  async function open() {
    panel.classList.add("open");
    $("fab").setAttribute("aria-expanded", "true");
    $("bd").innerHTML = `<p class="muted">Reading this page…</p>`;
    const [preview, jobs] = await Promise.all([
      send({ type: "capturePreview", body: { url: location.href, source, pageText: pageText(), hints: hints() } }),
      send({ type: "captureJobs" }),
    ]);
    if (!preview?.ok) { $("bd").innerHTML = `<p class="err">${esc(preview?.error || "Could not read this page. Is the extension connected to ZorHire?")}</p>`; return; }
    state = { fields: preview.data.fields, duplicates: preview.data.duplicates || [], profileUrl: preview.data.profile_url };
    render(jobs?.ok ? jobs.data : []);
  }

  const FIELDS = [
    ["first_name", "First name"], ["last_name", "Last name"], ["email", "Email"], ["phone", "Phone"],
    ["current_title", "Current title"], ["current_company", "Current company"], ["experience_years", "Experience (years)"],
    ["current_location", "Location"], ["notice_period_days", "Notice (days)"], ["preferred_location", "Preferred location"],
    ["current_ctc", "Current CTC (₹/yr)"], ["expected_ctc", "Expected CTC (₹/yr)"],
  ];

  function render(jobs) {
    const f = state.fields;
    const dupHtml = state.duplicates.map((d) => `
      <div class="dup">
        <b>Already in ZorHire:</b> ${esc(d.first_name)} ${esc(d.last_name)}${d.current_company ? ` (${esc(d.current_company)})` : ""}
        <div class="muted">Matched on ${esc(d.matched_on)} · added ${new Date(d.created_at).toLocaleDateString()}${d.added_by ? ` by ${esc(d.added_by)}` : ""}</div>
        ${(d.applications || []).length ? `<div class="muted">In: ${d.applications.slice(0, 3).map((a) => `${esc(a.job_title)} (${esc(String(a.stage).replace(/_/g, " "))})`).join(", ")}</div>` : ""}
        <button class="btn2" data-update="${esc(d.id)}">Add new details to this candidate</button>
      </div>`).join("");
    const link = resumeLink();
    $("bd").innerHTML = `
      ${dupHtml}
      <div class="grid">
        ${FIELDS.map(([k, label]) => `<div><label for="f-${k}">${label}</label><input id="f-${k}" value="${esc(f[k] ?? "")}"></div>`).join("")}
        <div class="full"><label for="f-skills">Skills (comma-separated)</label><textarea id="f-skills">${esc((f.skills || []).join(", "))}</textarea></div>
        <div class="full"><label for="f-job">Add to job (optional)</label>
          <select id="f-job"><option value="">Don't add to a job</option>${jobs.map((j) => `<option value="${esc(j.id)}">${esc(j.title)}${j.client_name ? ` · ${esc(j.client_name)}` : ""}</option>`).join("")}</select></div>
        <div class="full"><label for="f-file">Resume file (optional)</label><input id="f-file" type="file" accept=".pdf,.doc,.docx,.txt">
          ${link ? `<label style="display:flex;gap:6px;align-items:center;font-weight:400;margin-top:4px"><input type="checkbox" id="f-fetch" style="width:auto"> Also fetch the resume linked on this page (may use a download credit)</label>` : ""}</div>
      </div>
      <button class="btn" id="save">${state.duplicates.some((d) => d.matched_on !== "name and company") ? "Save as a new candidate anyway" : "Save candidate"}</button>
      <div class="msg" id="m" role="status" aria-live="polite"></div>
      <p class="muted">Only what's visible on this page is saved. Check the fields before saving.</p>`;
    root.querySelectorAll("[data-update]").forEach((b) => (b.onclick = () => save(b.dataset.update)));
    $("save").onclick = () => save(null);
  }

  function collect() {
    const out = {};
    for (const [k] of FIELDS) out[k] = $(`f-${k}`).value.trim() || null;
    out.skills = $("f-skills").value.split(",").map((s) => s.trim()).filter(Boolean);
    out.summary = state.fields.summary;
    return out;
  }

  async function fileFromPage() {
    const a = resumeLink();
    if (!a) return null;
    const r = await fetch(a.href, { credentials: "include" });
    if (!r.ok) throw new Error(`Couldn't download the resume (${r.status})`);
    const blob = await r.blob();
    const type = blob.type || "application/pdf";
    const ext = /word|docx/.test(type) ? (/openxml/.test(type) ? "docx" : "doc") : /pdf/.test(type) ? "pdf" : (a.href.match(/\.(pdf|docx?|txt)(\?|$)/i)?.[1] || "pdf");
    return { name: `resume.${ext}`, type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  }

  async function save(candidateId) {
    const m = $("m");
    m.className = "msg"; m.textContent = "Saving…";
    const force = !candidateId && state.duplicates.some((d) => d.matched_on !== "name and company");
    const r = await send({ type: "captureSave", body: { url: location.href, source, fields: collect(), jobId: $("f-job").value || undefined, candidateId: candidateId || undefined, force } });
    if (!r?.ok) { m.className = "msg err"; m.textContent = r?.error || "Save failed."; return; }
    const id = r.data.candidate_id;
    let resumeNote = "";
    try {
      let file = null;
      const picked = $("f-file").files?.[0];
      if (picked) file = { name: picked.name, type: picked.type || "application/octet-stream", bytes: Array.from(new Uint8Array(await picked.arrayBuffer())) };
      else if ($("f-fetch")?.checked) file = await fileFromPage();
      if (file) {
        const up = await send({ type: "captureResume", candidateId: id, file });
        resumeNote = up?.ok ? " Resume attached." : ` Resume not attached: ${up?.error || "upload failed"}.`;
      }
    } catch (e) { resumeNote = ` Resume not attached: ${e.message}.`; }
    m.className = "msg ok";
    m.innerHTML = `${r.data.created ? "Saved" : "Updated"} in ZorHire${r.data.added_to_job ? " and added to the job as Sourced" : ""}.${esc(resumeNote)} <a href="#" id="openc">Open in ZorHire</a>`;
    $("openc").onclick = (e) => { e.preventDefault(); send({ type: "openZorHire", path: `/candidates?highlight=${id}` }); };
  }

  $("fab").onclick = () => (panel.classList.contains("open") ? close() : open());
  $("x").onclick = close;
  window.__zhCapture = { open };
  if (window.__zhCaptureOpenNow) open();
})();
