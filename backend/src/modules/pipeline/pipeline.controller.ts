import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { createNotification } from "../notifications/notifications.controller";

// NOTE (known adjacent bug, out of scope for A4 shortlisting): the DB CHECK constraint
// on job_applications.stage also allows 'offer_rejected', but this array omits it, so
// normalizeStage() would silently reset that stage to 'new' if ever hit. Irrelevant here
// since 'shortlisted' (A4's target stage) is present below.
const allowedStages = [
  "new",
  "sourced",
  "screened",
  "shortlisted",
  "submitted_to_client",
  "client_interview_scheduled",
  "interview_completed",
  "selected",
  "offer_extended",
  "offer_accepted",
  "joined",
  "disqualified",
] as const;

type Stage = (typeof allowedStages)[number];

const normalizeStage = (value: any): Stage => {
  if (allowedStages.includes(value)) {
    return value;
  }
  return "new";
};

/**
 * System-initiated stage move (no req.user.id — this isn't an HTTP-request-shaped
 * action). Distinct from moveApplicationStage: changed_by is NULL, actor_type is 'ai',
 * so AI-driven moves are auditable and distinguishable from human ones.
 */
export const applyAiStageMove = async (
  params: { tenantId: string; applicationId: string; fromStage: string; toStage: Stage; note: string },
): Promise<void> => {
  await pool.query(
    "UPDATE job_applications SET stage = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [params.toStage, params.applicationId, params.tenantId],
  );
  await pool.query(
    `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, actor_type, note, created_at)
     VALUES ($1, $2, $3, $4, NULL, 'ai', $5, now())`,
    [params.tenantId, params.applicationId, params.fromStage, params.toStage, params.note],
  );
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
      return res
        .status(409)
        .json({ message: "Candidate is already added to this job" });
    }

    const insertResult = await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage, notes, assigned_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now())
       RETURNING *`,
      [
        tenantId,
        jobId,
        candidate_id,
        targetStage,
        notes || null,
        assigned_to || null,
      ],
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
      return res
        .status(400)
        .json({ message: "Candidate is already in the requested stage" });
    }

    const updateResult = await pool.query(
      `UPDATE job_applications SET stage = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [targetStage, id],
    );

    await pool.query(
      `INSERT INTO pipeline_events (tenant_id, application_id, from_stage, to_stage, changed_by, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [tenantId, id, currentStage, targetStage, changedBy, note || null],
    );

    res.json(updateResult.rows[0]);

    // Fire-and-forget: notifications + invoice trigger for significant stage changes
    (async () => {
      try {
        const notifyStages = ["offer_extended", "offer_accepted", "joined", "disqualified"];
        if (!notifyStages.includes(targetStage)) return;

        const infoResult = await pool.query(
          `SELECT c.first_name, c.last_name, j.title AS job_title,
                  j.client_id, cl.markup, cl.billing_model
           FROM job_applications ja
           JOIN candidates c ON c.id = ja.candidate_id
           JOIN jobs j ON j.id = ja.job_id
           LEFT JOIN clients cl ON cl.id = j.client_id
           WHERE ja.id = $1`,
          [id],
        );
        if (infoResult.rows.length === 0) return;
        const { first_name, last_name, job_title, client_id } = infoResult.rows[0];

        const typeMap: Record<string, "success" | "info" | "warning"> = {
          offer_extended: "success",
          offer_accepted: "success",
          joined: "success",
          disqualified: "warning",
        };
        const labelMap: Record<string, string> = {
          offer_extended: "Offer Extended",
          offer_accepted: "Offer Accepted",
          joined: "Candidate Joined",
          disqualified: "Candidate Disqualified",
        };

        const recipientsResult = await pool.query(
          `SELECT u.id FROM users u
           JOIN tenant_memberships tm ON tm.user_id = u.id
           WHERE tm.tenant_id = $1 AND tm.is_active = true
             AND tm.role IN ('super_admin','accounts_manager')
             AND u.id != $2`,
          [tenantId, changedBy],
        );
        for (const row of recipientsResult.rows) {
          await createNotification(
            row.id,
            typeMap[targetStage] ?? "info",
            labelMap[targetStage] ?? `Stage: ${targetStage}`,
            `${first_name} ${last_name} → ${job_title}`,
            "application",
            String(id),
          );
        }

        // Auto-draft invoice when candidate joins and a client is linked
        if (targetStage === "joined" && client_id) {
          const invoiceNum = `INV-${Date.now().toString().slice(-8)}`;
          const appRow = applicationResult.rows[0];
          await pool.query(
            `INSERT INTO invoices (tenant_id, client_id, job_id, application_id, candidate_id, invoice_number, currency, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'INR', 'draft')
             ON CONFLICT DO NOTHING`,
            [tenantId, client_id, appRow.job_id, id, appRow.candidate_id, invoiceNum],
          );
        }
      } catch {}
    })();
  } catch (error) {
    console.error("Move application stage error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addToPipeline = async (req: AuthRequest, res: Response) => {
  const { candidateId, jobId } = req.body;
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  if (!candidateId || !jobId) {
    return res
      .status(400)
      .json({ message: "candidateId and jobId are required" });
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
      return res
        .status(409)
        .json({ message: "Candidate already in this pipeline" });
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
  } catch (error) {
    console.error("Add to pipeline error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getCandidateApplications = async (req: AuthRequest, res: Response) => {
  const { candidateId } = req.params;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `SELECT ja.*, json_build_object(
          'id', j.id,
          'title', j.title,
          'department', j.department
        ) AS job
       FROM job_applications ja
       JOIN jobs j ON j.id = ja.job_id
       WHERE ja.candidate_id = $1 AND ja.tenant_id = $2
       ORDER BY ja.updated_at DESC`,
      [candidateId, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Get candidate applications error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getApplicationHistory = async (
  req: AuthRequest,
  res: Response,
) => {
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
