import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import pool from "../../db";
import env from "../../config/env";
import { getUserTransporter } from "../email/email.controller";
import {
  generateScreeningToken,
  hashScreeningToken,
  verifyScreeningToken,
  runScreeningTurn,
  JobForScreening,
  ScreeningHistoryTurn,
} from "../../services/screeningChat";
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
    const appResult = await pool.query(
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

    const sessionResult = await pool.query(
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
      const mail = await getUserTransporter(userId);
      if (!mail) {
        emailError = "Email not configured on your account. Configure it in Settings → Email.";
      } else {
        await mail.transporter.sendMail({
          from: mail.fromEmail,
          to: application.email,
          subject: "Quick pre-screening for your application",
          html,
        });
        emailSent = true;
      }
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
    const sessionResult = await pool.query(`SELECT * FROM screening_sessions WHERE id = $1`, [id]);
    const session = sessionResult.rows[0];
    if (!session || !verifyScreeningToken(token, session.token_hash)) {
      return res.status(404).json({ message: "Screening session not found" });
    }
    if (session.status === "expired" || session.status === "revoked" || new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ message: "This screening link has expired" });
    }

    const messagesResult = await pool.query(
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
  const tokenHash = hashScreeningToken(token);

  try {
    // Atomically reserve a message slot in one UPDATE — a plain read-then-check-then-write
    // (SELECT message_count, compare, later UPDATE) lets two concurrent requests for the
    // same session both read the same pre-increment count and both pass the cap check
    // before either write lands, letting real Gemini calls slip past MAX_MESSAGES. Folding
    // token verification into the same statement also avoids a separate non-constant-time
    // JS string compare — token_hash = $2 is a UNIQUE-indexed equality lookup, not a
    // network-timing-observable app-level comparison.
    const reserveResult = await pool.query(
      `UPDATE screening_sessions
       SET message_count = message_count + 1, started_at = COALESCE(started_at, now())
       WHERE id = $1 AND token_hash = $2 AND status NOT IN ('expired', 'revoked', 'completed')
         AND expires_at > now() AND message_count < $3
       RETURNING *`,
      [id, tokenHash, MAX_MESSAGES],
    );

    if (reserveResult.rows.length === 0) {
      // The atomic reservation already failed safely — this lookup is only to report an
      // accurate reason, not to gate anything.
      const diagResult = await pool.query(`SELECT * FROM screening_sessions WHERE id = $1`, [id]);
      const diag = diagResult.rows[0];
      if (!diag || !verifyScreeningToken(token, diag.token_hash)) {
        return res.status(404).json({ message: "Screening session not found" });
      }
      if (new Date(diag.expires_at) < new Date()) {
        await pool.query(`UPDATE screening_sessions SET status = 'expired' WHERE id = $1`, [id]);
        return res.status(410).json({ message: "This screening link has expired" });
      }
      if (diag.message_count >= MAX_MESSAGES) {
        await pool.query(
          `UPDATE screening_sessions SET status = 'completed', completed_at = COALESCE(completed_at, now()) WHERE id = $1`,
          [id],
        );
        return res.status(410).json({ message: "This screening session has reached its message limit" });
      }
      return res.status(410).json({ message: "This screening session has ended" });
    }

    const session = reserveResult.rows[0];
    const appResult = await pool.query(
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

    const historyResult = await pool.query(
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

    await pool.query(
      `INSERT INTO screening_messages (session_id, role, content) VALUES ($1, 'candidate', $2), ($1, 'assistant', $3)`,
      [id, message, turnResult.reply],
    );

    // message_count was already incremented atomically by the reservation UPDATE above.
    const shouldComplete = turnResult.is_complete || session.message_count >= MAX_MESSAGES;

    await pool.query(
      `UPDATE screening_sessions
       SET status = $1, captured_answers = $2::jsonb, completed_at = $3
       WHERE id = $4`,
      [shouldComplete ? "completed" : "active", JSON.stringify(turnResult.captured_answers), shouldComplete ? new Date() : null, id],
    );

    if (shouldComplete) {
      const moved = await applyAiStageMove({
        tenantId: session.tenant_id,
        applicationId: session.application_id,
        fromStage: row.current_stage,
        toStage: "screened",
        note: "Completed AI screening chat",
      });
      if (!moved) {
        console.warn(
          `[Screening] Session ${id} completed but application ${session.application_id} had already moved past '${row.current_stage}' — stage left untouched.`,
        );
      }
    }

    res.json({ reply: turnResult.reply, is_complete: shouldComplete });
  } catch (error) {
    console.error("Post screening message error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
