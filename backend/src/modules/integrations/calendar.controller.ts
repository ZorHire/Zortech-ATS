import { Request, Response } from "express";
import pool from "../../db";
import * as googleCalSvc from "./services/google-calendar.service";
import * as outlookCalSvc from "./services/outlook-calendar.service";

// ─── Google OAuth ───────────────────────────────────────────────────────────

export async function googleAuthRedirect(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;
  const url = googleCalSvc.getGoogleAuthUrl(userId, tenantId);
  res.redirect(url);
}

export async function googleAuthCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query as Record<string, string>;
    const { userId, tenantId } = JSON.parse(state);

    const tokens = await googleCalSvc.exchangeGoogleCode(code);
    await pool.query(
      `INSERT INTO oauth_tokens (tenant_id, user_id, provider, access_token, refresh_token, expires_at)
       VALUES ($1, $2, 'google_calendar', $3, $4, to_timestamp($5::bigint / 1000))
       ON CONFLICT (tenant_id, user_id, provider)
       DO UPDATE SET access_token=$3, refresh_token=$4, expires_at=to_timestamp($5::bigint / 1000)`,
      [tenantId, userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date],
    );
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?calendar=google&status=connected`);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Outlook OAuth ──────────────────────────────────────────────────────────

export async function outlookAuthRedirect(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;
  const url = outlookCalSvc.getOutlookAuthUrl(userId, tenantId);
  res.redirect(url);
}

export async function outlookAuthCallback(req: Request, res: Response) {
  try {
    const { code, state } = req.query as Record<string, string>;
    const { userId, tenantId } = JSON.parse(Buffer.from(state, "base64").toString());

    const tokens = await outlookCalSvc.exchangeOutlookCode(code) as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);
    await pool.query(
      `INSERT INTO oauth_tokens (tenant_id, user_id, provider, access_token, refresh_token, expires_at)
       VALUES ($1, $2, 'outlook_calendar', $3, $4, $5)
       ON CONFLICT (tenant_id, user_id, provider)
       DO UPDATE SET access_token=$3, refresh_token=$4, expires_at=$5`,
      [tenantId, userId, tokens.access_token, tokens.refresh_token || null, expiresAt],
    );
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?calendar=outlook&status=connected`);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Check connection status ─────────────────────────────────────────────────

export async function getCalendarStatus(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;

  const result = await pool.query(
    `SELECT provider FROM oauth_tokens WHERE tenant_id=$1 AND user_id=$2 AND provider IN ('google_calendar','outlook_calendar')`,
    [tenantId, userId],
  );

  const connected = result.rows.map((r) => r.provider);
  res.json({
    google: connected.includes("google_calendar"),
    outlook: connected.includes("outlook_calendar"),
  });
}

export async function disconnectCalendar(req: Request, res: Response) {
  const userId = (req as any).user?.id;
  const tenantId = (req as any).user?.tenantId;
  const provider = req.params.provider as string;

  if (!["google_calendar", "outlook_calendar"].includes(provider)) {
    return res.status(400).json({ message: "Invalid provider" });
  }

  await pool.query(
    `DELETE FROM oauth_tokens WHERE tenant_id=$1 AND user_id=$2 AND provider=$3`,
    [tenantId, userId, provider],
  );
  res.json({ message: "Disconnected" });
}

// ─── Create calendar event for an interview ──────────────────────────────────

export async function createInterviewCalendarEvent(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const userId = (req as any).user?.id;
  const interviewId = req.params.interviewId as string;
  const { provider = "google_calendar" } = req.body;

  try {
    const interviewRes = await pool.query(
      `SELECT i.*, c.first_name||' '||c.last_name as candidate_name, c.email as candidate_email,
              j.title as job_title, u.email as recruiter_email
       FROM interviews i
       JOIN candidates c ON c.id=i.candidate_id
       JOIN jobs j ON j.id=i.job_id
       LEFT JOIN users u ON u.id=$3
       WHERE i.id=$1 AND i.tenant_id=$2`,
      [interviewId, tenantId, userId],
    );

    if (!interviewRes.rows[0]) return res.status(404).json({ message: "Interview not found" });
    const iv = interviewRes.rows[0];

    const tokenRes = await pool.query(
      `SELECT access_token, refresh_token FROM oauth_tokens WHERE tenant_id=$1 AND user_id=$2 AND provider=$3`,
      [tenantId, userId, provider],
    );
    if (!tokenRes.rows[0]) return res.status(400).json({ message: `${provider} not connected` });
    const { access_token, refresh_token } = tokenRes.rows[0];

    const startTime = iv.scheduled_at;
    const endTime = new Date(new Date(startTime).getTime() + (iv.duration_minutes || 60) * 60000).toISOString();
    const attendees = [iv.candidate_email, iv.recruiter_email].filter(Boolean);

    let calendarEventId: string;

    if (provider === "google_calendar") {
      const event = await googleCalSvc.createGoogleCalendarEvent({
        accessToken: access_token,
        refreshToken: refresh_token,
        summary: `Interview: ${iv.candidate_name} — ${iv.job_title}`,
        description: `Interview scheduled via ZorHire.\nCandidate: ${iv.candidate_name}\nJob: ${iv.job_title}`,
        startTime,
        endTime,
        attendeeEmails: attendees,
        meetLink: true,
      });
      calendarEventId = event.id || "";
    } else {
      const event = await outlookCalSvc.createOutlookCalendarEvent({
        accessToken: access_token,
        summary: `Interview: ${iv.candidate_name} — ${iv.job_title}`,
        description: `Interview scheduled via ZorHire.\nCandidate: ${iv.candidate_name}\nJob: ${iv.job_title}`,
        startTime,
        endTime,
        attendeeEmails: attendees,
        meetLink: true,
      }) as any;
      calendarEventId = event.id || "";
    }

    await pool.query(
      `UPDATE interviews SET calendar_event_id=$1, calendar_provider=$2 WHERE id=$3 AND tenant_id=$4`,
      [calendarEventId, provider, interviewId, tenantId],
    );

    res.json({ message: "Calendar event created", calendarEventId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
