/* Job-board fill panel. Injected into tabs the extension opened for a queued job post.
 * The recruiter signs in or creates an account on the board themselves, opens the
 * post-a-job form, and clicks "Fill form". This script fills the fields it can recognise,
 * shows copy buttons for everything, and never fills passwords or presses Post/Submit. */
(() => {
  if (window.__zhShowPanel) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function labelOf(el) {
    const bits = [el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.name, el.id, el.getAttribute("data-testid")];
    if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) bits.push(l.innerText); }
    const wrapLabel = el.closest("label"); if (wrapLabel) bits.push(wrapLabel.innerText);
    const by = el.getAttribute("aria-labelledby");
    if (by) by.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) bits.push(n.innerText); });
    // Nearest preceding text in the same field group.
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const t = [...p.childNodes].filter((n) => n !== el && !n.contains?.(el)).map((n) => n.textContent || "").join(" ").trim();
      if (t && t.length < 120) { bits.push(t); break; }
    }
    return bits.filter(Boolean).join(" | ").toLowerCase();
  }

  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };

  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setRich(el, text) {
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    // insertText keeps editors (Quill, Draft.js, CKEditor) in sync with their own state.
    if (!document.execCommand("insertText", false, text)) el.innerText = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function pickOption(select, wanted) {
    const w = wanted.map((x) => String(x).toLowerCase()).filter(Boolean);
    const opt = [...select.options].find((o) => w.some((x) => o.text.toLowerCase().includes(x)));
    if (!opt) return false;
    select.value = opt.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fill(job) {
    const rules = [
      { key: "title", re: /job title|designation|position (name|title)|role title|job role|^title|\btitle\b|profile name/, value: job.title },
      { key: "company", re: /company name|organi[sz]ation name|employer name/, value: job.company },
      { key: "openings", re: /no\.? of (openings|positions|hires|vacanc)|openings|vacanc/, value: String(job.openings ?? 1) },
      { key: "exp_min", re: /(min(imum)?\.? *(exp|experience))|(experience.*(from|min))|exp.*from/, value: String(job.experience_min) },
      { key: "exp_max", re: /(max(imum)?\.? *(exp|experience))|(experience.*(to|max))|exp.*to\b/, value: String(job.experience_max) },
      { key: "experience", re: /experience|work ex/, value: job.experience },
      { key: "sal_min", re: /(min(imum)?\.? *(salary|ctc|stipend|pay))|(salary|ctc|stipend).*(from|min)/, value: job.salary_min_lpa != null ? String(job.salary_min_lpa) : "" },
      { key: "sal_max", re: /(max(imum)?\.? *(salary|ctc|stipend|pay))|(salary|ctc|stipend).*(to|max)/, value: job.salary_max_lpa != null ? String(job.salary_max_lpa) : "" },
      { key: "salary", re: /salary|ctc|compensation|stipend/, value: job.salary ?? "" },
      { key: "location", re: /location|city|work place|job locality/, value: job.location },
      { key: "email", re: /e-?mail.*(appl|resume|receive|contact)|apply.*e-?mail|contact e-?mail/, value: job.apply_email ?? "" },
      { key: "description", re: /description|responsibilit|about (the )?(job|role|opportunity)|job details|job summary|requirements/, value: job.description, rich: true },
    ];
    const used = new Set();
    let filled = 0;
    const fields = [...document.querySelectorAll("input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox']")]
      .filter((el) => visible(el) && !el.disabled && !el.readOnly)
      .filter((el) => !(el instanceof HTMLInputElement) || ["text", "search", "number", "email", "url", "tel", ""].includes(el.type));

    for (const el of fields) {
      if (el instanceof HTMLInputElement && el.type === "password") continue;
      const label = labelOf(el);
      if (!label || /password|otp|captcha|search jobs|phone|mobile/.test(label)) continue;

      if (el instanceof HTMLSelectElement) {
        if (/employment|job type|type of (job|employment)|work type/.test(label) && pickOption(el, [job.employment_type, job.employment_type_key?.replace("_", " ")])) { filled++; mark(el); }
        else if (/work mode|workplace|remote|location type/.test(label) && pickOption(el, [job.work_mode])) { filled++; mark(el); }
        continue;
      }
      if (/skill/.test(label) && !used.has("skills")) {
        used.add("skills");
        fillSkills(el, job.skills || []);
        filled++; mark(el);
        continue;
      }
      const rule = rules.find((r) => !used.has(r.key) && r.value && r.re.test(label));
      if (!rule) continue;
      const isRich = el.isContentEditable || el.getAttribute("role") === "textbox";
      if (rule.key !== "description" && (el instanceof HTMLTextAreaElement || isRich) && rule.key !== "title") continue;
      if (!isRich && el.value && el.value.trim()) continue; // never overwrite what the recruiter typed
      if (rule.key === "email" && !(el instanceof HTMLInputElement)) continue;
      if (/^(exp_|sal_|openings)/.test(rule.key) && el instanceof HTMLInputElement && el.type !== "number" && !/^\d/.test(rule.value)) continue;
      isRich ? setRich(el, rule.value) : setValue(el, rule.value);
      used.add(rule.key);
      if (rule.key === "exp_min" || rule.key === "exp_max") used.add("experience");
      if (rule.key === "sal_min" || rule.key === "sal_max") used.add("salary");
      filled++;
      mark(el);
    }
    return filled;
  }

  function fillSkills(el, skills) {
    // Tag inputs take one skill at a time followed by Enter; plain inputs take a comma list.
    const isTag = el instanceof HTMLInputElement && (el.getAttribute("role") === "combobox" || /tag|chip|token|autocomplete/i.test(el.className + " " + (el.parentElement?.className || "")));
    if (!isTag) { el.isContentEditable ? setRich(el, skills.join(", ")) : setValue(el, skills.join(", ")); return; }
    skills.slice(0, 10).forEach((s, i) => setTimeout(() => {
      setValue(el, s);
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    }, i * 450));
  }

  function mark(el) { el.style.outline = "2px solid #F7911E"; el.style.outlineOffset = "1px"; }

  window.__zhShowPanel = (post) => {
    document.getElementById("zh-fill-host")?.remove();
    const job = post.job;
    const host = document.createElement("div");
    host.id = "zh-fill-host";
    host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646";
    const root = host.attachShadow({ mode: "open" });
    const copyRows = [
      ["Job title", job.title], ["Company", job.company], ["Location", `${job.location} (${job.work_mode})`],
      ["Employment type", job.employment_type], ["Experience", job.experience], ["Salary", job.salary || "Not disclosed"],
      ["Openings", job.openings], ["Skills", (job.skills || []).join(", ")], ["Apply email", job.apply_email || ""], ["Description", job.description],
    ];
    root.innerHTML = `
      <style>
        :host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
        .box{width:330px;max-height:78vh;overflow:auto;background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:13px}
        .hd{background:#1A4277;color:#fff;padding:10px 12px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center}
        .hd b{font-size:14px}.x{background:none;border:0;color:#fff;font-size:18px;cursor:pointer;line-height:1}
        .bd{padding:12px}ol{margin:0 0 10px;padding-left:18px;line-height:1.5;color:#374151}
        a{color:#1A4277;font-weight:600}
        .row{display:flex;gap:6px;margin-bottom:8px}
        button.p{flex:1;background:#F7911E;color:#fff;border:0;border-radius:8px;padding:9px;font-weight:600;cursor:pointer}
        button.s{flex:1;background:#fff;color:#1A4277;border:1px solid #1A4277;border-radius:8px;padding:8px;font-weight:600;cursor:pointer}
        button:focus-visible,a:focus-visible{outline:3px solid #1A4277;outline-offset:2px}
        .msg{min-height:18px;margin:4px 0 8px;color:#065f46}
        details{border-top:1px solid #e5e7eb;padding-top:8px}summary{cursor:pointer;font-weight:600;color:#1A4277}
        .f{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #f3f4f6}
        .f span{color:#6b7280;min-width:88px}.f code{flex:1;white-space:pre-wrap;word-break:break-word;font-family:inherit;max-height:60px;overflow:hidden}
        .c{background:#f3f4f6;border:0;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px}
      </style>
      <div class="box" role="dialog" aria-label="ZorHire job posting helper">
        <div class="hd"><b>Post "${esc(job.title)}" on ${esc(post.board_name)}</b><button class="x" id="x" aria-label="Hide">×</button></div>
        <div class="bd">
          <ol>
            <li><a href="#" id="login">Log in</a> or <a href="#" id="signup">create a free account</a> on ${esc(post.board_name)} in this tab.</li>
            <li>Open the "Post a job" form.</li>
            <li>Click <b>Fill form</b>, check every field, then press ${esc(post.board_name)}'s own Post button.</li>
          </ol>
          <div class="row"><button class="p" id="fill">Fill form</button></div>
          <div class="msg" id="m" role="status" aria-live="polite"></div>
          <div class="row"><button class="s" id="done">I've posted it</button><button class="s" id="skip">Skip board</button></div>
          <details><summary>Copy fields by hand</summary>
            ${copyRows.map(([k, v], i) => `<div class="f"><span>${esc(k)}</span><code>${esc(v)}</code><button class="c" data-i="${i}">Copy</button></div>`).join("")}
          </details>
        </div>
      </div>`;
    document.documentElement.appendChild(host);
    const $ = (id) => root.getElementById(id);
    const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));
    $("x").onclick = () => host.remove();
    $("login").onclick = (e) => { e.preventDefault(); send({ type: "openUrl", url: post.login_url }); };
    $("signup").onclick = (e) => { e.preventDefault(); send({ type: "openUrl", url: post.signup_url }); };
    $("fill").onclick = () => {
      const n = fill(job);
      $("m").textContent = n ? `Filled ${n} field${n > 1 ? "s" : ""} (outlined in orange). Check them, fill anything missing from "Copy fields", then post.` : "No job form found on this page yet. Sign in and open the post-a-job form, then try again.";
    };
    $("done").onclick = async () => {
      if (!confirm(`Mark this job as posted on ${post.board_name}? ZorHire will save this page's address as the posting link.`)) return;
      await send({ type: "jobPost", status: "posted" });
      $("m").textContent = "Saved in ZorHire. You can close this tab.";
    };
    $("skip").onclick = async () => { await send({ type: "jobPost", status: "skipped" }); host.remove(); };
    root.querySelectorAll(".c").forEach((b) => (b.onclick = async () => {
      await navigator.clipboard.writeText(String(copyRows[Number(b.dataset.i)][1] ?? ""));
      b.textContent = "Copied";
      setTimeout(() => (b.textContent = "Copy"), 1200);
    }));
  };
})();
