/* Functions injected into LinkedIn pages with chrome.scripting.executeScript({ func }).
 * Each must be self-contained (no outer variables) and return plain JSON.
 * They run in the page's own origin, so LinkedIn sees normal same-origin requests from
 * the recruiter's signed-in session. Nothing here reads or sends passwords. */

/* eslint-disable no-unused-vars */

/** Who is signed in, Premium, and whether Recruiter Lite is available. */
async function zhInpageWhoAmI() {
  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1];
  if (!csrf || location.pathname.startsWith("/login") || location.pathname.startsWith("/uas/")) return { signedIn: false };
  const out = { signedIn: true };
  try {
    const r = await fetch("/voyager/api/me", { headers: { "csrf-token": csrf, accept: "application/json" }, credentials: "include" });
    if (r.status === 401 || r.status === 403) return { signedIn: false };
    const j = await r.json();
    const mini = j.miniProfile || (j.included || []).find((x) => x && x.publicIdentifier) || {};
    out.name = [mini.firstName, mini.lastName].filter(Boolean).join(" ") || null;
    out.publicId = mini.publicIdentifier || null;
    out.headline = mini.occupation || null;
    out.premium = j.premiumSubscriber === true || (j.data && j.data.premiumSubscriber === true);
  } catch (e) { out.meError = String(e).slice(0, 120); }
  try {
    const t = await fetch("/talent/home", { credentials: "include", redirect: "follow" });
    const u = new URL(t.url);
    out.recruiterLite = t.ok && u.pathname.startsWith("/talent") && !/login|upsell|premium|checkout|signup/i.test(t.url);
  } catch { out.recruiterLite = false; }
  return out;
}

/** Look up LinkedIn's numeric ids for location/company/industry/school names. */
async function zhInpageResolve(items) {
  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1];
  const TYPES = { locations: "GEO", current_companies: "COMPANY", past_companies: "COMPANY", industries: "INDUSTRY", schools: "SCHOOL" };
  const out = {};
  for (const [key, names] of Object.entries(items || {})) {
    out[key] = {};
    for (const name of names || []) {
      try {
        const qs = new URLSearchParams({ keywords: name, origin: "OTHER", q: "type", type: TYPES[key] });
        if (TYPES[key] === "GEO") qs.set("queryContext", "List(geoVersion->3,bingGeoSubTypeFilters->MARKET_AREA|COUNTRY_REGION|ADMIN_DIVISION_1|CITY)");
        const r = await fetch(`/voyager/api/typeahead/hitsV2?${qs}`, { headers: { "csrf-token": csrf, "x-restli-protocol-version": "2.0.0", accept: "application/json" }, credentials: "include" });
        if (!r.ok) continue;
        const text = await r.text();
        const m = text.match(/urn:li:(?:fs_geo|fsd_geo|geo|fs_miniCompany|fsd_company|company|fs_industry|industry|fs_miniSchool|fsd_school|school):(\d+)/);
        if (m) out[key][name] = m[1];
      } catch { /* leave unresolved */ }
      await new Promise((res) => setTimeout(res, 400 + Math.random() * 400));
    }
  }
  return out;
}

