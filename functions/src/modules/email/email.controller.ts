import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import {
  sendEmailAsUser,
  handleEmailError,
} from "./emailConfig.service";

// ─── HTML template ───────────────────────────────────────────────────────────

function buildOutreachHtml(firstName = "there"): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
      <h2 style="color:#1d4ed8;margin-bottom:8px">Opportunity from ZorHire</h2>
      <p>Hello ${firstName},</p>
      <p>We came across your profile and found it to be a great match for an exciting role we are currently hiring for.</p>
      <p>We would love to connect and share more details. Please feel free to reply to this email at your convenience.</p>
      <br/>
      <p style="margin:0">Warm regards,</p>
      <p style="margin:0"><strong>ZorHire Recruitment Team</strong></p>
    </div>
  `;
}

// ─── Templates ───────────────────────────────────────────────────────────────

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

// ─── Bulk / campaign send ─────────────────────────────────────────────────────

export const sendEmail = async (req: AuthRequest, res: Response) => {
  const { subject, body, recipients } = req.body;
  if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
    return res
      .status(400)
      .json({ message: "Subject, body, and recipients are required." });
  }

  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  try {
    const sendResults = await Promise.allSettled(
      recipients.map((recipient: { email: string }) =>
        sendEmailAsUser({
          userId,
          tenantId,
          to: recipient.email,
          subject,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter((r) => r.status === "fulfilled").length;

    await pool.query(
      `INSERT INTO email_campaigns
         (tenant_id, name, subject, body, status, recipient_count, delivered_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        `Manual send ${new Date().toISOString()}`,
        subject,
        body,
        "sent",
        recipients.length,
        deliveredCount,
        userId,
      ],
    );

    res.json({
      message: "Emails processed",
      delivered_count: deliveredCount,
      recipients: recipients.length,
    });
  } catch (err) {
    handleEmailError(err, res);
  }
};

// ─── Single email (used by Candidates / Vendors / Resume Search pages) ────────

export const sendSingleEmail = async (req: AuthRequest, res: Response) => {
  const { to, subject, body } = req.body as {
    to?: string;
    subject?: string;
    body?: string;
    firstName?: string;
  };

  if (!to) {
    return res.status(400).json({ message: "Recipient email is required." });
  }

  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;
  const firstName = (req.body.firstName as string | undefined) || "there";

  try {
    await sendEmailAsUser({
      userId,
      tenantId,
      to,
      subject: subject || "Message from ZorHire",
      html: body || buildOutreachHtml(firstName),
    });
    res.json({ message: "Email sent successfully." });
  } catch (err) {
    handleEmailError(err, res);
  }
};

// ─── Campaign management ──────────────────────────────────────────────────────

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      "SELECT * FROM email_campaigns WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("listCampaigns error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  const { name, subject, body, status, recipient_count } = req.body;
  const tenantId = req.user!.tenant_id;
  const createdBy = req.user!.id;

  if (!name || !subject || !body) {
    return res
      .status(400)
      .json({ message: "Name, subject, and body are required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO email_campaigns
         (tenant_id, name, subject, body, status, recipient_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name, subject, body, status || "draft", recipient_count || 0, createdBy],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("createCampaign error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendCampaign = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { recipients } = req.body;
  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res
      .status(400)
      .json({ message: "Recipients are required to send a campaign." });
  }

  try {
    const campaignResult = await pool.query(
      "SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found." });
    }

    const campaign = campaignResult.rows[0];

    const sendResults = await Promise.allSettled(
      recipients.map((recipient: { email: string }) =>
        sendEmailAsUser({
          userId,
          tenantId,
          to: recipient.email,
          subject: campaign.subject,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${campaign.body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter((r) => r.status === "fulfilled").length;
    const statusUpdate =
      deliveredCount === recipients.length ? "sent" : "failed";

    await pool.query(
      `UPDATE email_campaigns
          SET status = $1, recipient_count = $2, delivered_count = $3,
              sent_at = now(), updated_at = now()
        WHERE id = $4`,
      [statusUpdate, recipients.length, deliveredCount, id],
    );

    res.json({
      message: "Campaign sent",
      delivered_count: deliveredCount,
      recipient_count: recipients.length,
    });
  } catch (err) {
    handleEmailError(err, res);
  }
};
