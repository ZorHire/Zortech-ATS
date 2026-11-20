/* Desktop alerts: every minute, read the recruiter's ZorHire notifications (new JD
 * assignments, interviews, pipeline moves, vendor submissions) with their own sign-in and
 * show new ones as Windows notifications. Clicking one opens the right ZorHire page.
 * Only notifications created after the app started watching are shown (no backlog flood). */
const path = require("path");
const { Notification } = require("electron");
const store = require("./store");

const ROUTES = {
  job: (id) => `/jobs/${id}`,
  interview: () => "/interviews",
  application: () => "/candidates",
  vendor_submission: () => "/assigned-jds",
  ai_usage: () => "/settings/ai-usage",
};

class Alerts {
  constructor({ apiBase, getJwt, onUnread, onOpen }) {
    this.apiBase = apiBase.replace(/\/$/, "");
    this.getJwt = getJwt;
    this.onUnread = onUnread;
    this.onOpen = onOpen;
    this.shown = new Set();
  }

  start() {
    this.timer = setInterval(() => this.poll().catch(() => {}), 60 * 1000);
    setTimeout(() => this.poll().catch(() => {}), 10 * 1000);
  }

  stop() { clearInterval(this.timer); }

  async poll() {
    const jwt = await this.getJwt();
    if (!jwt) { this.onUnread(0); return; }
    const res = await fetch(`${this.apiBase}/notifications`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items)) return;
    const unread = items.filter((n) => !n.read_at);
    this.onUnread(unread.length);

    const { alertsSince } = store.get({ alertsSince: null });
    const newest = items.reduce((m, n) => (n.created_at > m ? n.created_at : m), alertsSince || "");
    if (!alertsSince) { store.set({ alertsSince: newest || new Date().toISOString() }); return; }

    const fresh = unread.filter((n) => n.created_at > alertsSince && !this.shown.has(n.id)).reverse();
    if (newest > alertsSince) store.set({ alertsSince: newest });
    if (!fresh.length || !Notification.isSupported()) return;

    const icon = path.join(__dirname, "icon128.png");
    const show = fresh.length > 3 ? fresh.slice(-2) : fresh;
    for (const n of show) {
      this.shown.add(n.id);
      const route = (ROUTES[n.entity_type] || (() => "/"))(n.entity_id);
      const note = new Notification({ title: n.title, body: n.body || "", icon });
      note.on("click", () => this.onOpen(route));
      note.show();
    }
    if (fresh.length > show.length) {
      const note = new Notification({ title: "ZorHire", body: `${fresh.length - show.length} more updates in ZorHire`, icon });
      note.on("click", () => this.onOpen("/"));
      note.show();
    }
  }
}

module.exports = { Alerts };
