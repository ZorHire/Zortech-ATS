import { Response } from "express";
import nodemailer from "nodemailer";
import pool from "../../db";
import env from "../../config/env";
import { AuthRequest } from "../../middleware/auth";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === "true",
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export const listTemplates = async (_req: AuthRequest, res: Response) => {
  const templateMap = {
    outreach: {
      name: "Outreach Template",
      subject: "Exciting Opportunity at {{Company}}",
      body: `Dear {{FirstName}},\n\nI came across your profile and wanted to share an opportunity for the {{JobTitle}} role at {{Company}}.\n\nBest regards,\n{{RecruiterName}}`,
    },
    interview: {
      name: "Interview Invite Template",
      subject: "Interview Invitation for {{JobTitle}}",
      body: `Dear {{FirstName}},\n\nWe would like to invite you for an interview on {{InterviewDate}}.\n\nRegards,\n{{RecruiterName}}`,
    },
    offer: {
      name: "Offer Communication Template",
      subject: "Offer for {{JobTitle}} at {{Company}}",
      body: `Dear {{FirstName}},\n\nWe would like to extend an offer for the {{JobTitle}} role at {{Company}}.\n\nWarm regards,\n{{RecruiterName}}`,
    },
  };

  res.json(
    Object.entries(templateMap).map(([key, template]) => ({ key, ...template })),
  );
};

export const sendEmail = async (req: AuthRequest, res: Response) => {
  const { subject, body, recipients } = req.body;
  if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: "Subject, body, and recipients are required" });
  }

  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  try {
    const sendResults = await Promise.allSettled(
      recipients.map((recipient: any) =>
        transporter.sendMail({
          from: env.EMAIL_FROM,
          to: recipient.email,
          subject,
          text: body,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter((r) => r.status === "fulfilled").length;

    await pool.query(
      `INSERT INTO email_campaigns (tenant_id, name, subject, body, status, recipient_count, delivered_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [tenantId, `Manual send ${new Date().toISOString()}`, subject, body, "sent", recipients.length, deliveredCount, createdBy],
    );

    res.json({ message: "Emails processed", delivered_count: deliveredCount, recipients: recipients.length });
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({ message: "Unable to send email" });
  }
};

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM email_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("List campaigns error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  const { name, subject, body, status, recipient_count } = req.body;
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  if (!name || !subject || !body) {
    return res.status(400).json({ message: "Name, subject, and body are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO email_campaigns (tenant_id, name, subject, body, status, recipient_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name, subject, body, status || "draft", recipient_count || 0, createdBy],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create campaign error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendCampaign = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { recipients } = req.body;
  const tenantId = req.user?.tenant_id;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: "Recipients are required to send a campaign" });
  }

  try {
    const campaignResult = await pool.query(
      "SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const campaign = campaignResult.rows[0];
    const sendResults = await Promise.allSettled(
      recipients.map((recipient: any) =>
        transporter.sendMail({
          from: env.EMAIL_FROM,
          to: recipient.email,
          subject: campaign.subject,
          text: campaign.body,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${campaign.body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter((p) => p.status === "fulfilled").length;
    const statusUpdate = deliveredCount === recipients.length ? "sent" : "failed";

    await pool.query(
      "UPDATE email_campaigns SET status = $1, recipient_count = $2, delivered_count = $3, sent_at = now(), updated_at = now() WHERE id = $4",
      [statusUpdate, recipients.length, deliveredCount, id],
    );

    res.json({ message: "Campaign sent", delivered_count: deliveredCount, recipient_count: recipients.length });
  } catch (error) {
    console.error("Send campaign error:", error);
    res.status(500).json({ message: "Unable to send campaign" });
  }
};
