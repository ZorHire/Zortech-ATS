import { Request, Response } from "express";
import pool from "../../db";
import * as twilioSvc from "./services/twilio.service";

export async function sendSMSNotification(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { to, message, via = "sms" } = req.body;

  if (!to || !message) return res.status(400).json({ message: "to and message are required" });

  try {
    const sid = via === "whatsapp"
      ? await twilioSvc.sendWhatsApp(to, message)
      : await twilioSvc.sendSMS(to, message);

    await pool.query(
      `INSERT INTO sms_logs (tenant_id, to_number, message, provider, external_id, sent_at)
       VALUES ($1,$2,$3,'twilio',$4,NOW())`,
      [tenantId, to, message, sid],
    );

    res.json({ message: "Sent", sid });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function sendInterviewReminder(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { interviewId, via = "sms" } = req.body;

  try {
    const result = await pool.query(
      `SELECT i.scheduled_at, c.first_name, c.phone, j.title as job_title, comp.name as company_name
       FROM interviews i
       JOIN candidates c ON c.id=i.candidate_id
       JOIN jobs j ON j.id=i.job_id
       JOIN companies comp ON comp.id=j.client_id
       WHERE i.id=$1 AND i.tenant_id=$2`,
      [interviewId, tenantId],
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Interview not found" });

    const iv = result.rows[0];
    if (!iv.phone) return res.status(400).json({ message: "Candidate has no phone number" });

    const sid = await twilioSvc.sendInterviewReminder({
      candidateName: iv.first_name,
      candidatePhone: iv.phone,
      interviewDateTime: new Date(iv.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      jobTitle: iv.job_title,
      companyName: iv.company_name,
      via: via as "sms" | "whatsapp",
    });

    res.json({ message: "Reminder sent", sid });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function sendOfferNotification(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { offerId, via = "sms" } = req.body;

  try {
    const result = await pool.query(
      `SELECT o.*, c.first_name, c.phone, j.title as job_title, comp.name as company_name
       FROM offers o
       JOIN candidates c ON c.id=o.candidate_id
       JOIN jobs j ON j.id=o.job_id
       JOIN companies comp ON comp.id=j.client_id
       WHERE o.id=$1 AND o.tenant_id=$2`,
      [offerId, tenantId],
    );
    if (!result.rows[0]) return res.status(404).json({ message: "Offer not found" });

    const offer = result.rows[0];
    if (!offer.phone) return res.status(400).json({ message: "Candidate has no phone number" });

    const sid = await twilioSvc.sendOfferNotification({
      candidateName: offer.first_name,
      candidatePhone: offer.phone,
      jobTitle: offer.job_title,
      companyName: offer.company_name,
      via: via as "sms" | "whatsapp",
    });

    res.json({ message: "Offer notification sent", sid });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function getSMSLogs(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await pool.query(
    `SELECT * FROM sms_logs WHERE tenant_id=$1 ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset],
  );
  res.json(result.rows);
}
