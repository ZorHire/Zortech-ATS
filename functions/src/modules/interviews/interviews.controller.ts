import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const createInterview = async (req: AuthRequest, res: Response) => {
  const {
    application_id,
    interview_type,
    scheduled_at,
    duration_minutes,
    interviewer_name,
    interviewer_email,
    meeting_link,
  } = req.body;

  const tenantId = req.user!.tenant_id;
  const createdBy = req.user!.id;

  if (!application_id || !interview_type || !scheduled_at) {
    return res.status(400).json({
      message: "application_id, interview_type, and scheduled_at are required.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO interviews
         (tenant_id, application_id, interview_type, scheduled_at, duration_minutes,
          interviewer_name, interviewer_email, meeting_link, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)
       RETURNING *`,
      [
        tenantId,
        application_id,
        interview_type,
        scheduled_at,
        duration_minutes || 60,
        interviewer_name || null,
        interviewer_email || null,
        meeting_link || null,
        createdBy,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("createInterview error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getInterviewsByApplication = async (req: AuthRequest, res: Response) => {
  const { applicationId } = req.params;
  const tenantId = req.user!.tenant_id;

  try {
    const result = await pool.query(
      `SELECT i.*, u.email as created_by_email
       FROM interviews i
       LEFT JOIN users u ON u.id = i.created_by
       WHERE i.application_id = $1 AND i.tenant_id = $2
       ORDER BY i.scheduled_at DESC`,
      [applicationId, tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getInterviewsByApplication error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInterview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  const {
    status,
    feedback_score,
    feedback_notes,
    scheduled_at,
    meeting_link,
    interviewer_name,
    interviewer_email,
    duration_minutes,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE interviews
       SET status = COALESCE($1, status),
           feedback_score = COALESCE($2, feedback_score),
           feedback_notes = COALESCE($3, feedback_notes),
           scheduled_at = COALESCE($4, scheduled_at),
           meeting_link = COALESCE($5, meeting_link),
           interviewer_name = COALESCE($6, interviewer_name),
           interviewer_email = COALESCE($7, interviewer_email),
           duration_minutes = COALESCE($8, duration_minutes),
           updated_at = now()
       WHERE id = $9 AND tenant_id = $10
       RETURNING *`,
      [
        status ?? null,
        feedback_score ?? null,
        feedback_notes ?? null,
        scheduled_at ?? null,
        meeting_link ?? null,
        interviewer_name ?? null,
        interviewer_email ?? null,
        duration_minutes ?? null,
        id,
        tenantId,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Interview not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("updateInterview error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteInterview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    await pool.query(
      "DELETE FROM interviews WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    res.json({ message: "Interview deleted" });
  } catch (err) {
    console.error("deleteInterview error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
