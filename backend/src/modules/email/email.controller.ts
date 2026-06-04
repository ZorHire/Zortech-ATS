import crypto from "crypto";
import { Response } from "express";
import nodemailer from "nodemailer";
import pool from "../../db";
import env from "../../config/env";
import { AuthRequest } from "../../middleware/auth";

// ─── Encryption helpers ──────────────────────────────────────────────────────
// Passwords are stored as AES-256-GCM ciphertext: "<iv_hex>:<tag_hex>:<ct_hex>"
// SERVER_ENCRYPTION_KEY must be a 64-char hex string (32 bytes) in your .env.

function getEncryptionKey(): Buffer {
  const hex = env.ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY is not set or too short. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex.slice(0, 64), "hex");
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

function decrypt(stored: string): string {
  const key = getEncryptionKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted value");
  const [ivHex, tagHex, ctHex] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(ctHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}

// ─── SMTP transporter factory ─────────────────────────────────────────────────

const PROVIDER_SMTP: Record<
  string,
  { host: string; port: number; secure: boolean }
> = {
  zoho: { host: "smtp.zoho.com", port: 465, secure: true },
  zoho_in: { host: "smtp.zoho.in", port: 465, secure: true },
  zoho_eu: { host: "smtp.zoho.eu", port: 465, secure: true },
  google_workspace: { host: "smtp.gmail.com", port: 587, secure: false },
};

function buildTransporter(email: string, password: string, provider: string) {
  const smtp = PROVIDER_SMTP[provider] ?? PROVIDER_SMTP.zoho;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { type: "LOGIN", user: email, pass: password },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
  });
}

// ─── SMTP error classifier ────────────────────────────────────────────────────

export function classifySmtpError(error: any): { code: string; message: string } {
  const msg = String(error?.message ?? "").toLowerCase();
  const rc = error?.responseCode as number | undefined;

  if (
    error?.code === "EAUTH" ||
    rc === 535 ||
    msg.includes("invalid credentials") ||
    msg.includes("authentication failed") ||
    msg.includes("username and password not accepted")
  ) {
    return {
      code: "SMTP_AUTH_FAILED",
      message:
        "Authentication failed. Please check your email and app password in Settings → Email.",
    };
  }
  if (
    msg.includes("smtp access is not enabled") ||
    msg.includes("smtp not enabled") ||
    msg.includes("please enable smtp")
  ) {
    return {
      code: "SMTP_NOT_ENABLED",
      message:
        "SMTP access is disabled on your account. Enable it in your email provider's security settings.",
    };
  }
  if (
    rc === 421 ||
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("daily sending quota")
  ) {
    return {
      code: "SMTP_LIMIT_REACHED",
      message: "Email sending limit reached. Please try again later.",
    };
  }
  return {
    code: "SMTP_ERROR",
    message: error?.message ?? "Unable to send email",
  };
}

// ─── Shared helper: fetch + build transporter for a user ─────────────────────

