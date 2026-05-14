import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";
import { platformPool } from "../../db/platform";

const allowedStages = [
  "new", "sourced", "screened", "shortlisted", "submitted_to_client",
  "client_interview_scheduled", "interview_completed", "selected",
  "offer_extended", "offer_accepted", "joined", "disqualified",
] as const;

type Stage = (typeof allowedStages)[number];

const normalizeStage = (value: any): Stage => {
  if (allowedStages.includes(value)) return value;
  return "new";
};

export const addToPipeline = async (req: AuthRequest, res: Response) => {
  const { candidateId, jobId } = req.body;
  const tenantId = req.user?.tenant_id;
  const filterTenantId = req.user?.is_platform_owner ? null : tenantId;
  const createdBy = req.user?.id;

  if (!candidateId || !jobId) {
    return res.status(400).json({ message: "candidateId and jobId are required" });
  }

  try {
    const db = await getAtsPool(filterTenantId);

    const jobResult = await db.query(
      "SELECT id, assigned_vendor_id, tenant_id FROM jobs WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [jobId, filterTenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    // vendor_user/vendor_manager may only add candidates to jobs assigned to their vendor
    if (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager") {
      const job = jobResult.rows[0];
      if (!req.user.vendor_id || job.assigned_vendor_id !== req.user.vendor_id) {
        return res.status(403).json({ message: "Forbidden: Job is not assigned to your vendor" });
      }
    }

    // For cross-tenant operations (platform owner), use the job's own tenant_id for the insert
    const effectiveTenantId = req.user?.is_platform_owner
      ? (jobResult.rows[0]?.tenant_id ?? tenantId)
      : tenantId;

    const candidateResult = await db.query(
      "SELECT id FROM candidates WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [candidateId, filterTenantId],
    );
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const existing = await db.query(
      "SELECT id FROM job_applications WHERE ($1::uuid IS NULL OR tenant_id = $1) AND job_id = $2 AND candidate_id = $3",
      [filterTenantId, jobId, candidateId],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Candidate is already in this pipeline" });
    }

    const insertResult = await db.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, created_at, updated_at)
       VALUES ($1, $2, $3, 'new', now(), now())
       RETURNING *`,
      [effectiveTenantId, jobId, candidateId],
    );

    const application = insertResult.rows[0];
    await db.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [effectiveTenantId, application.id, null, "new", createdBy],
    );

    res.status(201).json(application);
  } catch (error: any) {
    console.error("[addToPipeline] Error:", error?.message);
    res.status(500).json({ message: "Failed to add to pipeline" });
  }
};

export const getJobApplications = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;

  try {
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
      `SELECT ja.*, json_build_object(
          'id', c.id,
          'first_name', c.first_name,
          'last_name', c.last_name,
          'email', c.email,
          'phone', c.phone,
          'current_title', c.current_title,
          'current_company', c.current_company,
          'current_location', c.current_location,
          'skills', c.skills,
          'resume_url', c.resume_url
        ) AS candidate
       FROM job_applications ja
       JOIN candidates c ON c.id = ja.candidate_id
       WHERE ja.job_id = $1 AND ($2::uuid IS NULL OR ja.tenant_id = $2)
       ORDER BY ja.created_at ASC`,
      [jobId, filterTenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get job applications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createApplication = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const { candidate_id, stage, notes, assigned_to } = req.body;
  const tenantId = req.user?.tenant_id;
  const filterTenantId = req.user?.is_platform_owner ? null : tenantId;
  const createdBy = req.user?.id;

  if (!candidate_id) {
    return res.status(400).json({ message: "candidate_id is required" });
  }

  const targetStage = normalizeStage(stage || "new");

  try {
    const db = await getAtsPool(filterTenantId);

    const jobResult = await db.query(
      "SELECT id, assigned_vendor_id, tenant_id FROM jobs WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [jobId, filterTenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    // vendor_user/vendor_manager may only add candidates to jobs assigned to their vendor
    if (!req.user?.is_platform_owner &&
        (req.user?.role === "vendor_user" || req.user?.role === "vendor_manager")) {
      const job = jobResult.rows[0];
      if (!req.user.vendor_id || job.assigned_vendor_id !== req.user.vendor_id) {
        return res.status(403).json({ message: "Forbidden: Job is not assigned to your vendor" });
      }
    }

    // For cross-tenant ops (platform owner), insert under the job's own tenant
    const effectiveTenantId = req.user?.is_platform_owner
      ? (jobResult.rows[0]?.tenant_id ?? tenantId)
      : tenantId;

    const candidateResult = await db.query(
      "SELECT id FROM candidates WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2) AND deleted_at IS NULL",
      [candidate_id, filterTenantId],
    );
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const existing = await db.query(
      "SELECT id FROM job_applications WHERE ($1::uuid IS NULL OR tenant_id = $1) AND job_id = $2 AND candidate_id = $3",
      [filterTenantId, jobId, candidate_id],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Candidate is already added to this job" });
    }

    const insertResult = await db.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [effectiveTenantId, jobId, candidate_id, targetStage, notes || null, assigned_to || null],
    );

    const application = insertResult.rows[0];
    await db.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [effectiveTenantId, application.id, null, targetStage, createdBy, notes || null],
    );

    res.status(201).json(application);
  } catch (error) {
    console.error("Create application error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const moveApplicationStage = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { to_stage, note } = req.body;
  const tenantId = req.user?.tenant_id;
  const filterTenantId = req.user?.is_platform_owner ? null : tenantId;
  const changedBy = req.user?.id;

  const targetStage = normalizeStage(to_stage);

  try {
    const db = await getAtsPool(filterTenantId);

    const applicationResult = await db.query(
      "SELECT * FROM job_applications WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)",
      [id, filterTenantId],
    );
    if (applicationResult.rows.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    const currentStage = applicationResult.rows[0].stage;
    const effectiveTenantId = applicationResult.rows[0].tenant_id;
    if (currentStage === targetStage) {
      return res.status(400).json({ message: "Candidate is already in the requested stage" });
    }

    const updateResult = await db.query(
      "UPDATE job_applications SET stage = $1, updated_at = now() WHERE id = $2 AND ($3::uuid IS NULL OR tenant_id = $3) RETURNING *",
      [targetStage, id, filterTenantId],
    );

    await db.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [effectiveTenantId, id, currentStage, targetStage, changedBy, note || null],
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error("Move application stage error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getApplicationHistory = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;

  try {
    const db = await getAtsPool(filterTenantId);

    // Phase 9: two-query pattern to avoid cross-DB JOIN
    // pipeline_events lives in the tenant DB; users lives in the platform DB
    const eventsResult = await db.query(
      `SELECT pe.*
       FROM pipeline_events pe
       WHERE pe.application_id = $1 AND ($2::uuid IS NULL OR pe.tenant_id = $2)
       ORDER BY pe.created_at ASC`,
      [id, filterTenantId],
    );

    const userIds = [...new Set(
      eventsResult.rows.map((r: any) => r.changed_by).filter(Boolean),
    )] as string[];

    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const usersResult = await platformPool.query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE id = ANY($1::uuid[])",
        [userIds],
      );
      for (const u of usersResult.rows) emailMap[u.id] = u.email;
    }

    res.json(eventsResult.rows.map((r: any) => ({
      ...r,
      changed_by_email: r.changed_by ? (emailMap[r.changed_by] ?? null) : null,
    })));
  } catch (error) {
    console.error("Get application history error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
