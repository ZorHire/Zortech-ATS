import { z } from "zod";

/**
 * LinkedIn people-search filters, as stored on linkedin_campaigns.search.
 *
 * Names (locations, companies, industries, schools) are what the recruiter or the AI
 * wrote. LinkedIn's search URL needs LinkedIn's own numeric ids for those, which only a
 * signed-in LinkedIn session can look up, so the extension resolves them through
 * LinkedIn's typeahead and posts them back into `resolved`. Anything still unresolved is
 * folded into the keywords so the search still means roughly the same thing.
 */
const names = z.array(z.string().trim().min(1).max(120)).max(15).default([]);
export const NETWORK = ["F", "S", "O"] as const; // 1st, 2nd, 3rd+ connections

export const SearchFiltersSchema = z.object({
  keywords: z.string().trim().max(500).default(""),
  title_keywords: z.string().trim().max(200).default(""),
  locations: names,
  current_companies: names,
  past_companies: names,
  industries: names,
  schools: names,
  network: z.array(z.enum(NETWORK)).max(3).default(["S", "O"]),
  profile_languages: z.array(z.string().trim().regex(/^[a-z]{2}$/)).max(5).default([]),
  exclude_keywords: names,
  resolved: z
    .object({
      locations: z.record(z.string(), z.string()).default({}),
      current_companies: z.record(z.string(), z.string()).default({}),
      past_companies: z.record(z.string(), z.string()).default({}),
      industries: z.record(z.string(), z.string()).default({}),
      schools: z.record(z.string(), z.string()).default({}),
    })
    .default({ locations: {}, current_companies: {}, past_companies: {}, industries: {}, schools: {} }),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const RESOLVABLE = ["locations", "current_companies", "past_companies", "industries", "schools"] as const;
export type Resolvable = (typeof RESOLVABLE)[number];

/** LinkedIn search URL parameter for each resolvable filter. */
const PARAM: Record<Resolvable, string> = {
  locations: "geoUrn",
  current_companies: "currentCompany",
  past_companies: "pastCompany",
  industries: "industry",
  schools: "schoolFilter",
};

export const RecruiterSearchSchema = z.object({
  boolean: z.string().max(1500).default(""),
  job_titles: z.array(z.string().max(120)).max(15).default([]),
  skills: z.array(z.string().max(80)).max(20).default([]),
  locations: z.array(z.string().max(120)).max(15).default([]),
  companies: z.array(z.string().max(120)).max(20).default([]),
  industries: z.array(z.string().max(120)).max(10).default([]),
  years_experience_min: z.number().int().min(0).max(50).nullable().default(null),
  years_experience_max: z.number().int().min(0).max(50).nullable().default(null),
  seniority: z.array(z.string().max(60)).max(8).default([]),
  tips: z.string().max(800).default(""),
});
export type RecruiterSearch = z.infer<typeof RecruiterSearchSchema>;

export function normalizeFilters(input: unknown): SearchFilters {
  const parsed = SearchFiltersSchema.safeParse(input ?? {});
  return parsed.success ? parsed.data : SearchFiltersSchema.parse({});
}

/** Quote a phrase for LinkedIn keyword search if it contains spaces. */
const phrase = (s: string) => (/\s/.test(s) && !/^".*"$/.test(s) ? `"${s.replace(/"/g, "")}"` : s);

export interface BuiltSearch {
  url: string;
  unresolved: Record<Resolvable, string[]>;
}

export function buildPeopleSearchUrl(f: SearchFilters): BuiltSearch {
  const params = new URLSearchParams();
  const unresolved = { locations: [], current_companies: [], past_companies: [], industries: [], schools: [] } as Record<Resolvable, string[]>;
  const extraKeywords: string[] = [];

  for (const key of RESOLVABLE) {
    const ids: string[] = [];
    for (const name of f[key]) {
      const id = f.resolved[key]?.[name];
      if (id && /^\d+$/.test(id)) ids.push(id);
      else {
        unresolved[key].push(name);
        // Industries and schools rarely appear verbatim on profiles; don't pollute keywords with them.
        if (key === "locations" || key === "current_companies") extraKeywords.push(phrase(name));
      }
    }
    if (ids.length) params.set(PARAM[key], JSON.stringify(ids));
  }

  const kw = [f.keywords.trim(), ...extraKeywords].filter(Boolean).join(" ");
  const excludes = f.exclude_keywords.map((x) => `NOT ${phrase(x)}`).join(" ");
  const keywords = [kw, excludes].filter(Boolean).join(" ").trim();
  if (keywords) params.set("keywords", keywords);
  if (f.title_keywords) params.set("titleFreeText", f.title_keywords);
  if (f.network.length) params.set("network", JSON.stringify(f.network));
  if (f.profile_languages.length) params.set("profileLanguage", JSON.stringify(f.profile_languages));
  params.set("origin", "FACETED_SEARCH");

  return { url: `https://www.linkedin.com/search/results/people/?${params.toString()}`, unresolved };
}

/** Max characters LinkedIn allows in a connection note (free accounts get 200). */
export const noteLimit = (hasPremium: boolean) => (hasPremium ? 300 : 200);

/** Trim a note to the limit at a sentence or word boundary. */
export function fitNote(note: string, limit: number): string {
  const clean = note.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > limit * 0.6) return cut.slice(0, sentence + 1);
  const word = cut.lastIndexOf(" ");
  return (word > 0 ? cut.slice(0, word) : cut).replace(/[,;:\-–]$/, "").trim();
}
