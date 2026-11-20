import { Response } from "express";
import pool from "../../db";
import { invalidatePrefix } from "../../lib/cache";
import { extractFileText, parseResumeText } from "../parse/parse.utils";
import { saveResume } from "../../services/resumeStorage";
import { ExtRequest, UUID_RE } from "./linkedinStore";

/**
 * "Save to ZorHire": the extension sends the text of a profile page the recruiter is
 * looking at (Naukri Resdex, LinkedIn, or any other site) and ZorHire turns it into a
 * candidate. Two steps so the recruiter can check the fields first:
 *   POST /extension/capture/preview  -> extracted fields + possible duplicates
 *   POST /extension/capture/save     -> create (or update) the candidate, optionally add to a job
 *   POST /extension/candidates/:id/resume -> attach a resume file
 */

const fail = (res: Response, where: string, err: unknown) => {
  console.error(`capture ${where} error:`, err);
  res.status(500).json({ message: "Internal server error" });
};
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const SOURCES = new Set(["linkedin", "naukri", "indeed", "monster", "glassdoor", "other"]);
const digits = (p: string | null) => (p ? p.replace(/\D/g, "").slice(-10) : null);

/** Clean a profile URL to a stable form so the same person dedupes across visits. */
export function canonicalProfileUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    const li = u.pathname.match(/^\/in\/([^/]+)/);
    if (/linkedin\.com$/.test(u.hostname) && li) return `https://www.linkedin.com/in/${decodeURIComponent(li[1]).toLowerCase()}/`;
    u.hash = "";
    // Keep only id-like query params (Resdex profile links carry the profile id in the query).
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (/id|uniq|profile|cand/i.test(k)) keep.set(k, v);
    u.search = keep.toString();
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export interface CapturedFields {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  current_title: string | null;
  current_company: string | null;
  experience_years: number | null;
  current_location: string | null;
  preferred_location: string | null;
  notice_period_days: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  skills: string[];
  summary: string | null;
}

