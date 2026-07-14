import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";
import { platformPool } from "../../db/platform";
import env from "../../config/env";
import { sendEmailAsUser } from "../email/emailConfig.service";
import {
  generateScreeningToken,
  hashScreeningToken,
  runScreeningTurn,
  JobForScreening,
  ScreeningHistoryTurn,
} from "../../services/screeningChat.service";
import { applyAiStageMove } from "../pipeline/pipeline.controller";

const MAX_MESSAGES = 30;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Recruiter-triggered, authenticated. Dark by default — SCREENING_CHAT_ENABLED must
 * be explicitly "true" or this creates no session and sends no email. This check is
 * deliberately the very first thing the handler does.
 */
export const createScreeningInvite = async (req: AuthRequest, res: Response) => {
  if (!env.SCREENING_CHAT_ENABLED) {
    return res.status(503).json({ message: "Screening chat is not yet enabled" });
  }

  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  if (!tenantId || !userId) {
    return res.status(403).json({ message: "Tenant context missing" });
  }

  try {
    const db = await getAtsPool(tenantId);
    const appResult = await db.query(
      `SELECT ja.id, ja.candidate_id, c.first_name, c.email
       FROM job_applications ja JOIN candidates c ON c.id = ja.candidate_id
       WHERE ja.id = $1 AND ja.tenant_id = $2`,
      [id, tenantId],
    );
    if (appResult.rows.length === 0) {
      return res.status(404).json({ message: "Application not found" });
    }
    const application = appResult.rows[0];
    if (!application.email) {
      return res.status(400).json({ message: "Candidate has no email on file" });
    }

    const token = generateScreeningToken();
    const tokenHash = hashScreeningToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const sessionResult = await platformPool.query(
      `INSERT INTO screening_sessions (tenant_id, application_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, application.id, tokenHash, expiresAt],
    );
    const sessionId = sessionResult.rows[0].id;
    const link = `${env.FRONTEND_URL}/screening/${sessionId}?token=${token}`;

    const html = `<p>Hi ${application.first_name || "there"},</p>
<p>Thanks for applying! We'd like to ask a few quick screening questions before moving forward. It only takes a couple of minutes.</p>
<p><a href="${link}">${link}</a></p>
<p>This link is valid for 7 days.</p>`;

    let emailSent = false;
    let emailError: string | undefined;
    try {
      await sendEmailAsUser({
        userId,
        tenantId,
        to: application.email,
        subject: "Quick pre-screening for your application",
        html,
      });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Unknown error";
    }

    res.status(201).json({ sessionId, link, emailSent, emailError });
  } catch (error) {
    console.error("Create screening invite error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Public — no authMiddleware. Token verified against the stored hash. */
export const getScreeningSession = async (req: Request, res: Response) => {
  const { id } = req.params;
  const token = req.header("X-Screening-Token");
  if (!token) {
    return res.status(401).json({ message: "Missing screening token" });
  }

  try {
    const sessionResult = await platformPool.query(`SELECT * FROM screening_sessions WHERE id = $1`, [id]);
    const session = sessionResult.rows[0];
    if (!session || session.token_hash !== hashScreeningToken(token)) {
      return res.status(404).json({ message: "Screening session not found" });
    }
    if (session.status === "expired" || session.status === "revoked" || new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ message: "This screening link has expired" });
    }

    const messagesResult = await platformPool.query(
      `SELECT role, content, created_at FROM screening_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    res.json({ status: session.status, messages: messagesResult.rows });
  } catch (error) {
    console.error("Get screening session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** Public — no authMiddleware. Token verified against the stored hash. */
export const postScreeningMessage = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const token = req.header("X-Screening-Token");
  const rawMessage = req.body?.message;
  if (!token) {
    return res.status(401).json({ message: "Missing screening token" });
  }
  if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
    return res.status(400).json({ message: "message is required" });
  }
  const message = rawMessage.trim().slice(0, 2000);

  try {
    const sessionResult = await platformPool.query(`SELECT * FROM screening_sessions WHERE id = $1`, [id]);
    const session = sessionResult.rows[0];
    if (!session || session.token_hash !== hashScreeningToken(token)) {
      return res.status(404).json({ message: "Screening session not found" });
    }
    if (session.status === "expired" || session.status === "revoked" || session.status === "completed") {
      return res.status(410).json({ message: "This screening session has ended" });
    }
    if (new Date(session.expires_at) < new Date()) {
      await platformPool.query(`UPDATE screening_sessions SET status = 'expired' WHERE id = $1`, [id]);
      return res.status(410).json({ message: "This screening link has expired" });
    }
    // Defense in depth — checked before any Gemini call.
    if (session.message_count >= MAX_MESSAGES) {
      await platformPool.query(
        `UPDATE screening_sessions SET status = 'completed', completed_at = COALESCE(completed_at, now()) WHERE id = $1`,
        [id],
      );
      return res.status(410).json({ message: "This screening session has reached its message limit" });
    }

    const db = await getAtsPool(session.tenant_id);
    const appResult = await db.query(
      `SELECT ja.stage AS current_stage, j.title, j.mandatory_skills, j.preferred_skills, j.salary_min, j.salary_max, j.currency, j.work_mode
       FROM job_applications ja JOIN jobs j ON j.id = ja.job_id
       WHERE ja.id = $1`,
      [session.application_id],
    );
    if (appResult.rows.length === 0) {
      return res.status(404).json({ message: "Associated application no longer exists" });
    }
    const row = appResult.rows[0];
    const job: JobForScreening = {
      title: row.title,
      mandatory_skills: row.mandatory_skills || [],
      preferred_skills: row.preferred_skills || [],
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      currency: row.currency,
      work_mode: row.work_mode,
    };

    const historyResult = await platformPool.query(
      `SELECT role, content FROM screening_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [id],
    );
    const history: ScreeningHistoryTurn[] = historyResult.rows;

    const turnResult = await runScreeningTurn({
      tenantId: session.tenant_id,
      sessionId: id,
      job,
      history,
      candidateMessage: message,
    });
    if (!turnResult) {
      return res.status(503).json({ message: "Screening chat is temporarily unavailable" });
    }

    await platformPool.query(
      `INSERT INTO screening_messages (session_id, role, content) VALUES ($1, 'candidate', $2), ($1, 'assistant', $3)`,
      [id, message, turnResult.reply],
    );

    const newMessageCount = session.message_count + 1;
    const shouldComplete = turnResult.is_complete || newMessageCount >= MAX_MESSAGES;

    await platformPool.query(
      `UPDATE screening_sessions
       SET status = $1, message_count = $2, captured_answers = $3::jsonb,
           started_at = COALESCE(started_at, now()), completed_at = $4
       WHERE id = $5`,
      [shouldComplete ? "completed" : "active", newMessageCount, JSON.stringify(turnResult.captured_answers), shouldComplete ? new Date() : null, id],
    );

    if (shouldComplete) {
      await applyAiStageMove(db, {
        tenantId: session.tenant_id,
        applicationId: session.application_id,
        fromStage: row.current_stage,
        toStage: "screened",
        note: "Completed AI screening chat",
      });
    }

    res.json({ reply: turnResult.reply, is_complete: shouldComplete });
  } catch (error) {
    console.error("Post screening message error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
