/**
 * Help articles: Markdown files in ./articles, loaded once. The same text is shown in the
 * Help page and given to the help assistant, so fixing an article fixes both.
 *
 * Each file starts with a small header:
 *   ---
 *   title: Create a job
 *   category: Jobs and clients
 *   audience: staff            # staff | vendor | client | all (comma-separated allowed)
 *   summary: One line shown in lists and search results.
 *   keywords: jd, requirement, opening
 *   order: 10                  # optional, sort order within the category
 *   ---
 */
import fs from "fs";
import path from "path";

export type Audience = "staff" | "vendor" | "client";

export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  audience: Audience[];
  summary: string;
  keywords: string[];
  order: number;
  body: string;
}

const DIR = path.join(__dirname, "articles");
/** Category order on the Help page; anything not listed comes after, alphabetically. */
const CATEGORY_ORDER = ["Getting started", "Jobs and clients", "Candidates", "Pipeline and hiring", "AI features", "Vendors and partners", "Email and messaging", "Insights and admin", "Vendor portal", "Client portal"];
const catRank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };
let cache: HelpArticle[] | null = null;

function parse(slug: string, raw: string): HelpArticle | null {
  const m = raw.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!meta.title) return null;
  const aud = (meta.audience || "staff").split(",").map((s) => s.trim());
  const audience = (aud.includes("all") ? ["staff", "vendor", "client"] : aud.filter((a) => ["staff", "vendor", "client"].includes(a))) as Audience[];
  return {
    slug,
    title: meta.title,
    category: meta.category || "General",
    audience: audience.length ? audience : ["staff"],
    summary: meta.summary || "",
    keywords: (meta.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
    order: Number(meta.order) || 100,
    body: m[2].trim(),
  };
}

export function allArticles(): HelpArticle[] {
  if (cache) return cache;
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort() : [];
  cache = files
    .map((f) => parse(f.replace(/\.md$/, ""), fs.readFileSync(path.join(DIR, f), "utf8")))
    .filter((a): a is HelpArticle => !!a)
    .sort((a, b) => catRank(a.category) - catRank(b.category) || a.category.localeCompare(b.category) || a.order - b.order || a.title.localeCompare(b.title));
  return cache;
}

export const articlesFor = (audience: Audience): HelpArticle[] => allArticles().filter((a) => a.audience.includes(audience));

export const audienceForRole = (role: string | undefined): Audience =>
  role === "vendor_user" ? "vendor" : role === "client_user" ? "client" : "staff";

/**
 * Pages the assistant may link to, per audience. Links outside this list are dropped, so
 * the assistant can't send anyone to a page that doesn't exist or isn't theirs.
 */
export const APP_PAGES: { path: string; label: string; audience: Audience[] }[] = [
  { path: "/", label: "Dashboard", audience: ["staff"] },
  { path: "/jobs", label: "Jobs", audience: ["staff"] },
  { path: "/jobs/new", label: "Create a job", audience: ["staff"] },
  { path: "/candidates", label: "Candidates", audience: ["staff"] },
  { path: "/search", label: "Resume search", audience: ["staff"] },
  { path: "/search/saved", label: "Saved searches", audience: ["staff"] },
  { path: "/interviews", label: "Interviews", audience: ["staff"] },
  { path: "/offers", label: "Offers", audience: ["staff"] },
  { path: "/campaigns", label: "Email campaigns", audience: ["staff"] },
  { path: "/agents", label: "AI agents", audience: ["staff"] },
  { path: "/linkedin-agent", label: "LinkedIn agent", audience: ["staff"] },
  { path: "/clients", label: "Clients", audience: ["staff"] },
  { path: "/vendors", label: "Vendors", audience: ["staff"] },
  { path: "/vendors/leaderboard", label: "Vendor leaderboard", audience: ["staff"] },
  { path: "/assigned-jds", label: "JD assignments", audience: ["staff"] },
  { path: "/analytics", label: "Analytics", audience: ["staff"] },
  { path: "/reports", label: "Reports", audience: ["staff"] },
  { path: "/admin", label: "Admin", audience: ["staff"] },
  { path: "/settings/email", label: "Email settings", audience: ["staff"] },
  { path: "/settings/whatsapp", label: "WhatsApp settings", audience: ["staff"] },
  { path: "/settings/job-boards", label: "Job boards settings", audience: ["staff"] },
  { path: "/settings/ai-usage", label: "AI usage", audience: ["staff"] },
  { path: "/subscription", label: "Subscription", audience: ["staff"] },
  { path: "/vendor-portal/jobs", label: "Open jobs", audience: ["vendor"] },
  { path: "/vendor-portal/submissions", label: "My submissions", audience: ["vendor"] },
  { path: "/client-portal/jobs", label: "Your jobs", audience: ["client"] },
  { path: "/profile", label: "My profile", audience: ["staff", "vendor", "client"] },
  { path: "/help", label: "Help", audience: ["staff", "vendor", "client"] },
];

export const pagesFor = (audience: Audience) => APP_PAGES.filter((p) => p.audience.includes(audience));

/** Plain keyword search, used for the Help page search and when the AI is unavailable. */
export function searchArticles(audience: Audience, text: string, limit = 5): HelpArticle[] {
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  if (!words.length) return [];
  const scored = articlesFor(audience).map((a) => {
    const title = a.title.toLowerCase();
    const summary = a.summary.toLowerCase();
    const body = a.body.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 5;
      if (a.keywords.some((k) => k.includes(w))) score += 4;
      if (summary.includes(w)) score += 2;
      if (body.includes(w)) score += 1;
    }
    return { a, score };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map((s) => s.a);
}
