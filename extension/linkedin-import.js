/* "Add to ZorHire" button on LinkedIn people-search and Recruiter Lite pages.
 * Lets the recruiter use every LinkedIn filter by hand, then import the visible results
 * into a ZorHire campaign, where the AI scores them and writes connection notes. */
(() => {
  if (window.__zhImport) return;
  window.__zhImport = true;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483646";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
      .fab{background:#F7911E;color:#fff;border:0;border-radius:999px;padding:10px 16px;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}
      .fab:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid #1A4277;outline-offset:2px}
      .panel{display:none;position:absolute;right:0;bottom:52px;width:300px;background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-radius:12px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);font-size:13px}
      .panel.open{display:block}
      h2{margin:0 0 6px;font-size:14px;color:#1A4277}
      p{margin:0 0 10px;color:#4b5563;line-height:1.4}
      select{width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;margin-bottom:10px}
      .go{width:100%;background:#1A4277;color:#fff;border:0;border-radius:8px;padding:9px;font-weight:600;cursor:pointer}
      .go[disabled]{opacity:.6;cursor:wait}
      .msg{margin-top:8px;min-height:18px}
    </style>
    <div class="panel" role="dialog" aria-label="Add these LinkedIn results to ZorHire">
      <h2>Add to ZorHire</h2>
      <p>Imports the people on this page into a campaign. ZorHire's AI scores each one and drafts a note for you to review.</p>
      <label for="c" style="display:block;font-weight:600;margin-bottom:4px">Campaign</label>
      <select id="c"><option value="">Loading…</option></select>
      <button class="go" id="go">Import this page</button>
      <div class="msg" id="m" role="status" aria-live="polite"></div>
    </div>
    <button class="fab" id="fab" aria-expanded="false">Add to ZorHire</button>`;
  document.documentElement.appendChild(host);

  const $ = (id) => root.getElementById(id);
  const panel = root.querySelector(".panel");
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

  $("fab").addEventListener("click", async () => {
    const open = !panel.classList.contains("open");
    panel.classList.toggle("open", open);
    $("fab").setAttribute("aria-expanded", String(open));
    if (!open) return;
    const res = await send({ type: "campaigns" });
    const list = res?.campaigns ?? [];
    $("c").innerHTML = list.length
      ? list.map((c) => `<option value="${c.id}">${c.name.replace(/[<>&"]/g, "")}${c.status === "draft" ? " (draft)" : ""}</option>`).join("")
      : `<option value="">No campaigns yet: create one in ZorHire</option>`;
    if (!res || res.ok === false) $("m").textContent = res?.error || "Connect the extension to ZorHire first (click the ZorHire icon).";
  });

  $("go").addEventListener("click", async () => {
    const campaignId = $("c").value;
    if (!campaignId) { $("m").textContent = "Pick a campaign first."; return; }
    $("go").disabled = true;
    $("m").textContent = "Reading this page…";
    const r = await send({ type: "importPage", campaignId });
    $("go").disabled = false;
    $("m").textContent = r?.ok
      ? `Found ${r.found}: ${r.added} added${r.duplicates ? `, ${r.duplicates} already in the campaign` : ""}${r.already_connected ? `, ${r.already_connected} already connected` : ""}.`
      : r?.error || "Import failed.";
  });
})();
