import { Request, Response } from "express";
import pool from "../../db";
import * as calendlySvc from "./services/calendly.service";
import { sendEmailViaSendGrid } from "./services/sendgrid.service";

export async function getCalendlyStatus(req: Request, res: Response) {
  const key = process.env.CALENDLY_API_KEY;
  if (!key) return res.json({ connected: false });

  try {
    const user = await calendlySvc.getCurrentUser();
    res.json({ connected: true, email: user.email, name: user.name });
  } catch {
    res.json({ connected: false });
  }
}

export async function listEventTypes(req: Request, res: Response) {
  try {
    const user = await calendlySvc.getCurrentUser();
    const types = await calendlySvc.listEventTypes(user.uri);
    res.json(types);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function createSchedulingLink(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { interviewId, eventTypeUri, candidateEmail } = req.body;

  if (!eventTypeUri) return res.status(400).json({ message: "eventTypeUri is required" });

  try {
    const link = await calendlySvc.createOneOffSchedulingLink({ ownerUri: eventTypeUri, maxEventCount: 1 });

    const result = await pool.query(
      `INSERT INTO scheduling_links (tenant_id, interview_id, calendly_link_uri, booking_url, candidate_email, created_at, status)
       VALUES ($1,$2,$3,$4,$5,NOW(),'pending')
       RETURNING *`,
      [tenantId, interviewId || null, eventTypeUri, link.booking_url, candidateEmail || null],
    );

    res.status(201).json({ bookingUrl: link.booking_url, link: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function listSchedulingLinks(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { interviewId } = req.query;

  const where = interviewId
    ? `WHERE tenant_id=$1 AND interview_id=$2`
    : `WHERE tenant_id=$1`;
  const params = interviewId ? [tenantId, interviewId] : [tenantId];

  const result = await pool.query(
    `SELECT * FROM scheduling_links ${where} ORDER BY created_at DESC LIMIT 50`,
    params,
  );
  res.json(result.rows);
}

export async function sendSchedulingLinkToCandidate(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { linkId } = req.params;

  try {
    const linkRes = await pool.query(
      `SELECT sl.*, c.first_name, c.email as c_email, j.title as job_title
       FROM scheduling_links sl
       LEFT JOIN interviews i ON i.id=sl.interview_id
       LEFT JOIN candidates c ON c.id=i.candidate_id
       LEFT JOIN jobs j ON j.id=i.job_id
       WHERE sl.id=$1 AND sl.tenant_id=$2`,
      [linkId, tenantId],
    );
    if (!linkRes.rows[0]) return res.status(404).json({ message: "Scheduling link not found" });

    const sl = linkRes.rows[0];
    const recipientEmail = sl.candidate_email || sl.c_email;
    if (!recipientEmail) return res.status(400).json({ message: "No candidate email found" });

    await sendEmailViaSendGrid({
      to: recipientEmail,
      subject: `Schedule your interview — ${sl.job_title || "Job Opportunity"}`,
      html: `
        <p>Hi ${sl.first_name || "Candidate"},</p>
        <p>Please use the link below to schedule your interview at a time that works for you:</p>
        <p><a href="${sl.booking_url}" style="background:#7c3aed;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Pick a Time</a></p>
        <p>This is a one-time link valid for a single booking.</p>
      `,
    });

    await pool.query(
      `UPDATE scheduling_links SET invitation_sent_at=NOW() WHERE id=$1`,
      [linkId],
    );

    res.json({ message: "Scheduling link sent to candidate" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}
