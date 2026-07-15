import path from "path";
import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { extractFileText, parseResumeText } from "../parse/parse.utils";
import { withCache, invalidate, invalidatePrefix } from "../../lib/cache";
import { embedText } from "../../services/embedding";

const buildEmbeddingInput = (candidate: {
  current_title?: string | null;
  current_company?: string | null;
  summary?: string | null;
  skills?: string[] | null;
}): string =>
  [candidate.current_title, candidate.current_company, candidate.summary, (candidate.skills || []).join(", ")]
    .filter(Boolean)
    .join(". ");

const toVectorLiteral = (embedding: number[]): string => `[${embedding.join(",")}]`;

/** Fire-and-forget — never blocks the candidate response, never throws into the caller. */
const embedCandidateAsync = (candidateId: string, tenantId: string, candidate: {
  current_title?: string | null;
  current_company?: string | null;
  summary?: string | null;
  skills?: string[] | null;
}): void => {
  const input = buildEmbeddingInput(candidate);
  if (!input.trim()) return;
  embedText(input, "RETRIEVAL_DOCUMENT", tenantId, "candidate")
    .then((embedding) => {
      if (!embedding) return;
      return pool.query(
        `UPDATE candidates SET embedding = $1::vector, embedding_updated_at = now() WHERE id = $2`,
        [toVectorLiteral(embedding), candidateId],
      );
    })
    .catch((err) => console.error("[Candidate embedding] Failed:", err instanceof Error ? err.message : err));
};

function buildCandidateCacheKey(tenantId: string, query: Record<string, any>): string {
  const suffix = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `tenant:${tenantId}:candidates:${suffix}`;
}

const normalizeSkills = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
    }
  }
  return [];
};

