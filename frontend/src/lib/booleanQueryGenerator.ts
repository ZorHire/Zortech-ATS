export interface BooleanQueryInput {
  title: string;
  mandatory_skills: string[];
  preferred_skills: string[];
  location: string;
  experience_min: number;
  experience_max: number;
}

export interface BooleanQueries {
  /** X-ray search via Google, e.g. site:linkedin.com/in ("title") ("skill1" OR "skill2") "location" */
  linkedin: string;
  /** Direct boolean search box syntax — works on Naukri, Indeed, Monster, Glassdoor */
  generic: string;
}

const MAX_PREFERRED_SKILLS = 5;

const quote = (s: string) => `"${s.trim().replace(/"/g, "")}"`;

const buildClauses = (job: BooleanQueryInput): string[] => {
  const clauses: string[] = [];

  for (const skill of job.mandatory_skills) {
    if (skill.trim()) clauses.push(quote(skill));
  }

  const preferred = job.preferred_skills.filter((s) => s.trim()).slice(0, MAX_PREFERRED_SKILLS);
  if (preferred.length > 0) {
    clauses.push(`(${preferred.map(quote).join(" OR ")})`);
  }

  if (job.title.trim()) clauses.push(quote(job.title));
  if (job.location.trim()) clauses.push(quote(job.location));

  return clauses;
};

export const generateBooleanQueries = (job: BooleanQueryInput): BooleanQueries => {
  const clauses = buildClauses(job);
  const query = clauses.join(" AND ");

  return {
    linkedin: clauses.length > 0 ? `site:linkedin.com/in ${query}` : "site:linkedin.com/in",
    generic: query,
  };
};