export async function getUserTransporter(userId: string): Promise<{
  transporter: nodemailer.Transporter;
  fromEmail: string;
} | null> {
  let result;
  try {
    result = await pool.query(
      `SELECT email, encrypted_password, provider
       FROM user_email_config
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
  } catch (err: any) {
    // Fallback if is_active column is missing
    if (err?.code === "42703") {
      result = await pool.query(
        `SELECT email, encrypted_password, provider
         FROM user_email_config
         WHERE user_id = $1`,
        [userId],
      );
    } else {
      throw err;
    }
  }

  if (result.rows.length === 0) return null;
  const { email, encrypted_password, provider } = result.rows[0];
  let password: string;
  try {
    password = decrypt(encrypted_password);
  } catch (err: any) {
    console.error("getUserTransporter decrypt error:", err.message);
    throw new Error(
      "Stored credentials are corrupt or encryption key is missing. Please reconnect your email in Settings → Email.",
    );
  }
  return {
    transporter: buildTransporter(email, password, provider),
    fromEmail: email,
  };
}

// ─── GET /email/config ────────────────────────────────────────────────────────

export const getEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const result = await pool.query(
      `SELECT email, provider, encrypted_password, updated_at
       FROM user_email_config
       WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }
    const { email, provider, encrypted_password, updated_at } = result.rows[0];
    let is_corrupted = false;
    try {
      decrypt(encrypted_password);
    } catch {
      is_corrupted = true;
    }
    return res.json({ configured: true, email, provider, updated_at, is_corrupted });
  } catch (error) {
    console.error("Get email config error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── POST /email/config ───────────────────────────────────────────────────────

export const saveEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenant_id;
  const { email, appPassword, provider = "zoho" } = req.body;

  if (!email?.trim() || !appPassword?.trim()) {
    return res
      .status(400)
      .json({ message: "Email and app password are required." });
  }
  if (!["zoho", "zoho_in", "zoho_eu", "google_workspace"].includes(provider)) {
    return res.status(400).json({ message: "Unsupported provider." });
  }

  const cleanPassword = (appPassword as string).replace(/\s+/g, "");
  let encryptedPassword: string;
  try {
    encryptedPassword = encrypt(cleanPassword);
  } catch (err: any) {
    console.error("Encryption key error:", err.message);
    return res
      .status(500)
      .json({ message: "Encryption not configured on server. Contact admin." });
  }

  try {
    await pool.query(
      `INSERT INTO user_email_config
         (user_id, tenant_id, email, encrypted_password, provider)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, tenant_id) DO UPDATE SET
         email              = EXCLUDED.email,
         encrypted_password = EXCLUDED.encrypted_password,
         provider           = EXCLUDED.provider,
         is_active          = true,
         updated_at         = now()`,
      [userId, tenantId, email.trim(), encryptedPassword, provider],
    );
    res.json({
      configured: true,
      email: email.trim(),
      provider,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Save email config error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── DELETE /email/config ─────────────────────────────────────────────────────

export const removeEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    await pool.query(`DELETE FROM user_email_config WHERE user_id = $1`, [
      userId,
    ]);
    res.json({ configured: false });
  } catch (error) {
    console.error("Remove email config error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── POST /email/config/test ──────────────────────────────────────────────────

export const testEmailConfig = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const result = await pool.query(
      `SELECT email, encrypted_password, provider
       FROM user_email_config
       WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ ok: false, message: "No email configured." });
    }
    const { email, encrypted_password, provider } = result.rows[0];
    let password: string;
    try {
      password = decrypt(encrypted_password);
    } catch {
      return res.status(400).json({
        ok: false,
        message: "Stored credentials are corrupt. Please reconnect your email.",
      });
    }
    const transporter = buildTransporter(email, password, provider);
    await transporter.verify();
    res.json({ ok: true, message: `Connected successfully as ${email}` });
  } catch (error: any) {
    console.error("Test email config error:", error);
    const { message } = classifySmtpError(error);
    res.status(400).json({ ok: false, message });
  }
};

// ─── Email templates ──────────────────────────────────────────────────────────

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

export const listTemplates = async (_req: AuthRequest, res: Response) => {
  res.json(
    Object.entries(templateMap).map(([key, template]) => ({
      key,
      ...template,
    })),
  );
};

// ─── POST /email/send-single ──────────────────────────────────────────────────

export const sendSingleEmail = async (req: AuthRequest, res: Response) => {
  const { to, subject, body, firstName } = req.body;
  if (!to || !subject) {
    return res.status(400).json({ message: "To and subject are required" });
  }

  try {
    const userMail = await getUserTransporter(req.user!.id);
    if (!userMail) {
      return res.status(400).json({
        code: "EMAIL_NOT_CONFIGURED",
        message:
          "Email not configured. Go to Settings → Email to connect your email.",
      });
    }

    const greeting = firstName ? `Dear ${firstName},\n\n` : "";
    const finalBody = body ?? `${greeting}${subject}`;

    await userMail.transporter.sendMail({
      from: userMail.fromEmail,
      to,
      subject,
      text: finalBody,
      html: `<div style="font-family:sans-serif;white-space:pre-wrap">${finalBody}</div>`,
    });
    res.json({ message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Send single email error:", error);
    const { code, message } = classifySmtpError(error);
    res.status(500).json({ code, message });
  }
};

// ─── POST /email/assign-jd ───────────────────────────────────────────────────

export const assignJd = async (req: AuthRequest, res: Response) => {
  const { vendor_id, job_id, deadline_days, site_url } = req.body;
  if (!vendor_id || !job_id || !deadline_days) {
    return res
      .status(400)
      .json({ message: "vendor_id, job_id, and deadline_days are required" });
  }
  const tenantId = req.user!.tenant_id;

  try {
    const [jobResult, vendorResult] = await Promise.all([
      pool.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2",
        [job_id, tenantId],
      ),
      pool.query(
        "SELECT id, company_name, primary_contact_email FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [vendor_id, tenantId],
      ),
    ]);

    if (jobResult.rows.length === 0)
      return res.status(404).json({ message: "Job not found" });
    if (vendorResult.rows.length === 0)
      return res.status(404).json({ message: "Vendor not found" });

    const job = jobResult.rows[0];
    const vendor = vendorResult.rows[0];

    const days = Number(deadline_days);
    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    const urlPart = site_url ? ` at ${site_url}` : "";
    const body = `You have been assigned "${job.title}" and you have ${dayLabel} to add candidates to the JD${urlPart}.`;

    const userMail = await getUserTransporter(req.user!.id);
    if (!userMail) {
      return res.status(400).json({
        code: "EMAIL_NOT_CONFIGURED",
        message: "Email not configured. Go to Settings → Email to connect your email.",
      });
    }

    try {
      await userMail.transporter.sendMail({
        from: userMail.fromEmail,
        to: vendor.primary_contact_email,
        subject: `JD Assignment: ${job.title}`,
        text: body,
        html: `<div style="font-family:sans-serif;line-height:1.6">${body}</div>`,
      });
      res.json({ message: "Assignment email sent successfully" });
    } catch (sendError: any) {
      console.error("Assign JD send email error:", sendError);
      const { code, message } = classifySmtpError(sendError);
      const status = code === "SMTP_ERROR" ? 500 : 400;
      res.status(status).json({ code, message });
    }
  } catch (error: any) {
    console.error("Assign JD processing error:", error);
    res.status(500).json({ message: "Internal server error during JD assignment" });
  }
};

// POST /email/assign-jd-recruiter
export const assignJdRecruiter = async (req: AuthRequest, res: Response) => {
  // Accept recruiter_ids (array) from frontend, or legacy recruiter_id (singular)
  const { recruiter_id, recruiter_ids, job_id, deadline_days, site_url } = req.body;

  const rawIds: string[] = Array.isArray(recruiter_ids)
    ? recruiter_ids
    : recruiter_id
    ? [String(recruiter_id)]
    : [];

  if (!req.user?.id || !req.user?.tenant_id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!rawIds.length || !job_id || !deadline_days) {
    return res.status(400).json({ message: "recruiter_ids, job_id, and deadline_days are required" });
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalidId = rawIds.find((id) => !uuidPattern.test(id));
  if (invalidId || !uuidPattern.test(String(job_id))) {
    return res.status(400).json({ message: "Invalid recruiter_id or job_id" });
  }

  const days = Number(deadline_days);
  if (!Number.isFinite(days) || days <= 0) {
    return res.status(400).json({ message: "deadline_days must be a positive number" });
  }

  const tenantId = req.user!.tenant_id;

  try {
    // Fetch job
    let jobResult;
    try {
      jobResult = await pool.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [job_id, tenantId],
      );
    } catch (jobQueryError: any) {
      if (jobQueryError?.code !== "42703") throw jobQueryError;
      jobResult = await pool.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2",
        [job_id, tenantId],
      );
    }
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ message: "Job not found" });
    }
    const job = jobResult.rows[0];

    // Fetch all recruiter rows in one query
    const recruiterResult = await pool.query(
      `SELECT u.id, u.email, p.full_name
       FROM users u
       INNER JOIN tenant_memberships tm ON tm.user_id = u.id
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ANY($1::uuid[])
         AND tm.tenant_id = $2
         AND tm.role = 'recruiter'
         AND tm.is_active = true
         AND u.is_active = true`,
      [rawIds, tenantId],
    );
    if (recruiterResult.rows.length === 0) {
      return res.status(404).json({ message: "No active recruiters found" });
    }
    const recruiters = recruiterResult.rows;

    // Update assigned_recruiter_ids array (migration 006); fall back to singular column
    try {
      await pool.query(
        `UPDATE jobs SET assigned_recruiter_ids = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`,
        [rawIds, job_id, tenantId],
      );
    } catch (assignUpdateError: any) {
      if (assignUpdateError?.code !== "42703") throw assignUpdateError;
      try {
        await pool.query(
          `UPDATE jobs SET assigned_recruiter_id = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3`,
          [rawIds[0], job_id, tenantId],
        );
      } catch {
        // email-only flow if both columns missing
      }
    }

    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    const urlPart = site_url ? ` at ${String(site_url).replace(/[<>"']/g, "")}` : "";

    const userMail = await getUserTransporter(req.user!.id);
    if (!userMail) {
      return res.status(200).json({
        message: "Recruiters assigned successfully, but assignment emails could not be sent.",
        email_error: {
          code: "EMAIL_NOT_CONFIGURED",
          message: "Your email is not configured. Go to Settings → Email to connect your email.",
        },
      });
    }

    const mailResults = await Promise.allSettled(
      recruiters.map(async (recruiter) => {
        const recruiterName =
          recruiter.full_name && String(recruiter.full_name).trim().length > 0
            ? recruiter.full_name
            : recruiter.email;
        const body =
          `Hi ${recruiterName},\n\n` +
          `You have been assigned "${job.title}". Please submit candidates within ${dayLabel}${urlPart}.`;
        await userMail.transporter.sendMail({
          from: userMail.fromEmail,
          to: recruiter.email,
          subject: `JD Assignment: ${job.title}`,
          text: body,
          html: `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${body}</div>`,
        });
      }),
    );

    const failed = mailResults.filter((r) => r.status === "rejected").length;
    const sent = recruiters.length - failed;
    return res.json({
      message:
        failed === 0
          ? `Assignment email${sent > 1 ? "s" : ""} sent to ${sent} recruiter${sent > 1 ? "s" : ""} successfully.`
          : `Assigned ${recruiters.length} recruiter${recruiters.length > 1 ? "s" : ""}, but ${failed} email${failed > 1 ? "s" : ""} failed to send.`,
    });
  } catch (error: any) {
    console.error("assignJD error:", error);
    return res.status(500).json({
      message: "Internal server error",
      debug: env.NODE_ENV === "development" ? error?.message : undefined,
    });
  }
};

// ─── GET /email-campaigns ─────────────────────────────────────────────────────

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT id, name, subject, body, status,
              recipient_count, delivered_count, opened_count,
              clicked_count, bounced_count, unsubscribed_count,
              scheduled_at, sent_at, created_by, created_at, updated_at
       FROM email_campaigns
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /email-campaigns ────────────────────────────────────────────────────

export const createCampaign = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;
  const { name, subject, body, status = 'draft' } = req.body;

  if (!name?.trim() || !subject?.trim() || !body?.trim()) {
    return res.status(400).json({ message: 'name, subject, and body are required.' });
  }
  const allowedStatuses = ['draft', 'scheduled', 'sending', 'sent', 'failed'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO email_campaigns
         (tenant_id, name, subject, body, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, name.trim(), subject.trim(), body.trim(), status, userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /email-campaigns/:id/send ──────────────────────────────────────────

export const sendCampaignById = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;
  const { id } = req.params;
  const { recipients } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: 'recipients array is required.' });
  }

  try {
    const campResult = await pool.query(
      `SELECT * FROM email_campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (campResult.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }
    const campaign = campResult.rows[0];

    const userMail = await getUserTransporter(userId);
    if (!userMail) {
      return res.status(400).json({
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Email not configured. Go to Settings → Email to connect your email.',
      });
    }

    await pool.query(
      `UPDATE email_campaigns SET status = 'sending', recipient_count = $1, updated_at = now() WHERE id = $2`,
      [recipients.length, id],
    );

    const sendResults = await Promise.allSettled(
      recipients.map((r: { email: string }) =>
        userMail.transporter.sendMail({
          from: userMail.fromEmail,
          to: r.email,
          subject: campaign.subject,
          text: campaign.body,
          html: `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.6">${campaign.body}</div>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter((r) => r.status === 'fulfilled').length;

    await pool.query(
      `UPDATE email_campaigns
       SET status = 'sent', delivered_count = $1, sent_at = now(), updated_at = now()
       WHERE id = $2`,
      [deliveredCount, id],
    );

    const updated = await pool.query(`SELECT * FROM email_campaigns WHERE id = $1`, [id]);

    res.json({
      message: 'Campaign sent',
      delivered_count: deliveredCount,
      recipients: recipients.length,
      campaign: updated.rows[0],
    });
  } catch (error: any) {
    console.error('Send campaign error:', error);
    const { code, message } = classifySmtpError(error);
    res.status(500).json({ code, message });
  }
};

// ─── DELETE /email-campaigns/:id ─────────────────────────────────────────────

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM email_campaigns WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found.' });
    }
    res.json({ message: 'Campaign deleted.' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── POST /email/send ─────────────────────────────────────────────────────────

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

  const tenantId = req.user!.tenant_id;
  const createdBy = req.user!.id;

  try {
    const userMail = await getUserTransporter(createdBy);
    if (!userMail) {
      return res.status(400).json({
        code: "EMAIL_NOT_CONFIGURED",
        message:
          "Email not configured. Go to Settings → Email to connect your email.",
      });
    }

    const sendResults = await Promise.allSettled(
      recipients.map((recipient: any) =>
        userMail.transporter.sendMail({
          from: userMail.fromEmail,
          to: recipient.email,
          subject,
          text: body,
          html: `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
        }),
      ),
    );

    const deliveredCount = sendResults.filter(
      (r) => r.status === "fulfilled",
    ).length;

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
        createdBy,
      ],
    );

    res.json({
      message: "Emails processed",
      delivered_count: deliveredCount,
      recipients: recipients.length,
    });
  } catch (error: any) {
    console.error("Send email error:", error);
    res.status(500).json({ message: error?.message ?? "Unable to send email" });
  }
};
