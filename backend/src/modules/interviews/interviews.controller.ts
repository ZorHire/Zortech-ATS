import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { createNotification } from "../notifications/notifications.controller";

// GET /interviews — all interviews for the tenant (optional filters: status, from, to, job_id)
export const listInterviews = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { status, from, to, job_id } = req.query;

  const conditions: string[] = ["i.tenant_id = $1"];
  const params: any[] = [tenantId];
  let idx = 2;

  if (status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(status);
  }
  if (from) {
    conditions.push(`i.scheduled_at >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`i.scheduled_at <= $${idx++}`);
    params.push(to);
  }
  if (job_id) {
    conditions.push(`ja.job_id = $${idx++}`);
    params.push(job_id);
  }

  try {
    const result = await pool.query(
      `SELECT
         i.id, i.interview_type, i.scheduled_at, i.duration_minutes,
         i.interviewer_name, i.interviewer_email, i.meeting_link,
         i.feedback_score, i.feedback_notes, i.feedback_ratings, i.feedback_locked, i.status, i.created_at,
         i.application_id,
         c.id AS candidate_id,
         c.first_name, c.last_name, c.email AS candidate_email,
         j.id AS job_id, j.title AS job_title,
         ja.stage AS current_stage
       FROM interviews i
       JOIN job_applications ja ON ja.id = i.application_id
       JOIN candidates c ON c.id = ja.candidate_id
       JOIN jobs j ON j.id = ja.job_id AND j.deleted_at IS NULL
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.scheduled_at ASC`,
      params,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("listInterviews error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /interviews/applications/:appId — interviews for a specific pipeline application
export const getApplicationInterviews = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { appId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM interviews
       WHERE application_id = $1 AND tenant_id = $2
       ORDER BY scheduled_at DESC`,
      [appId, tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("getApplicationInterviews error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /interviews — schedule a new interview
export const createInterview = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;
  const {
    application_id,
    interview_type,
    scheduled_at,
    duration_minutes,
    interviewer_name,
    interviewer_email,
    meeting_link,
  } = req.body;

  if (!application_id || !scheduled_at) {
    return res
      .status(400)
      .json({ message: "application_id and scheduled_at are required" });
  }

  const validTypes = ["phone", "video", "face_to_face"];
  const type = validTypes.includes(interview_type) ? interview_type : "phone";

  try {
    // Ensure the application belongs to this tenant
    const appCheck = await pool.query(
      "SELECT id FROM job_applications WHERE id = $1 AND tenant_id = $2",
      [application_id, tenantId],
    );
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }

    const result = await pool.query(
      `INSERT INTO interviews
         (tenant_id, application_id, interview_type, scheduled_at, duration_minutes,
          interviewer_name, interviewer_email, meeting_link, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)
       RETURNING *`,
      [
        tenantId,
        application_id,
        type,
        scheduled_at,
        duration_minutes || 60,
        interviewer_name || null,
        interviewer_email || null,
        meeting_link || null,
        createdBy,
      ],
    );

    const interview = result.rows[0];
    res.status(201).json(interview);

    // Fire-and-forget: notify admins/managers about scheduled interview
    (async () => {
      try {
        const infoResult = await pool.query(
          `SELECT c.first_name, c.last_name, j.title AS job_title
           FROM job_applications ja
           JOIN candidates c ON c.id = ja.candidate_id
           JOIN jobs j ON j.id = ja.job_id
           WHERE ja.id = $1`,
          [application_id],
        );
        if (infoResult.rows.length === 0) return;
        const { first_name, last_name, job_title } = infoResult.rows[0];
        const dateStr = new Date(scheduled_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

        const recipientsResult = await pool.query(
          `SELECT u.id FROM users u
           JOIN tenant_memberships tm ON tm.user_id = u.id
           WHERE tm.tenant_id = $1 AND tm.is_active = true
             AND tm.role IN ('super_admin','accounts_manager')
             AND u.id != $2`,
          [tenantId, createdBy],
        );
        for (const row of recipientsResult.rows) {
          await createNotification(
            row.id,
            "info",
            "Interview Scheduled",
            `${first_name} ${last_name} — ${job_title} (${type}, ${dateStr})`,
            "interview",
            interview.id,
          );
        }
      } catch {}
    })();
  } catch (error) {
    console.error("createInterview error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /interviews/:id — update status and/or feedback
export const updateInterview = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  const { status, feedback_score, feedback_notes, feedback_ratings, lock_feedback } = req.body;

  const validStatuses = ["scheduled", "completed", "cancelled", "no_show"];
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const check = await pool.query(
      "SELECT id, feedback_locked FROM interviews WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Prevent editing feedback once locked
    const isFeedbackChange = feedback_score !== undefined || feedback_notes !== undefined || feedback_ratings !== undefined;
    if (isFeedbackChange && check.rows[0].feedback_locked) {
      return res.status(409).json({ message: "Feedback is locked and cannot be edited" });
    }

    const sets: string[] = ["updated_at = now()"];
    const params: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(status);
    }
    if (feedback_score !== undefined) {
      sets.push(`feedback_score = $${idx++}`);
      params.push(feedback_score);
    }
    if (feedback_notes !== undefined) {
      sets.push(`feedback_notes = $${idx++}`);
      params.push(feedback_notes);
    }
    if (feedback_ratings !== undefined) {
      sets.push(`feedback_ratings = $${idx++}`);
      params.push(JSON.stringify(feedback_ratings));
    }
    if (lock_feedback === true) {
      sets.push(`feedback_locked = true`);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE interviews SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("updateInterview error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteInterview = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM interviews WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Interview not found" });
    }
    res.json({ message: "Interview deleted" });
  } catch (error) {
    console.error("deleteInterview error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