export const getCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { search, location, skills, min_experience, max_experience } = req.query;

    const cacheKey = buildCandidateCacheKey(tenantId!, req.query as Record<string, any>);

    const rows = await withCache(cacheKey, 120, async () => {
      const filters: string[] = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: any[] = [tenantId];

      if (search) {
        const q = String(search);
        const booleanQuery = q
          .replace(/\bAND\b/gi, '&')
          .replace(/\bOR\b/gi, '|')
          .replace(/\bNOT\b/gi, '& !')
          .split(/\s+/)
          .filter(w => !['&', '|', '!', '&!'].includes(w))
          .map(w => /^[&|!]/.test(w) ? w : "'" + w.replace(/'/g, '') + "'")
          .join(' ');
        params.push(booleanQuery || "'" + q.replace(/'/g, '') + "'");
        const idxTs = params.length;
        params.push('%' + q + '%');
        const idxIlike = params.length;
        filters.push(
          `(to_tsvector('english', COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(skills::text,'') || ' ' || COALESCE(current_title,''))
            @@ to_tsquery('english', $${idxTs}) OR
            first_name ILIKE $${idxIlike} OR last_name ILIKE $${idxIlike} OR email ILIKE $${idxIlike})`
        );
      }

      if (location) {
        params.push(`%${String(location).toLowerCase()}%`);
        filters.push(`LOWER(current_location) LIKE $${params.length}`);
      }

      if (skills) {
        String(skills)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((skill) => {
            params.push(skill.toLowerCase());
            filters.push(
              `EXISTS (SELECT 1 FROM unnest(skills) s WHERE LOWER(s) = $${params.length})`,
            );
          });
      }

      if (min_experience) {
        params.push(Number(min_experience));
        filters.push(`experience_years >= $${params.length}`);
      }

      if (max_experience) {
        params.push(Number(max_experience));
        filters.push(`experience_years <= $${params.length}`);
      }

      const sql = `SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC`;
      const result = await pool.query(sql, params);
      return result.rows;
    });

    res.json(rows);
    (async () => {
      try {
        if (search || Object.keys(req.query).length > 0) {
          await pool.query(
            'INSERT INTO search_history(tenant_id,user_id,query_text,filters,result_count) VALUES($1,$2,$3,$4,$5)',
            [tenantId, req.user?.id, search || '', req.query, rows.length]
          );
        }
      } catch (e) {}
    })();
  } catch (error) {
    console.error("Get candidates error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCandidateById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createCandidate = async (req: AuthRequest, res: Response) => {
  const file = req.file;
  const body = req.body || {};
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  const resumeText =
    (file ? await extractFileText(file) : "") + " " + (body.resume_text || "");
  const parsed = await parseResumeText(resumeText, tenantId!);

  const first_name =
    body.first_name || parsed.name?.split(" ")[0] || "Candidate";
  const last_name =
    body.last_name || parsed.name?.split(" ").slice(1).join(" ") || "Profile";
  const email = body.email || parsed.email;
  const phone = body.phone || parsed.phone;
  const current_title = body.current_title || parsed.current_title || "";
  const current_company = body.current_company || parsed.current_company || "";
  const experience_years = Number(
    body.experience_years || parsed.experience_years || 0,
  );
  const current_location =
    body.current_location || parsed.current_location || "";
  const preferred_location = body.preferred_location || parsed.preferred_location || "";
  const notice_period_days = Number(body.notice_period_days || parsed.notice_period_days || 30);
  const current_ctc = body.current_ctc ? Number(body.current_ctc) : parsed.current_ctc ?? null;
  const expected_ctc = body.expected_ctc ? Number(body.expected_ctc) : parsed.expected_ctc ?? null;
  const skills = normalizeSkills(body.skills || parsed.skills);
  const summary = body.summary || parsed.summary || "";
  const source = body.source || "direct";
  const gdpr_consent =
    body.gdpr_consent === "true" || body.gdpr_consent === true;
  const resumeUrl = file
    ? `/uploads/resumes/${path.basename(file.path)}`
    : body.resume_url || null;

  try {
    if (!email && !phone) {
      return res.status(400).json({
        message: "At least email or phone is required for candidate creation",
      });
    }

    const duplicateResult = await pool.query(
      `SELECT id FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL AND (LOWER(email) = LOWER($2) OR (phone IS NOT NULL AND phone = $3)) LIMIT 1`,
      [tenantId, email, phone],
    );
    if (duplicateResult.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "Candidate with this email or phone already exists" });
    }

    const result = await pool.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, resume_url, source, gdpr_consent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        tenantId,
        first_name,
        last_name,
        email,
        phone,
        current_title,
        current_company,
        experience_years,
        current_location,
        preferred_location,
        notice_period_days,
        current_ctc,
        expected_ctc,
        skills,
        summary,
        resumeUrl,
        source,
        gdpr_consent,
        createdBy,
      ],
    );
    await invalidatePrefix(`tenant:${tenantId}:candidates:`);
    embedCandidateAsync(result.rows[0].id, tenantId!, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const file = req.file;
  const body = req.body || {};
  const tenantId = req.user?.tenant_id;

  const resumeUrl = file
    ? `/uploads/resumes/${path.basename(file.path)}`
    : body.resume_url;
  const skills = normalizeSkills(body.skills);

  try {
    const result = await pool.query(
      `UPDATE candidates SET 
       first_name = COALESCE($1, first_name),
       last_name = COALESCE($2, last_name),
       email = COALESCE($3, email),
       phone = COALESCE($4, phone),
       current_title = COALESCE($5, current_title),
       current_company = COALESCE($6, current_company),
       experience_years = COALESCE($7, experience_years),
       current_location = COALESCE($8, current_location),
       preferred_location = COALESCE($9, preferred_location),
       notice_period_days = COALESCE($10, notice_period_days),
       current_ctc = COALESCE($11, current_ctc),
       expected_ctc = COALESCE($12, expected_ctc),
       skills = COALESCE($13, skills),
       summary = COALESCE($14, summary),
       resume_url = COALESCE($15, resume_url),
       source = COALESCE($16, source),
       is_active = COALESCE($17, is_active),
       updated_at = now()
       WHERE id = $18 AND tenant_id = $19 AND deleted_at IS NULL
       RETURNING *`,
      [
        body.first_name,
        body.last_name,
        body.email,
        body.phone,
        body.current_title,
        body.current_company,
        body.experience_years ? Number(body.experience_years) : undefined,
        body.current_location,
        body.preferred_location,
        body.notice_period_days ? Number(body.notice_period_days) : undefined,
        body.current_ctc ? Number(body.current_ctc) : undefined,
        body.expected_ctc ? Number(body.expected_ctc) : undefined,
        skills.length > 0 ? skills : undefined,
        body.summary,
        resumeUrl,
        body.source,
        body.is_active,
        id,
        tenantId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    await invalidatePrefix(`tenant:${tenantId}:candidates:`);
    embedCandidateAsync(result.rows[0].id, tenantId!, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "UPDATE candidates SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    await invalidatePrefix(`tenant:${tenantId}:candidates:`);
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Delete candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── helpers ────────────────────────────────────────────────────────────────

const EXPERIENCE_RANGES: Record<string, [number, number | null]> = {
  "0-3 yrs": [0, 3],
  "3-7 yrs": [3, 7],
  "7+ yrs": [7, null],
};

function buildSearchFilters(
  tenantId: string,
  query: Record<string, any>,
): { filters: string[]; params: any[] } {
  const { location, experience, noticePeriod } = query;
  // NOTE: intentionally omits is_active filter — matches getCandidates behaviour
  // and avoids excluding rows where is_active IS NULL (no NOT NULL on schema)
  const filters: string[] = ["tenant_id = $1", "deleted_at IS NULL"];
  const params: any[] = [tenantId];

  if (location && location !== "All") {
    params.push(`%${String(location).toLowerCase()}%`);
    filters.push(`LOWER(current_location) LIKE $${params.length}`);
  }

  if (experience && experience !== "All") {
    const range = EXPERIENCE_RANGES[String(experience)];
    if (range) {
      params.push(range[0]);
      filters.push(`experience_years >= $${params.length}`);
      if (range[1] !== null) {
        params.push(range[1]);
        filters.push(`experience_years <= $${params.length}`);
      }
    }
  }

  if (noticePeriod && noticePeriod !== "Any") {
    if (noticePeriod === "< 30 days") {
      filters.push("notice_period_days < 30");
    } else if (noticePeriod === "30-60 days") {
      filters.push("notice_period_days BETWEEN 30 AND 60");
    } else if (noticePeriod === "60+ days") {
      filters.push("notice_period_days > 60");
    }
  }

  return { filters, params };
}

function normalizeSkillsArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).toLowerCase());
  }
  // pg may return a PostgreSQL array literal string e.g. '{React,"Node.js"}'
  if (typeof raw === "string" && raw.startsWith("{") && raw.endsWith("}")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((s) => s.replace(/^"|"$/g, "").trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function scoreCandidate(candidate: any, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 100;

  const skills = normalizeSkillsArray(candidate.skills);
  const title = (candidate.current_title || "").toLowerCase();
  const summary = (candidate.summary || "").toLowerCase();

  let skillMatches = 0;
  let titleMatch = false;
  let summaryMatch = false;

  for (const term of queryTerms) {
    if (skills.some((s) => s.includes(term) || term.includes(s)))
      skillMatches++;
    if (title.includes(term)) titleMatch = true;
    if (summary.includes(term)) summaryMatch = true;
  }

  return Math.min(
    98,
    50 + skillMatches * 12 + (titleMatch ? 25 : 0) + (summaryMatch ? 10 : 0),
  );
}

// ─── boolean search helpers ──────────────────────────────────────────────────

function parseBooleanQuery(queryStr: string): {
  mustHave: string[];
  shouldHave: string[];
  mustNot: string[];
} {
  const mustHave: string[] = [];
  const shouldHave: string[] = [];
  const mustNot: string[] = [];
  const tokens = queryStr.trim().split(/\s+/);
  let nextOp: "AND" | "OR" | "NOT" = "AND";

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (upper === "AND") { nextOp = "AND"; continue; }
    if (upper === "OR")  { nextOp = "OR";  continue; }
    if (upper === "NOT") { nextOp = "NOT"; continue; }
    const term = token.replace(/[()]/g, "").toLowerCase().trim();
    if (!term) continue;
    if (nextOp === "NOT")     mustNot.push(term);
    else if (nextOp === "OR") shouldHave.push(term);
    else                      mustHave.push(term);
    nextOp = "AND";
  }
  return { mustHave, shouldHave, mustNot };
}

function matchesBooleanQuery(
  candidate: any,
  mustHave: string[],
  shouldHave: string[],
  mustNot: string[],
): boolean {
  const skills = normalizeSkillsArray(candidate.skills);
  const text = [
    candidate.first_name ?? "",
    candidate.last_name ?? "",
    candidate.current_title ?? "",
    candidate.current_company ?? "",
    candidate.summary ?? "",
    ...skills,
  ].join(" ").toLowerCase();

  if (mustNot.some((t) => text.includes(t))) return false;
  if (!mustHave.every((t) => text.includes(t))) return false;
  if (shouldHave.length > 0) {
    if (mustHave.length === 0) return shouldHave.some((t) => text.includes(t));
    if (!shouldHave.some((t) => text.includes(t))) return false;
  }
  return true;
}

// ─── search ─────────────────────────────────────────────────────────────────

export const searchCandidates = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  const rawPage = req.query.page;
  const rawLimit = req.query.limit;
  const rawQuery = req.query.query;

  const pageNum = Math.max(1, parseInt(String(rawPage ?? "1"), 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(String(rawLimit ?? "10"), 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  try {
    const { filters, params } = buildSearchFilters(tenantId, req.query as any);

    const dbResult = await pool.query(
      `SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );

    const queryStr = String(rawQuery ?? "").trim();
    let withScores: Array<{ candidate: any; score: number }>;

    if (queryStr.length === 0) {
      withScores = dbResult.rows.map((c) => ({ candidate: c, score: 100 }));
    } else if (/\b(AND|OR|NOT)\b/i.test(queryStr)) {
      // True boolean mode: parse AND/OR/NOT operators
      const { mustHave, shouldHave, mustNot } = parseBooleanQuery(queryStr);
      const scoreTerms = [...mustHave, ...shouldHave];
      withScores = dbResult.rows
        .filter((c) => matchesBooleanQuery(c, mustHave, shouldHave, mustNot))
        .map((c) => ({ candidate: c, score: scoreCandidate(c, scoreTerms) }))
        .sort((a, b) => b.score - a.score);
    } else {
      // Plain text: all words treated as AND (all must appear somewhere)
      const queryTerms = queryStr
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[()]/g, "").trim())
        .filter(Boolean);
      withScores = dbResult.rows
        .map((c) => ({ candidate: c, score: scoreCandidate(c, queryTerms) }))
        .filter((r) => r.score > 55)
        .sort((a, b) => b.score - a.score);
    }

    const total = withScores.length;
    const paginated = withScores.slice(offset, offset + limitNum);

    // Fire-and-forget: record this search in history (only when there's something meaningful)
    const userId = req.user?.id;
    if (userId && (queryStr.length > 0 || req.query.location || req.query.experience || req.query.noticePeriod)) {
      const histFilters = {
        location: req.query.location ?? null,
        experience: req.query.experience ?? null,
        noticePeriod: req.query.noticePeriod ?? null,
      };
      (async () => {
        try {
          await pool.query(
            `INSERT INTO search_history (tenant_id, user_id, query, filters, result_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, userId, queryStr, JSON.stringify(histFilters), total],
          );
          // Prune to last 20 per user
          await pool.query(
            `DELETE FROM search_history
             WHERE user_id = $1 AND tenant_id = $2
               AND id NOT IN (
                 SELECT id FROM search_history
                 WHERE user_id = $1 AND tenant_id = $2
                 ORDER BY created_at DESC LIMIT 20
               )`,
            [userId, tenantId],
          );
        } catch {}
      })();
    }

    return res.json({
      results: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error: any) {
    console.error("[searchCandidates] Error:", error?.message);
    console.error("[searchCandidates] Stack:", error?.stack);
    return res.status(500).json({
      message: "Search failed",
      error: process.env.NODE_ENV !== "production" ? error?.message : undefined,
    });
  }
};

// ─── search history ──────────────────────────────────────────────────────────

export const getSearchHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT * FROM search_history
       WHERE user_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC LIMIT 10`,
      [userId, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get search history error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── GDPR right-to-erasure ───────────────────────────────────────────────────

export const purgeCandidatePII = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `UPDATE candidates SET
         first_name         = 'GDPR',
         last_name          = 'Erased',
         email              = 'erased_' || id || '@gdpr.removed',
         phone              = NULL,
         current_title      = NULL,
         current_company    = NULL,
         resume_url         = NULL,
         summary            = 'Data erased per GDPR right-to-erasure request.',
         skills             = '{}',
         current_location   = NULL,
         preferred_location = NULL,
         deleted_at         = now(),
         updated_at         = now()
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    await invalidatePrefix(`tenant:${tenantId}:candidates:`);
    res.json({ message: "Candidate PII permanently erased per GDPR right-to-erasure." });
  } catch (error) {
    console.error("Purge candidate PII error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── timeline ───────────────────────────────────────────────────────────────

export const getCandidateTimeline = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT
         ja.id,
         ja.stage,
         ja.notes,
         ja.ai_score,
         ja.created_at,
         ja.updated_at,
         j.id        AS job_id,
         j.title     AS job_title,
         j.location  AS job_location,
         COALESCE(
           json_agg(
             json_build_object(
               'id',               i.id,
               'type',             i.interview_type,
               'scheduled_at',     i.scheduled_at,
               'status',           i.status,
               'interviewer_name', i.interviewer_name,
               'duration_minutes', i.duration_minutes
             ) ORDER BY i.scheduled_at
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS interviews
       FROM job_applications ja
       JOIN jobs j ON j.id = ja.job_id
       LEFT JOIN interviews i ON i.application_id = ja.id
       WHERE ja.candidate_id = $1 AND ja.tenant_id = $2
       GROUP BY ja.id, j.id
       ORDER BY ja.created_at DESC`,
      [id, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get candidate timeline error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── export ─────────────────────────────────────────────────────────────────

export const exportCandidates = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id!;

  try {
    const { filters, params } = buildSearchFilters(tenantId, req.query as any);

    const dbResult = await pool.query(
      `SELECT first_name, last_name, email, phone, current_title, current_company,
              experience_years, current_location, notice_period_days, expected_ctc,
              skills, source, created_at
       FROM candidates
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC`,
      params,
    );

    const rows = dbResult.rows.map((r) => ({
      ...r,
      skills: Array.isArray(r.skills) ? r.skills.join(", ") : r.skills,
    }));

    // Lazy require avoids module-level import issues with json2csv v5 (see git: "fix: import issue of json2csv")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Parser: CsvParser } = require("json2csv");
    const parser = new CsvParser({
      fields: [
        "first_name",
        "last_name",
        "email",
        "phone",
        "current_title",
        "current_company",
        "experience_years",
        "current_location",
        "notice_period_days",
        "expected_ctc",
        "skills",
        "source",
        "created_at",
      ],
    });
    const csv = parser.parse(rows);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="candidates_export.csv"',
    );
    res.send(csv);
  } catch (error) {
    console.error("Export candidates error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── engagement history ─────────────────────────────────────────────────────

export const getCandidateEngagement = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    // Verify candidate belongs to tenant
    const check = await pool.query(
      "SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const [pipelineEvents, interviews, manualLogs] = await Promise.all([
      // Pipeline stage changes across all job applications
      pool.query(
        `SELECT
           pe.id, pe.from_stage, pe.to_stage, pe.note, pe.created_at,
           j.title AS job_title,
           u.email AS changed_by_email
         FROM pipeline_events pe
         JOIN job_applications ja ON ja.id = pe.application_id
         JOIN jobs j ON j.id = ja.job_id
         LEFT JOIN users u ON u.id = pe.changed_by
         WHERE ja.candidate_id = $1 AND pe.tenant_id = $2
         ORDER BY pe.created_at DESC
         LIMIT 100`,
        [id, tenantId],
      ),
      // All interviews scheduled for this candidate
      pool.query(
        `SELECT
           i.id, i.interview_type, i.scheduled_at, i.status,
           i.interviewer_name, i.feedback_score, i.feedback_locked,
           j.title AS job_title
         FROM interviews i
         JOIN job_applications ja ON ja.id = i.application_id
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.candidate_id = $1 AND i.tenant_id = $2
         ORDER BY i.scheduled_at DESC
         LIMIT 50`,
        [id, tenantId],
      ),
      // Manual engagement logs (calls, notes, etc.)
      pool.query(
        `SELECT
           cel.id, cel.event_type, cel.summary, cel.meta, cel.created_at,
           p.full_name AS actor_name
         FROM candidate_engagement_logs cel
         LEFT JOIN profiles p ON p.id = cel.actor_id
         WHERE cel.candidate_id = $1 AND cel.tenant_id = $2
         ORDER BY cel.created_at DESC
         LIMIT 100`,
        [id, tenantId],
      ),
    ]);

    res.json({
      pipeline_events: pipelineEvents.rows,
      interviews: interviews.rows,
      manual_logs: manualLogs.rows,
    });
  } catch (error) {
    console.error("getCandidateEngagement error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logEngagementEvent = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  const actorId = req.user?.id;
  const { event_type, summary, meta } = req.body;

  const validTypes = ["call_logged", "note", "email_sent"];
  if (!validTypes.includes(event_type)) {
    return res.status(400).json({ message: `event_type must be one of: ${validTypes.join(", ")}` });
  }
  if (!summary) {
    return res.status(400).json({ message: "summary is required" });
  }

  try {
    const check = await pool.query(
      "SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [id, tenantId],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const result = await pool.query(
      `INSERT INTO candidate_engagement_logs (tenant_id, candidate_id, actor_id, event_type, summary, meta)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, id, actorId, event_type, summary, meta ? JSON.stringify(meta) : "{}"],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("logEngagementEvent error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
