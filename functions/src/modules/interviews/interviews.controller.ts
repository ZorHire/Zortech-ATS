import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";
import { platformPool } from "../../db/platform";

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
    const db = await getAtsPool(tenantId);

    // verify the application belongs to this tenant before inserting
    const appCheck = await db.query(
      "SELECT id FROM job_applications WHERE id = $1 AND tenant_id = $2",
      [application_id, tenantId],
    );
    if (appCheck.rows.length === 0) {
      return res.status(404).json({ message: "Application not found." });
    }

    const result = await db.query(
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
  const filterTenantId = req.user?.is_platform_owner ? null : req.user!.tenant_id;

  try {
    const db = await getAtsPool(filterTenantId);

    // Phase 9: two-query pattern to avoid cross-DB JOIN
    // interviews lives in the tenant DB; users lives in the platform DB
    const interviewsResult = await db.query(
      `SELECT i.*
       FROM interviews i
       WHERE i.application_id = $1 AND ($2::uuid IS NULL OR i.tenant_id = $2)
       ORDER BY i.scheduled_at DESC`,
      [applicationId, filterTenantId],
    );

    const userIds = [...new Set(
      interviewsResult.rows.map((r: any) => r.created_by).filter(Boolean),
    )] as string[];

    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const usersResult = await platformPool.query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE id = ANY($1::uuid[])",
        [userIds],
      );
      for (const u of usersResult.rows) emailMap[u.id] = u.email;
    }

    res.json(interviewsResult.rows.map((r: any) => ({
      ...r,
      created_by_email: r.created_by ? (emailMap[r.created_by] ?? null) : null,
    })));
  } catch (err) {
    console.error("getInterviewsByApplication error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInterview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const filterTenantId = req.user?.is_platform_owner ? null : req.user!.tenant_id;
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
    const db = await getAtsPool(filterTenantId);
    const result = await db.query(
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
       WHERE id = $9 AND ($10::uuid IS NULL OR tenant_id = $10)
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
        filterTenantId,
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
  const filterTenantId = req.user?.is_platform_owner ? null : req.user!.tenant_id;
  try {
    const db = await getAtsPool(filterTenantId);
    await db.query(
      "DELETE FROM interviews WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)",
      [id, filterTenantId],
    );
    res.json({ message: "Interview deleted" });
  } catch (err) {
    console.error("deleteInterview error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
