import type { SearchParams, SearchSort } from "../../store/api/candidateApi";

/** A resume search without paging: what the URL and saved searches hold. */
export type ResumeSearch = Omit<SearchParams, "page" | "limit">;

const SORTS: SearchSort[] = ["relevance", "recent", "experience"];

/** URL keys used by /search. Saved searches and the command palette build the same URL. */
const KEYS = ["q", "skills", "role", "source", "location", "experience", "notice", "sort"] as const;

export const EMPTY_SEARCH: ResumeSearch = {
  query: "",
  location: "All",
  experience: "All",
  noticePeriod: "Any",
  skills: [],
  role: "",
  source: "All",
  sort: "relevance",
};

/** True when the search has keywords or at least one filter (sort alone doesn't count). */
export function hasCriteria(s: ResumeSearch): boolean {
  return (
    !!s.query.trim() ||
    (s.skills?.length ?? 0) > 0 ||
    !!s.role?.trim() ||
    (!!s.source && s.source !== "All") ||
    (!!s.location && s.location !== "All") ||
    (!!s.experience && s.experience !== "All") ||
    (!!s.noticePeriod && s.noticePeriod !== "Any")
  );
}

/** Search -> URL params (defaults left out so links stay short). */
export function searchToParams(s: ResumeSearch): URLSearchParams {
  const p = new URLSearchParams();
  if (s.query.trim()) p.set("q", s.query.trim());
  if (s.skills && s.skills.length > 0) p.set("skills", s.skills.join(","));
  if (s.role?.trim()) p.set("role", s.role.trim());
  if (s.source && s.source !== "All") p.set("source", s.source);
  if (s.location && s.location !== "All") p.set("location", s.location);
  if (s.experience && s.experience !== "All") p.set("experience", s.experience);
  if (s.noticePeriod && s.noticePeriod !== "Any") p.set("notice", s.noticePeriod);
  if (s.sort && s.sort !== "relevance") p.set("sort", s.sort);
  return p;
}

/** URL params -> search, or null when the URL carries no search. */
export function paramsToSearch(p: URLSearchParams): ResumeSearch | null {
  if (!KEYS.some((k) => p.has(k))) return null;
  const sort = p.get("sort") as SearchSort | null;
  const s: ResumeSearch = {
    query: p.get("q") ?? "",
    skills: (p.get("skills") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    role: p.get("role") ?? "",
    source: p.get("source") || "All",
    location: p.get("location") || "All",
    experience: p.get("experience") || "All",
    noticePeriod: p.get("notice") || "Any",
    sort: sort && SORTS.includes(sort) ? sort : "relevance",
  };
  return hasCriteria(s) ? s : null;
}

export function searchUrl(s: ResumeSearch): string {
  const qs = searchToParams(s).toString();
  return `/search${qs ? `?${qs}` : ""}`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Saved-search JSON -> search. Accepts the current shape (what ResumeSearchPage
 * saves) and the older { q, skills, location, min_experience } shape.
 */
export function savedQueryToSearch(q: Record<string, unknown>): ResumeSearch {
  const skills = Array.isArray(q.skills)
    ? (q.skills as unknown[]).map(String).filter(Boolean)
    : str(q.skills)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  const sort = str(q.sort) as SearchSort;
  return {
    query: str(q.query) || str(q.q),
    skills,
    role: str(q.role),
    source: str(q.source) || "All",
    location: str(q.location) || "All",
    experience: str(q.experience) || "All",
    noticePeriod: str(q.noticePeriod) || "Any",
    sort: SORTS.includes(sort) ? sort : "relevance",
  };
}

/** Short human summary, e.g. `"React" · Skills: AWS · Bangalore`. */
export function summarizeSearch(s: ResumeSearch): string {
  const parts: string[] = [];
  if (s.query.trim()) parts.push(`"${s.query.trim()}"`);
  if (s.skills && s.skills.length) parts.push(`Skills: ${s.skills.join(", ")}`);
  if (s.role?.trim()) parts.push(`Role: ${s.role.trim()}`);
  if (s.location && s.location !== "All") parts.push(s.location);
  if (s.experience && s.experience !== "All") parts.push(s.experience);
  if (s.noticePeriod && s.noticePeriod !== "Any") parts.push(`Notice: ${s.noticePeriod}`);
  if (s.source && s.source !== "All") parts.push(`Source: ${s.source}`);
  return parts.join(" · ") || "No filters";
}

/** A skill "matches" when it overlaps any searched skill or keyword (case-insensitive). */
export function isMatchedSkill(skill: string, terms: string[]): boolean {
  const s = skill.toLowerCase();
  return terms.some((t) => t.length > 1 && (s.includes(t) || t.includes(s)));
}

/** Lower-cased terms from the keywords and skills of a search, minus boolean operators. */
export function highlightTermsFor(query: string, skills: string[] = []): string[] {
  const words = query
    .split(/[\s,()"]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w && !["and", "or", "not"].includes(w));
  return Array.from(new Set([...words, ...skills.map((s) => s.trim().toLowerCase()).filter(Boolean)]));
}
