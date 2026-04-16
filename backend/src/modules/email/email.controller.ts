import { Response } from "express";
import nodemailer from "nodemailer";
import pool from "../../db";
import env from "../../config/env";
import { AuthRequest } from "../../middleware/auth";

const templateMap = {
  outreach: {
    name: "Outreach Template",
    subject: "Exciting Opportunity at {{Company}}",
    body: `Dear {{FirstName}},\n\nI hope you are doing well. I came across your profile and wanted to share an opportunity for the {{JobTitle}} role at {{Company}}. If you are open to a new conversation, I would love to connect and share more details.\n\nBest regards,\n{{RecruiterName}}`,
  },
  interview: {
    name: "Interview Invite Template",
    subject: "Interview Invitation for {{JobTitle}}",
    body: `Dear {{FirstName}},\n\nThank you for your interest in the {{JobTitle}} role. We would like to invite you for an interview on {{InterviewDate}}. Please let me know your availability and I will send the meeting details.\n\nRegards,\n{{RecruiterName}}`,
  },
  offer: {
    name: "Offer Communication Template",
    subject: "Offer for {{JobTitle}} at {{Company}}",
    body: `Dear {{FirstName}},\n\nWe are excited to share that we would like to extend an offer for the {{JobTitle}} role at {{Company}}. I will send the formal details shortly.\n\nWarm regards,\n{{RecruiterName}}`,
  },
};

/**
 * ✅ FIXED TRANSPORTER (Zoho SMTP ONLY - no Gmail override)
 */
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT) || 465,
  secure: env.SMTP_SECURE === "true", // true for 465
  auth: {
    type: "LOGIN",   // Zoho India (smtppro.zoho.in) requires LOGIN, not PLAIN
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  },
});

/**
 * ✅ OPTIONAL DEBUG (runs once on startup)
 */
(async () => {
  try {
    await transporter.verify();
    console.log("✅ SMTP server is ready to send emails");
  } catch (err) {
    console.error("❌ SMTP configuration error:", err);
  }
})();

const renderTemplate = (template: string, data: Record<string, string>) => {
  return template.replace(
    /{{\s*([A-Za-z0-9_]+)\s*}}/g,
    (_, key) => data[key] || "",
  );
};

export const sendSingleEmail = async (req: AuthRequest, res: Response) => {
  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res
      .status(400)
      .json({ message: "To, subject, and body are required" });
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_USER, // ✅ MUST match Zoho authenticated email
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${body}</div>`,
    });

    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Send single email error:", error);
    res.status(500).json({ message: "Unable to send email", error });
  }
};

export const listTemplates = async (_req: AuthRequest, res: Response) => {
  res.json(
    Object.entries(templateMap).map(([key, template]) => ({
      key,
      ...template,
    })),
  );
};

export const sendEmail = async (req: AuthRequest, res: Response) => {
  const { subject, body, recipients } = req.body;

  if (
    !subject ||
    !body ||
    !Array.isArray(recipients) ||
    recipients.length === 0
  ) {
    return res
      .status(400)
      .json({ message: "Subject, body, and recipients are required" });
  }

  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  try {
    const sendResults = await Promise.allSettled(
      recipients.map((recipient: any) =>
        transporter.sendMail({
          from: env.SMTP_USER, // ✅ FIXED
          to: recipient.email,
          subject,
          text: body,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter(
      (result) => result.status === "fulfilled",
    ).length;

    await pool.query(
      `INSERT INTO email_campaigns (tenant_id, name, subject, body, status, recipient_count, delivered_count, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        `Manual send ${new Date().toISOString()}`,
        subject,
        body,
        "sent",
        recipients.length,
        deliveredCount,
        createdBy,
      ],
    );

    res.json({
      message: "Emails processed",
      delivered_count: deliveredCount,
      recipients: recipients.length,
    });
  } catch (error) {
    console.error("Send email error:", error);
    res.status(500).json({ message: "Unable to send email", error });
  }
};
