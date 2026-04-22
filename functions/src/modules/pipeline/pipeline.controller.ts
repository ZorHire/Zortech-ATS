import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

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
  const createdBy = req.user?.id;

  if (!candidateId || !jobId) {
    return res.status(400).json({ message: "candidateId and jobId are required" });
  }

  try {
    const jobResult = await pool.query(
      "SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [jobId, tenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    const candidateResult = await pool.query(
      "SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [candidateId, tenantId],
    );
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const existing = await pool.query(
      "SELECT id FROM job_applications WHERE tenant_id = $1 AND job_id = $2 AND candidate_id = $3",
      [tenantId, jobId, candidateId],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Candidate is already in this pipeline" });
    }

    const insertResult = await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, created_at, updated_at)
       VALUES ($1, $2, $3, 'new', now(), now())
       RETURNING *`,
      [tenantId, jobId, candidateId],
    );

    const application = insertResult.rows[0];
    await pool.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, created_at)
       VALUES ($1, $2, $3, $4, $5, now())`,
      [tenantId, application.id, null, "new", createdBy],
    );

    res.status(201).json(application);
  } catch (error: any) {
    console.error("[addToPipeline] Error:", error?.message);
    res.status(500).json({ message: "Failed to add to pipeline" });
  }
};

export const getJobApplications = async (req: AuthRequest, res: Response) => {
  const { jobId } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
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
       WHERE ja.job_id = $1 AND ja.tenant_id = $2
       ORDER BY ja.created_at ASC`,
      [jobId, tenantId],
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
  const createdBy = req.user?.id;

  if (!candidate_id) {
    return res.status(400).json({ message: "candidate_id is required" });
  }

  const targetStage = normalizeStage(stage || "new");

  try {
    const jobResult = await pool.query(
      "SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [jobId, tenantId],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }

    const candidateResult = await pool.query(
      "SELECT id FROM candidates WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [candidate_id, tenantId],
    );
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const existing = await pool.query(
      "SELECT id FROM job_applications WHERE tenant_id = $1 AND job_id = $2 AND candidate_id = $3",
      [tenantId, jobId, candidate_id],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Candidate is already added to this job" });
    }

    const insertResult = await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [tenantId, jobId, candidate_id, targetStage, notes || null, assigned_to || null],
    );

    const application = insertResult.rows[0];
    await pool.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [tenantId, application.id, null, targetStage, createdBy, notes || null],
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
  const changedBy = req.user?.id;

  const targetStage = normalizeStage(to_stage);

  try {
    const applicationResult = await pool.query(
      "SELECT * FROM job_applications WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    if (applicationResult.rows.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    const currentStage = applicationResult.rows[0].stage;
    if (currentStage === targetStage) {
      return res.status(400).json({ message: "Candidate is already in the requested stage" });
    }

    const updateResult = await pool.query(
      "UPDATE job_applications SET stage = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3 RETURNING *",
      [targetStage, id, tenantId],
    );

    await pool.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [tenantId, id, currentStage, targetStage, changedBy, note || null],
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error("Move application stage error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getApplicationHistory = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `SELECT pe.*, u.email as changed_by_email
       FROM pipeline_events pe
       LEFT JOIN users u ON u.id = pe.changed_by
       WHERE pe.application_id = $1 AND pe.tenant_id = $2
       ORDER BY pe.created_at ASC`,
      [id, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get application history error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
