/* Development-only end-to-end check of the desktop app against a local ZorHire.
 * Run with ZORHIRE_SELFTEST=<output folder> plus ZORHIRE_TEST_CTX (a JSON file with a test
 * recruiter's token and job id). Not shipped in the installer. */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { app } = require("electron");

module.exports = async function selftest({ tabs, agent, alerts, win, APP_URL, API_URL }) {
  const out = process.env.ZORHIRE_SELFTEST;
  const ctx = JSON.parse(fs.readFileSync(process.env.ZORHIRE_TEST_CTX, "utf8"));
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  const ok = (cond, name, detail) => { results.push({ ok: !!cond, name, detail }); console.log(cond ? "  ok  " : "  FAIL", name, detail ?? ""); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch { /* retry */ } await sleep(500); } return null; };
  const shot = async (name) => {
    const t = tabs.active();
    const [bar, view] = await Promise.all([win.webContents.capturePage(), t.view.webContents.capturePage()]);
    fs.writeFileSync(path.join(out, `${name}-shell.png`), bar.toPNG());
    fs.writeFileSync(path.join(out, `${name}-view.png`), view.toPNG());
  };
  const H = { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" };

  // A local "profile page" for Save to ZorHire.
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><title>Priya Sharma | Profile</title><main><section><h1>Priya Sharma</h1>
      <div>Senior Java Developer at Infosys</div><div>Pune, Maharashtra, India</div></section>
      <section><h2>About</h2><p>9 years building Java, Spring Boot and Kafka services.</p></section></main>`);
  }).listen(5098);

  try {
    const appTab = tabs.appTab();
    await until(() => !appTab.view.webContents.isLoading());
    await appTab.view.webContents.executeJavaScript(`localStorage.setItem("jwt", ${JSON.stringify(ctx.token)}); location.reload(); true`);
    await sleep(6000);

    const bridge = await appTab.view.webContents.executeJavaScript("JSON.stringify(window.zorhireDesktop ? { d: window.zorhireDesktop.isDesktop, v: window.zorhireDesktop.version } : null)");
    ok(JSON.parse(bridge)?.d === true, "ZorHire page sees the desktop bridge", bridge);
    const ua = await appTab.view.webContents.executeJavaScript("navigator.userAgent");
    ok(!/Electron/.test(ua) && /ZorHireDesktop/.test(ua), "user agent is plain Chrome + ZorHireDesktop", ua);
    await shot("01-app");

    // Auto-connect with the ZorHire sign-in (no connection code to paste).
    await agent.tick(true).catch(() => {});
    const connected = await until(() => agent.publicState().connected, 15000);
    ok(connected, "assistant connected itself using the ZorHire sign-in", agent.publicState().status?.text);
    const acct = await (await fetch(`${API_URL}/linkedin-agent/account`, { headers: H })).json();
    ok(acct.connected && acct.tokens.some((t) => /^Desktop app/.test(t.label)), "ZorHire lists this PC as a connected app", acct.tokens.map((t) => t.label));

    appTab.view.webContents.executeJavaScript(`history.pushState({}, "", "/linkedin-agent"); dispatchEvent(new PopStateEvent("popstate"));`);
    await sleep(3500);
    const cardText = await appTab.view.webContents.executeJavaScript("document.body.innerText");
    ok(/built into this ZorHire app/.test(cardText), "LinkedIn agent page shows the desktop wording", cardText.match(/The agent[^\n]*/)?.[0]);
    tabs.setPanel(true);
    await sleep(800);
    await shot("02-linkedin-agent");

    // Save to ZorHire on a profile page: injected script + chrome.runtime shim + API.
    const pid = tabs.create({ kind: "web", url: "http://127.0.0.1:5098/in/priya" });
    const ptab = tabs.get(pid);
    await until(() => !ptab.view.webContents.isLoading() && ptab.view.webContents.getURL().includes("5098"));
    await sleep(1000);
    const webUa = await ptab.view.webContents.executeJavaScript("navigator.userAgent").catch(() => "");
    ok(webUa && !/Electron|ZorHire/.test(webUa), "website tabs look like normal Chrome", webUa);
    const who = await agent.runInTab(ptab, "zhInpageWhoAmI").catch((e) => ({ error: e.message }));
    ok(who && who.signedIn === false, "inpage.js functions run in the page's isolated world", who);
    const cap = await agent.capture(ptab);
    ok(cap.ok, "Save to ZorHire panel opens", cap);
    const panel = await until(async () => {
      const vals = await ptab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(() => { const h = [...document.documentElement.children].find((e) => e.shadowRoot); return h ? [...h.shadowRoot.querySelectorAll("input,textarea")].map((i) => i.value).filter(Boolean).join(" | ") : ""; })()` }]);
      return /Priya/.test(vals) && /Infosys/.test(vals) && vals; // ZorHire's parse came back through the shim
    }, 20000);
    ok(panel, "capture panel filled from ZorHire's parse via chrome.runtime.sendMessage", panel ? panel.slice(0, 160) : null);
    const saved = await ptab.view.webContents.executeJavaScriptInIsolatedWorld(999, [{ code: `(() => { const h = [...document.documentElement.children].find((e) => e.shadowRoot); const b = h && h.shadowRoot.getElementById("save"); if (b) b.click(); return !!b; })()` }]);
    const pgc = require(process.env.ZORHIRE_TEST_PG);
    const cand = saved && await until(async () => {
      const c = new pgc.Client(process.env.SERVER_DATABASE_URL); await c.connect();
      const r = await c.query(`SELECT first_name, last_name, current_company FROM candidates WHERE tenant_id = $1 AND first_name = 'Priya'`, [ctx.tenantId]);
      await c.end(); return r.rows[0];
    }, 15000);
    ok(cand, "Save to ZorHire created the candidate", cand ? `${cand.first_name} ${cand.last_name}, ${cand.current_company}` : saved);
    const pageSees = await ptab.view.webContents.executeJavaScript("typeof window.chrome?.runtime?.sendMessage");
    ok(pageSees !== "function", "the website itself cannot reach the assistant bridge", pageSees);
    await shot("03-save-to-zorhire");

    // Desktop alerts.
    await alerts.poll();
    const pg = require(process.env.ZORHIRE_TEST_PG);
    const db = new pg.Client(process.env.SERVER_DATABASE_URL);
    await db.connect();
    await sleep(1100);
    await db.query(`INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id) VALUES ($1,'info','Interview Scheduled','Priya Sharma — Java Developer (video, tomorrow 11:00)','interview',NULL)`, [ctx.userId]);
    await db.end();
    await alerts.poll();
    const badge = await win.webContents.executeJavaScript("document.getElementById('unread').textContent");
    ok(Number(badge) >= 1, "unread badge shows new alerts", badge);

    // Drop a resume anywhere on ZorHire.
    tabs.activate(appTab.id);
    tabs.setPanel(false);
    await appTab.view.webContents.executeJavaScript(`(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["Priya Sharma\\npriya.sharma@example.com\\n+91 98765 43210\\nSenior Java Developer, Infosys\\nSkills: Java, Spring Boot, Kafka"], "Priya_Sharma.pdf", { type: "application/pdf" }));
      const fire = (type) => document.body.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire("dragenter"); fire("dragover"); fire("drop"); return true;
    })()`);
    await sleep(3000);
    const dropUrl = appTab.view.webContents.getURL();
    const dropText = await appTab.view.webContents.executeJavaScript("document.body.innerText");
    ok(/\/candidates/.test(dropUrl) && /Priya_Sharma\.pdf/.test(dropText), "dropped resume opens in bulk upload on Candidates", dropUrl);
    await shot("04-dropped-resume");
  } catch (e) {
    ok(false, "selftest crashed", e.stack);
  } finally {
    server.close();
    fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
    console.log(`SELFTEST ${results.filter((r) => r.ok).length}/${results.length}`);
    setTimeout(() => app.exit(results.every((r) => r.ok) ? 0 : 1), 500);
  }
};