/** Possible matches: same profile link, email or phone; or same name at the same company. */
async function findDuplicates(tenantId: string, f: Partial<CapturedFields>, profileUrl: string | null) {
  const phone = digits(f.phone ?? null);
  const r = await pool.query(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.current_title, c.current_company, c.linkedin_url, c.created_at,
            NULLIF(TRIM(p.full_name), '') AS added_by,
            CASE WHEN $2::text IS NOT NULL AND c.linkedin_url = $2 THEN 'profile link'
                 WHEN $3::text IS NOT NULL AND LOWER(c.email) = LOWER($3) THEN 'email'
                 WHEN $4::text IS NOT NULL AND RIGHT(regexp_replace(COALESCE(c.phone,''), '\\D', '', 'g'), 10) = $4 THEN 'phone'
                 ELSE 'name and company' END AS matched_on,
            COALESCE((SELECT json_agg(json_build_object('job_id', j.id, 'job_title', j.title, 'stage', ja.stage) ORDER BY ja.updated_at DESC)
                        FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = c.id), '[]') AS applications
       FROM candidates c
       LEFT JOIN profiles p ON p.id = c.created_by
      WHERE c.tenant_id = $1 AND c.deleted_at IS NULL AND (
            ($2::text IS NOT NULL AND c.linkedin_url = $2)
         OR ($3::text IS NOT NULL AND $3 <> '' AND LOWER(c.email) = LOWER($3))
         OR ($4::text IS NOT NULL AND length($4) = 10 AND RIGHT(regexp_replace(COALESCE(c.phone,''), '\\D', '', 'g'), 10) = $4)
         OR ($5::text IS NOT NULL AND $6::text IS NOT NULL AND LOWER(c.first_name || ' ' || c.last_name) = LOWER($5) AND LOWER(c.current_company) = LOWER($6)))
      ORDER BY c.created_at DESC LIMIT 5`,
    [tenantId, profileUrl, f.email || null, phone && phone.length === 10 ? phone : null,
     f.first_name ? `${f.first_name} ${f.last_name ?? ""}`.trim() : null, f.current_company || null],
  );
  return r.rows;
}

/** Split "Java · Spring Boot · Kafka" style lists and drop things that aren't skills. */
export function cleanSkills(list: string[]): string[] {
  const out = new Map<string, string>();
  for (const item of list) {
    for (const part of String(item).split(/\s*[·•|,;\n]\s*/)) {
      const s = part.trim();
      if (!s || s.length > 40 || /@|https?:|www\.|\d{6,}/.test(s)) continue;
      if (!out.has(s.toLowerCase())) out.set(s.toLowerCase(), s);
    }
  }
  return [...out.values()].slice(0, 40);
}

/** LinkedIn experience lines read "Infosys · Full-time"; keep only the company. */
function cleanCompany(c: string | null | undefined): string | null {
  if (!c) return null;
  return c.replace(/\s*[·•]\s*.*$/, "").replace(/\s+(full-time|part-time|contract|internship|freelance|self-employed)$/i, "").trim() || null;
}

function splitName(name: string | null | undefined) {
  const parts = String(name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return { first: parts.shift() ?? "", last: parts.join(" ") };
}

/** POST /extension/capture/preview { url, source, pageText, hints: { name, headline, location, title, company } } */
export const capturePreview = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId } = req.ext!;
    const b = req.body ?? {};
    const pageText = typeof b.pageText === "string" ? b.pageText.slice(0, 40000) : "";
    if (pageText.trim().length < 40) return res.status(400).json({ message: "Not enough text on this page to read a profile." });
    const hints = b.hints ?? {};
    const parsed = await parseResumeText(pageText, tenantId);
    // What the page itself labels (name, headline) beats what the parser guesses.
    const name = splitName(str(hints.name, 150) ?? parsed.name);
    // Order of trust: explicit page fields, then the profile headline ("Title at Company"), then the parser.
    const headline = str(hints.headline, 300);
    const [hTitle, hCompany] = headline ? headline.split(/\s+(?:at|@)\s+/i).map((x) => x?.split("|")[0].trim() || null) : [null, null];
    const title = str(hints.title, 200) ?? hTitle ?? parsed.current_title ?? null;
    const company = str(hints.company, 200) ?? (hCompany || null) ?? cleanCompany(parsed.current_company) ?? null;
    const fields: CapturedFields = {
      first_name: name.first,
      last_name: name.last,
      email: str(hints.email, 200) ?? parsed.email ?? null,
      phone: str(hints.phone, 40) ?? (parsed.phone || null),
      current_title: title,
      current_company: company,
      experience_years: num(hints.experience_years) ?? num(parsed.experience_years),
      current_location: str(hints.location, 150) ?? parsed.current_location ?? null,
      preferred_location: parsed.preferred_location ?? null,
      notice_period_days: num(parsed.notice_period_days),
      current_ctc: num(parsed.current_ctc),
      expected_ctc: num(parsed.expected_ctc),
      skills: cleanSkills(parsed.skills ?? []),
      summary: (headline ? `${headline}\n\n` : "") + (parsed.summary ?? "").slice(0, 1500) || null,
    };
    const profileUrl = canonicalProfileUrl(str(b.url, 1000));
    const duplicates = await findDuplicates(tenantId, fields, profileUrl);
    res.json({ fields, profile_url: profileUrl, duplicates, low_confidence: parsed.low_confidence_fields ?? [], ai: parsed.parsed !== false });
  } catch (err) { fail(res, "preview", err); }
};

function readFields(f: any): CapturedFields {
  const skills = Array.isArray(f?.skills) ? f.skills : typeof f?.skills === "string" ? f.skills.split(",") : [];
  return {
    first_name: str(f?.first_name, 100) ?? "",
    last_name: str(f?.last_name, 100) ?? "",
    email: str(f?.email, 200),
    phone: str(f?.phone, 40),
    current_title: str(f?.current_title, 200),
    current_company: str(f?.current_company, 200),
    experience_years: num(f?.experience_years),
    current_location: str(f?.current_location, 150),
    preferred_location: str(f?.preferred_location, 150),
    notice_period_days: num(f?.notice_period_days),
    current_ctc: num(f?.current_ctc),
    expected_ctc: num(f?.expected_ctc),
    skills: skills.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 40),
    summary: str(f?.summary, 4000),
  };
}

/**
 * POST /extension/capture/save { url, source, fields, jobId?, candidateId? }
 * candidateId = update that existing candidate instead (only fills empty fields, never overwrites).
 */
export const captureSave = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const b = req.body ?? {};
    const f = readFields(b.fields);
    if (!f.first_name) return res.status(400).json({ message: "A name is needed to save the candidate." });
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) return res.status(400).json({ message: "That email address doesn't look right." });
    const source = SOURCES.has(b.source) ? b.source : "other";
    const profileUrl = canonicalProfileUrl(str(b.url, 1000));

    let jobId: string | null = null;
    if (b.jobId) {
      if (!UUID_RE.test(String(b.jobId))) return res.status(404).json({ message: "Job not found" });
      const j = await pool.query(`SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [b.jobId, tenantId]);
      if (!j.rows[0]) return res.status(404).json({ message: "Job not found" });
      jobId = j.rows[0].id;
    }

    let candidateId: string;
    let created = false;
    if (b.candidateId) {
      if (!UUID_RE.test(String(b.candidateId))) return res.status(404).json({ message: "Candidate not found" });
      const r = await pool.query(
        `UPDATE candidates SET
           email = COALESCE(NULLIF(email, ''), $3), phone = COALESCE(NULLIF(phone, ''), $4),
           current_title = COALESCE(NULLIF(current_title, ''), $5), current_company = COALESCE(NULLIF(current_company, ''), $6),
           experience_years = CASE WHEN COALESCE(experience_years, 0) = 0 THEN COALESCE($7, experience_years) ELSE experience_years END,
           current_location = COALESCE(NULLIF(current_location, ''), $8), preferred_location = COALESCE(NULLIF(preferred_location, ''), $9),
           current_ctc = COALESCE(current_ctc, $10), expected_ctc = COALESCE(expected_ctc, $11),
           skills = CASE WHEN COALESCE(array_length(skills, 1), 0) = 0 THEN $12 ELSE skills END,
           summary = COALESCE(NULLIF(summary, ''), $13), linkedin_url = COALESCE(linkedin_url, $14), updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id`,
        [b.candidateId, tenantId, f.email, f.phone, f.current_title, f.current_company, f.experience_years, f.current_location,
         f.preferred_location, f.current_ctc, f.expected_ctc, f.skills, f.summary, profileUrl],
      );
      if (!r.rows[0]) return res.status(404).json({ message: "Candidate not found" });
      candidateId = r.rows[0].id;
    } else {
      const dupes = await findDuplicates(tenantId, f, profileUrl);
      const hard = dupes.find((d) => d.matched_on !== "name and company");
      if (hard && b.force !== true) {
        return res.status(409).json({ message: `Already in ZorHire (matched on ${hard.matched_on}).`, duplicates: dupes });
      }
      const ins = await pool.query(
        `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years,
                                 current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary,
                                 source, linkedin_url, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,0),$9,$10,COALESCE($11,30),$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
        [tenantId, f.first_name, f.last_name || "-", f.email ?? "", f.phone, f.current_title, f.current_company, f.experience_years,
         f.current_location, f.preferred_location, f.notice_period_days, f.current_ctc, f.expected_ctc, f.skills, f.summary,
         source, profileUrl, userId],
      );
      candidateId = ins.rows[0].id;
      created = true;
    }

    let addedToJob = false;
    if (jobId) {
      const a = await pool.query(
        `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, assigned_to, created_at, updated_at)
         SELECT $1, $2, $3, 'sourced', $4, $5, now(), now()
          WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE job_id = $2 AND candidate_id = $3)
         RETURNING id`,
        [tenantId, jobId, candidateId, `Saved from ${source === "other" ? "the web" : source} with ZorHire Assistant`, userId],
      );
      addedToJob = !!a.rowCount;
    }
    await invalidatePrefix(`tenant:${tenantId}:candidates:`).catch(() => {});
    res.status(created ? 201 : 200).json({ candidate_id: candidateId, created, added_to_job: addedToJob });
  } catch (err) { fail(res, "save", err); }
};

/** POST /extension/candidates/:id/resume (multipart "resume") — attach the resume and fill empty fields from it. */
export const captureResume = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId } = req.ext!;
    const id = String(req.params.id);
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Attach a PDF, DOC, DOCX or TXT resume." });
    if (!UUID_RE.test(id)) return res.status(404).json({ message: "Candidate not found" });
    const c = await pool.query(`SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, tenantId]);
    if (!c.rows[0]) return res.status(404).json({ message: "Candidate not found" });
    // Same storage as the Add candidate form: private R2 bucket when configured, else local disk.
    const resumeUrl = await saveResume(tenantId, file);
    const text = await extractFileText(file).catch(() => "");
    const parsed = text ? await parseResumeText(text, tenantId) : {};
    const p = parsed as Record<string, any>;
    await pool.query(
      `UPDATE candidates SET resume_url = $3,
         email = COALESCE(NULLIF(email, ''), $4), phone = COALESCE(NULLIF(phone, ''), $5),
         skills = CASE WHEN COALESCE(array_length(skills, 1), 0) = 0 THEN COALESCE($6, skills) ELSE skills END,
         experience_years = CASE WHEN COALESCE(experience_years, 0) = 0 THEN COALESCE($7, experience_years) ELSE experience_years END,
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, resumeUrl, p.email ?? null, p.phone ?? null, Array.isArray(p.skills) && p.skills.length ? p.skills : null, num(p.experience_years)],
    );
    res.json({ ok: true, resume_url: resumeUrl });
  } catch (err) { fail(res, "resume", err); }
};

/** GET /extension/jobs?q= — open jobs for the "add to job" picker. */
export const extJobs = async (req: ExtRequest, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const r = await pool.query(
      `SELECT j.id, j.title, j.location, cl.name AS client_name FROM jobs j LEFT JOIN clients cl ON cl.id = j.client_id
        WHERE j.tenant_id = $1 AND j.deleted_at IS NULL AND j.status IN ('active','pending_review','on_hold','draft')
          AND ($2 = '' OR j.title ILIKE '%' || $2 || '%' OR cl.name ILIKE '%' || $2 || '%')
        ORDER BY (j.status = 'active') DESC, j.updated_at DESC LIMIT 50`,
      [req.ext!.tenantId, q],
    );
    res.json(r.rows);
  } catch (err) { fail(res, "jobs", err); }
};
