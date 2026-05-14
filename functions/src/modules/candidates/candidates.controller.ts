import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";
import { extractFileText, parseResumeText } from "../parse/parse.utils";

const normalizeSkills = (value: any) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
    }
  }
  return [];
};

export const getCandidates = async (req: AuthRequest, res: Response) => {
  try {
    const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
    const { search, location, skills, min_experience, max_experience, limit, offset } = req.query;
    const filters: string[] = ["($1::uuid IS NULL OR tenant_id = $1)", "deleted_at IS NULL"];
    const params: any[] = [filterTenantId];

    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      filters.push(
        `(LOWER(first_name) LIKE $${params.length} OR LOWER(last_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(current_title) LIKE $${params.length} OR LOWER(current_company) LIKE $${params.length} OR LOWER(current_location) LIKE $${params.length})`,
      );
    }
    if (location) {
      params.push(`%${String(location).toLowerCase()}%`);
      filters.push(`LOWER(current_location) LIKE $${params.length}`);
    }
    if (skills) {
      String(skills).split(",").map((item) => item.trim()).filter(Boolean).forEach((skill) => {
        params.push(skill.toLowerCase());
        filters.push(`EXISTS (SELECT 1 FROM unnest(skills) s WHERE LOWER(s) = $${params.length})`);
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

    if (!req.user?.is_platform_owner && req.user?.role === "recruiter" && req.user?.id) {
      params.push(req.user.id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_recruiter_id = $${params.length} AND ($1::uuid IS NULL OR j.tenant_id = $1) AND j.deleted_at IS NULL)`,
      );
    }
    if (!req.user?.is_platform_owner &&
        (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") &&
        req.user?.vendor_id) {
      params.push(req.user.vendor_id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_vendor_id = $${params.length} AND ($1::uuid IS NULL OR j.tenant_id = $1) AND j.deleted_at IS NULL)`,
      );
    }
    const limitVal = Math.min(Number(limit) || 500, 500);
    const offsetVal = Math.max(Number(offset) || 0, 0);
    params.push(limitVal, offsetVal);

    const db = await getAtsPool(filterTenantId);
    const queryStr = `SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    const result = await db.query(queryStr, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Get candidates error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCandidateById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
  try {
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      "SELECT * FROM candidates WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [id, filterTenantId],
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
  try {
    const file = req.file;
    const body = req.body || {};
    const tenantId = req.user?.tenant_id;
    const createdBy = req.user?.id;

    // extractFileText can throw (pdf-parse/mammoth failures); keep inside try/catch
    // so errors return 500 rather than reaching the global 400 handler.
    const resumeText =
      (file ? await extractFileText(file) : "") + " " + (body.resume_text || "");
    const parsed = await parseResumeText(resumeText);

    const first_name = body.first_name || parsed.name?.split(" ")[0] || "Candidate";
    const last_name = body.last_name || parsed.name?.split(" ").slice(1).join(" ") || "Profile";
    // Trim and convert empty strings to null so pg never receives undefined
    const email = (body.email || parsed.email || "").trim() || null;
    const phone = (body.phone || parsed.phone || "").trim() || null;
    const current_title = body.current_title || parsed.current_title || "";
    const current_company = body.current_company || parsed.current_company || "";
    const experience_years = Number(body.experience_years || parsed.experience_years || 0);
    const current_location = body.current_location || parsed.current_location || "";
    const preferred_location = body.preferred_location || "";
    const notice_period_days = Number(body.notice_period_days || 30);
    const current_ctc = body.current_ctc ? Number(body.current_ctc) : null;
    const expected_ctc = body.expected_ctc ? Number(body.expected_ctc) : null;
    const skills = normalizeSkills(body.skills || parsed.skills);
    const summary = body.summary || parsed.summary || "";
    const source = body.source || "direct";
    const gdpr_consent = body.gdpr_consent === "true" || body.gdpr_consent === true;

    if (!email && !phone) {
      return res.status(400).json({
        message: "At least email or phone is required for candidate creation",
      });
    }

    const db = await getAtsPool(tenantId);

    const duplicateResult = await db.query(
      `SELECT id FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL AND (email IS NOT NULL AND LOWER(email) = LOWER($2) OR phone IS NOT NULL AND phone = $3) LIMIT 1`,
      [tenantId, email ?? "", phone ?? ""],
    );
    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({ message: "Candidate with this email or phone already exists" });
    }

    const insertResult = await db.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, source, gdpr_consent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        tenantId, first_name, last_name, email, phone, current_title, current_company,
        experience_years, current_location, preferred_location, notice_period_days,
        current_ctc, expected_ctc, skills, summary, source, gdpr_consent, createdBy,
      ],
    );

    let candidate = insertResult.rows[0];

    if (file?.buffer) {
      const resumeUrl = `/candidates/${candidate.id}/resume`;
      const updated = await db.query(
        `UPDATE candidates SET resume_url = $1, resume_data = $2, resume_mime_type = $3 WHERE id = $4 RETURNING *`,
        [resumeUrl, file.buffer, file.mimetype || "application/octet-stream", candidate.id],
      );
      candidate = updated.rows[0];
    }

    res.status(201).json(candidate);
  } catch (error: any) {
    console.error("Create candidate error:", error);
    res.status(500).json({ message: error?.message || "Internal server error" });
  }
};

export const updateCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const file = req.file;
  const body = req.body || {};
  const tenantId = req.user?.tenant_id;
  const skills = normalizeSkills(body.skills);
  const resumeUrl = file?.buffer ? `/candidates/${id}/resume` : body.resume_url;

  try {
    const db = await getAtsPool(tenantId);

    // vendor_user / vendor_manager can only update candidates linked to their assigned jobs
    if (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") {
      const assigned = await db.query(
        `SELECT 1 FROM job_applications ja
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.candidate_id = $1 AND j.assigned_vendor_id = $2 AND ja.tenant_id = $3
         LIMIT 1`,
        [id, req.user.vendor_id, tenantId],
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ message: "Forbidden: Candidate is not on a job assigned to your vendor" });
      }
    }
    if (req.user?.role === "recruiter") {
      const assigned = await db.query(
        `SELECT 1 FROM job_applications ja
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.candidate_id = $1 AND j.assigned_recruiter_id = $2 AND ja.tenant_id = $3
         LIMIT 1`,
        [id, req.user.id, tenantId],
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ message: "Forbidden: Candidate is not on a job assigned to you" });
      }
    }
    const result = await db.query(
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
       resume_data = COALESCE($16, resume_data),
       resume_mime_type = COALESCE($17, resume_mime_type),
       source = COALESCE($18, source),
       is_active = COALESCE($19, is_active),
       updated_at = now()
       WHERE id = $20 AND tenant_id = $21 AND deleted_at IS NULL
       RETURNING *`,
      [
        body.first_name, body.last_name, body.email, body.phone, body.current_title,
        body.current_company, body.experience_years ? Number(body.experience_years) : undefined,
        body.current_location, body.preferred_location,
        body.notice_period_days ? Number(body.notice_period_days) : undefined,
        body.current_ctc ? Number(body.current_ctc) : undefined,
        body.expected_ctc ? Number(body.expected_ctc) : undefined,
        skills.length > 0 ? skills : undefined,
        body.summary,
        resumeUrl ?? undefined,
        file?.buffer ?? undefined,
        file?.buffer ? (file.mimetype || "application/octet-stream") : undefined,
        body.source, body.is_active, id, tenantId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getResumeFile = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const db = await getAtsPool(tenantId);
    const result = await db.query(
      `SELECT resume_data, resume_mime_type FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    const row = result.rows[0];
    if (!row || !row.resume_data) {
      return res.status(404).json({ message: "No resume file stored for this candidate" });
    }
    res.setHeader("Content-Type", row.resume_mime_type || "application/pdf");
    res.setHeader("Content-Disposition", "inline");
    res.send(row.resume_data);
  } catch (error) {
    console.error("Get resume error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteCandidate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const db = await getAtsPool(tenantId);

    // vendor_user / vendor_manager can only delete candidates linked to their assigned jobs
    if (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") {
      const assigned = await db.query(
        `SELECT 1 FROM job_applications ja
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.candidate_id = $1 AND j.assigned_vendor_id = $2 AND ja.tenant_id = $3
         LIMIT 1`,
        [id, req.user.vendor_id, tenantId],
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ message: "Forbidden: Candidate is not on a job assigned to your vendor" });
      }
    }
    if (req.user?.role === "recruiter") {
      const assigned = await db.query(
        `SELECT 1 FROM job_applications ja
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.candidate_id = $1 AND j.assigned_recruiter_id = $2 AND ja.tenant_id = $3
         LIMIT 1`,
        [id, req.user.id, tenantId],
      );
      if (assigned.rows.length === 0) {
        return res.status(403).json({ message: "Forbidden: Candidate is not on a job assigned to you" });
      }
    }

    const result = await db.query(
      "UPDATE candidates SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id",
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Delete candidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── search helpers ──────────────────────────────────────────────────────────

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
  // NOTE: intentionally omits is_active — matches getCandidates behaviour
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
    if (skills.some((s) => s.includes(term) || term.includes(s))) skillMatches++;
    if (title.includes(term)) titleMatch = true;
    if (summary.includes(term)) summaryMatch = true;
  }
  return Math.min(98, 50 + skillMatches * 12 + (titleMatch ? 25 : 0) + (summaryMatch ? 10 : 0));
}

// ─── search ──────────────────────────────────────────────────────────────────

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

    if (req.user?.role === "recruiter" && req.user?.id) {
      params.push(req.user.id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_recruiter_id = $${params.length} AND j.tenant_id = $1 AND j.deleted_at IS NULL)`,
      );
    }
    if ((req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") && req.user?.vendor_id) {
      params.push(req.user.vendor_id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_vendor_id = $${params.length} AND j.tenant_id = $1 AND j.deleted_at IS NULL)`,
      );
    }

    const db = await getAtsPool(tenantId);
    const dbResult = await db.query(
      `SELECT * FROM candidates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );

    const queryStr = String(rawQuery ?? "").trim();
    const queryTerms = queryStr.length === 0
      ? []
      : queryStr
          .toLowerCase()
          .split(/\s+(?:AND|OR|NOT)\s+|\s+/i)
          .map((t) => t.replace(/[()]/g, "").trim())
          .filter(Boolean);

    let withScores: Array<{ candidate: any; score: number }>;

    if (queryTerms.length === 0) {
      withScores = dbResult.rows.map((c) => ({ candidate: c, score: 100 }));
    } else {
      withScores = dbResult.rows
        .map((c) => ({ candidate: c, score: scoreCandidate(c, queryTerms) }))
        .filter((r) => r.score > 55)
        .sort((a, b) => b.score - a.score);
    }

    const total = withScores.length;
    const paginated = withScores.slice(offset, offset + limitNum);

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

// ─── create candidate in job context ─────────────────────────────────────────

export const createCandidateForJob = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  try {
    const db = await getAtsPool(tenantId);

    const jobCheck = await db.query(
      "SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [jobId, tenantId],
    );
    if (jobCheck.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (req.user?.role === "recruiter") {
      const recruiterCheck = await db.query(
        "SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND assigned_recruiter_id = $3",
        [jobId, tenantId, req.user.id],
      );
      if (recruiterCheck.rows.length === 0) {
        return res.status(403).json({ message: "Access denied: Job not assigned to you" });
      }
    }

    if (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") {
      const vendorCheck = await db.query(
        "SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND assigned_vendor_id = $3",
        [jobId, tenantId, req.user.vendor_id],
      );
      if (vendorCheck.rows.length === 0) {
        return res.status(403).json({ message: "Access denied: Job not assigned to your vendor" });
      }
    }

    const file = req.file;
    const body = req.body || {};

    const resumeText =
      (file ? await extractFileText(file) : "") + " " + (body.resume_text || "");
    const parsed = await parseResumeText(resumeText);

    const first_name = body.first_name || parsed.name?.split(" ")[0] || "Candidate";
    const last_name = body.last_name || parsed.name?.split(" ").slice(1).join(" ") || "Profile";
    const email = (body.email || parsed.email || "").trim() || null;
    const phone = (body.phone || parsed.phone || "").trim() || null;
    const current_title = body.current_title || parsed.current_title || "";
    const current_company = body.current_company || parsed.current_company || "";
    const experience_years = Number(body.experience_years || parsed.experience_years || 0);
    const current_location = body.current_location || parsed.current_location || "";
    const preferred_location = body.preferred_location || "";
    const notice_period_days = Number(body.notice_period_days || 30);
    const current_ctc = body.current_ctc ? Number(body.current_ctc) : null;
    const expected_ctc = body.expected_ctc ? Number(body.expected_ctc) : null;
    const skills = normalizeSkills(body.skills || parsed.skills);
    const summary = body.summary || parsed.summary || "";
    const source = body.source || "direct";
    const gdpr_consent = body.gdpr_consent === "true" || body.gdpr_consent === true;

    if (!email && !phone) {
      return res.status(400).json({
        message: "At least email or phone is required for candidate creation",
      });
    }

    const duplicateResult = await db.query(
      `SELECT id FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL AND (email IS NOT NULL AND LOWER(email) = LOWER($2) OR phone IS NOT NULL AND phone = $3) LIMIT 1`,
      [tenantId, email ?? "", phone ?? ""],
    );
    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({ message: "Candidate with this email or phone already exists" });
    }

    const insertResult = await db.query(
      `INSERT INTO candidates (tenant_id, first_name, last_name, email, phone, current_title, current_company, experience_years, current_location, preferred_location, notice_period_days, current_ctc, expected_ctc, skills, summary, source, gdpr_consent, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        tenantId, first_name, last_name, email, phone, current_title, current_company,
        experience_years, current_location, preferred_location, notice_period_days,
        current_ctc, expected_ctc, skills, summary, source, gdpr_consent, createdBy,
      ],
    );

    let candidate = insertResult.rows[0];

    if (file?.buffer) {
      const resumeUrl = `/candidates/${candidate.id}/resume`;
      const updated = await db.query(
        `UPDATE candidates SET resume_url = $1, resume_data = $2, resume_mime_type = $3 WHERE id = $4 RETURNING *`,
        [resumeUrl, file.buffer, file.mimetype || "application/octet-stream", candidate.id],
      );
      candidate = updated.rows[0];
    }

    const appResult = await db.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, assigned_to)
       VALUES ($1, $2, $3, 'new', $4)
       ON CONFLICT (tenant_id, job_id, candidate_id) DO NOTHING
       RETURNING *`,
      [tenantId, jobId, candidate.id, createdBy],
    );

    res.status(201).json({
      candidate,
      application: appResult.rows[0] ?? null,
    });
  } catch (error: any) {
    console.error("createCandidateForJob error:", error);
    res.status(500).json({ message: error?.message || "Internal server error" });
  }
};

// ─── export ──────────────────────────────────────────────────────────────────

export const exportCandidates = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  try {
    const { filters, params } = buildSearchFilters(tenantId, req.query as any);

    if (req.user?.role === "recruiter" && req.user?.id) {
      params.push(req.user.id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_recruiter_id = $${params.length} AND j.tenant_id = $1 AND j.deleted_at IS NULL)`,
      );
    }
    if ((req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") && req.user?.vendor_id) {
      params.push(req.user.vendor_id);
      filters.push(
        `EXISTS (SELECT 1 FROM job_applications ja JOIN jobs j ON j.id = ja.job_id WHERE ja.candidate_id = candidates.id AND j.assigned_vendor_id = $${params.length} AND j.tenant_id = $1 AND j.deleted_at IS NULL)`,
      );
    }

    const db = await getAtsPool(tenantId);
    const dbResult = await db.query(
      `SELECT first_name, last_name, email, phone, current_title, current_company,
              experience_years, current_location, notice_period_days, expected_ctc,
              skills, source, created_at
       FROM candidates
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC`,
      params,
    );

    const CSV_FIELDS = [
      "first_name", "last_name", "email", "phone", "current_title",
      "current_company", "experience_years", "current_location",
      "notice_period_days", "expected_ctc", "skills", "source", "created_at",
    ];

    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const rows = dbResult.rows.map((r) => ({
      ...r,
      skills: Array.isArray(r.skills) ? r.skills.join("; ") : (r.skills || ""),
    }));

    const csv = [
      CSV_FIELDS.join(","),
      ...rows.map((r) => CSV_FIELDS.map((f) => escape(r[f])).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="candidates_export.csv"');
    res.send(csv);
  } catch (error: any) {
    console.error("[exportCandidates] Error:", error?.message);
    res.status(500).json({ message: "Export failed" });
  }
};