/** Read the people-search results on the current page (scrolls to load all cards first). */
async function zhInpageCollectSearch() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = () => document.body ? document.body.innerText : "";
  const blocked = /unusual (search )?(traffic|activity)|search activity on your account has been (temporarily )?(paused|restricted)/i;
  const monthly = /commercial use limit|monthly limit for (profile )?searches/i;
  for (let i = 0; i < 20 && !document.querySelector('[role="listitem"], li.reusable-search__result-container, [data-chameleon-result-urn]'); i++) {
    if (blocked.test(text())) return { warning: "search_paused" };
    if (/no results found/i.test(text())) return { prospects: [], last: true };
    await sleep(500);
  }
  if (location.pathname.startsWith("/checkpoint/")) return { warning: "captcha" };
  if (blocked.test(text())) return { warning: "search_paused" };
  const monthlyHit = monthly.test(text());
  for (let i = 0; i < 5; i++) {
    const cards = document.querySelectorAll('[role="listitem"], li.reusable-search__result-container');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ block: "end" });
    await sleep(900);
  }
  const cards = [...document.querySelectorAll('[role="listitem"], li.reusable-search__result-container')];
  const seen = new Set();
  const prospects = [];
  const junk = /^(connect|message|follow|pending|view .*profile|status is|•|\d+ (other )?mutual|.*mutual connection|provides services|premium|open to work|send inmail)/i;
  for (const card of cards) {
    // The first /in/ link is the person; later links in the card are mutual connections.
    const a = card.querySelector('a[href*="/in/"]');
    if (!a) continue;
    const m = a.href.match(/\/in\/([^/?#]+)/);
    if (!m) continue;
    const publicId = decodeURIComponent(m[1]);
    if (seen.has(publicId) || publicId === "ACoA") continue;
    seen.add(publicId);
    const lines = card.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    const nameEl = a.querySelector('span[aria-hidden="true"]') || a;
    const name = (nameEl.innerText || lines[0] || "").split("\n")[0].trim();
    if (!name || /^linkedin member$/i.test(name)) continue;
    const degreeLine = lines.find((l) => /\b(1st|2nd|3rd\+?)\b/.test(l)) || "";
    const degree = (degreeLine.match(/\b(1st|2nd|3rd\+?)\b/) || [])[1] || null;
    const rest = lines.filter((l) => l !== name && !l.startsWith(name) && !/^\W*(1st|2nd|3rd\+?)\W*$/.test(l) && !/degree connection/i.test(l) && !junk.test(l));
    const snippet = rest.filter((l) => /^(current|past|skills|summary)\s*:/i.test(l)).join(" · ");
    const plain = rest.filter((l) => !/^(current|past|skills|summary)\s*:/i.test(l));
    prospects.push({ publicId, name, degree, headline: plain[0] || null, location: plain[1] || null, snippet: snippet || null });
  }
  const nextBtn = document.querySelector('button[aria-label="Next"]');
  return { prospects, last: !nextBtn || nextBtn.disabled, warning: monthlyHit ? "monthly_search_limit" : null };
}

/** Read Recruiter Lite search results on the current page. */
async function zhInpageCollectRecruiter() {
  const links = [...document.querySelectorAll('a[href*="/talent/profile/"]')];
  const seen = new Set();
  const prospects = [];
  for (const a of links) {
    const m = a.href.match(/\/talent\/profile\/([^/?#]+)/);
    if (!m || seen.has(m[1])) continue;
    const name = a.innerText.trim().split("\n")[0];
    if (!name) continue;
    seen.add(m[1]);
    const card = a.closest("li, article, [data-test-row-lockup-full-name], div[class*='row']") || a.parentElement;
    const lines = (card ? card.innerText : "").split("\n").map((s) => s.trim()).filter((l) => l && l !== name);
    const publicLink = card && card.querySelector('a[href*="linkedin.com/in/"], a[href^="/in/"]');
    const pm = publicLink && publicLink.href.match(/\/in\/([^/?#]+)/);
    prospects.push({
      recruiterId: m[1],
      recruiterUrl: a.href.split("?")[0],
      publicId: pm ? decodeURIComponent(pm[1]) : undefined,
      name,
      headline: lines[0] || null,
      location: lines.find((l) => /,|india|remote|area/i.test(l) && l !== lines[0]) || null,
      snippet: lines.slice(1, 4).join(" · ") || null,
    });
  }
  return { prospects };
}

/**
 * Send one connection request from the "custom invite" page
 * (https://www.linkedin.com/preload/search-custom-invite/?vanityName=...).
 * Returns { outcome: sent|already_pending|already_connected|needs_email|note_quota|limit_reached|failed, error?, warning? }.
 */
async function zhInpageSendInvite(fullName, note) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const bodyText = () => (document.body ? document.body.innerText : "");
  const limitRe = /weekly invitation limit|reached the weekly limit|you.ve reached the limit/i;
  const first = String(fullName || "").trim().split(/\s+/)[0].toLowerCase();
  const pickDialog = () =>
    [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find((d) => /add a note|send without a note|enter their email|invitation|connect/i.test(d.innerText));
  const btn = (root, re) => [...root.querySelectorAll("button")].find((b) => re.test((b.getAttribute("aria-label") || "") + " " + b.innerText.trim()) && !b.disabled);

  if (location.pathname.startsWith("/checkpoint/")) return { outcome: "failed", warning: "captcha", error: "LinkedIn security check" };
  let dialog = null;
  for (let i = 0; i < 30 && !dialog; i++) {
    if (limitRe.test(bodyText())) return { outcome: "limit_reached" };
    dialog = pickDialog();
    if (!dialog) await sleep(500);
  }
  if (!dialog) {
    const t = bodyText();
    if (/\bpending\b/i.test(t)) return { outcome: "already_pending" };
    if (/already connected|1st degree/i.test(t)) return { outcome: "already_connected" };
    return { outcome: "failed", error: "Invite dialog did not open" };
  }
  const dText = dialog.innerText;
  if (/enter their email/i.test(dText)) { const c = btn(dialog, /dismiss|cancel|close/i); if (c) c.click(); return { outcome: "needs_email" }; }
  if (first && !dText.toLowerCase().includes(first)) return { outcome: "failed", error: "Dialog is for a different person" };

  if (note) {
    const add = btn(dialog, /add a note/i);
    if (add) { add.click(); await sleep(900); }
    const d2 = pickDialog() || dialog;
    if (/personali[sz]ed invitations|premium to (add|send)|notes? (are|is) limited|used all/i.test(d2.innerText) && !d2.querySelector("textarea")) {
      const c = btn(d2, /dismiss|cancel|close/i); if (c) c.click();
      return { outcome: "note_quota" };
    }
    const ta = d2.querySelector("textarea");
    if (!ta) return { outcome: "failed", error: "Note box not found" };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    ta.focus();
    setter.call(ta, note);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(600);
    if (ta.value !== note) return { outcome: "failed", error: "Note did not stick" };
    const send = btn(d2, /^(send( invitation| now)?|send)$/i) || btn(d2, /send invitation|send now/i);
    if (!send) return { outcome: "failed", error: "Send button not found" };
    send.click();
  } else {
    const send = btn(dialog, /send without a note/i) || btn(dialog, /^send/i);
    if (!send) return { outcome: "failed", error: "Send button not found" };
    send.click();
  }
  await sleep(2500);
  if (limitRe.test(bodyText())) return { outcome: "limit_reached" };
  if (location.pathname.startsWith("/checkpoint/")) return { outcome: "failed", warning: "captcha", error: "LinkedIn security check" };
  const still = pickDialog();
  if (still && /add a note|send without a note/i.test(still.innerText) && btn(still, /^send/i)) return { outcome: "failed", error: "Dialog stayed open after Send" };
  return { outcome: "sent" };
}

/** Recently added connections (public ids), newest first, up to `max`. */
async function zhInpageRecentConnections(max) {
  const csrf = (document.cookie.match(/JSESSIONID="?([^";]+)/) || [])[1];
  const ids = [];
  for (let start = 0; start < (max || 120); start += 40) {
    const url = `/voyager/api/relationships/dash/connections?decorationId=com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-16&count=40&q=search&sortType=RECENTLY_ADDED&start=${start}`;
    const r = await fetch(url, { headers: { "csrf-token": csrf, accept: "application/json" }, credentials: "include" });
    if (!r.ok) break;
    const t = await r.text();
    const found = [...t.matchAll(/"publicIdentifier":"([^"]+)"/g)].map((m) => m[1]);
    if (!found.length) break;
    ids.push(...found);
    await new Promise((res) => setTimeout(res, 700));
  }
  return [...new Set(ids)];
}
