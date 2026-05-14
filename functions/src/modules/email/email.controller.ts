import { Response } from "express";
import { AuthRequest, hasPermission } from "../../middleware/auth";
import { platformPool } from "../../db/platform";
import { getAtsPool } from "../../db/poolRouter";
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
  if (!hasPermission(req, "email:send")) {
    return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  }
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

    const db = await getAtsPool(tenantId);
    await db.query(
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
  if (!hasPermission(req, "email:send")) {
    return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  }
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

// ─── Assign JD email ─────────────────────────────────────────────────────────

export const assignJd = async (req: AuthRequest, res: Response) => {
  const { job_id, deadline_days, site_url } = req.body;
  // Accept vendor_ids array or fall back to legacy vendor_id
  const vendor_ids: string[] = req.body.vendor_ids?.length
    ? req.body.vendor_ids
    : req.body.vendor_id
    ? [req.body.vendor_id]
    : [];

  if (!vendor_ids.length || !job_id || !deadline_days) {
    return res
      .status(400)
      .json({ message: "vendor_ids (or vendor_id), job_id, and deadline_days are required" });
  }
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  try {
    const db = await getAtsPool(tenantId);
    const [jobResult, vendorResult] = await Promise.all([
      db.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2",
        [job_id, tenantId],
      ),
      db.query(
        "SELECT id, company_name, primary_contact_email FROM vendors WHERE id = ANY($1) AND tenant_id = $2 AND deleted_at IS NULL",
        [vendor_ids, tenantId],
      ),
    ]);

    if (jobResult.rows.length === 0)
      return res.status(404).json({ message: "Job not found" });
    if (vendorResult.rows.length === 0)
      return res.status(404).json({ message: "No valid vendors found" });

    const job = jobResult.rows[0];
    const vendors = vendorResult.rows;

    const days = Number(deadline_days);
    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    const urlPart = site_url ? ` at ${site_url}` : "";
    const body = `You have been assigned "${job.title}" and you have ${dayLabel} to add candidates to the JD${urlPart}.`;

    // Update both legacy single column (first item) and new array column
    await db.query(
      "UPDATE jobs SET assigned_vendor_id = $1, assigned_vendor_ids = $2, updated_at = now() WHERE id = $3 AND tenant_id = $4",
      [vendors[0].id, vendor_ids, job_id, tenantId],
    );

    await Promise.allSettled(
      vendors.map((vendor) =>
        sendEmailAsUser({
          userId,
          tenantId,
          to: vendor.primary_contact_email,
          subject: `JD Assignment: ${job.title}`,
          html: `<div style="font-family:sans-serif;line-height:1.6">${body}</div>`,
        }),
      ),
    );

    res.json({ message: "Assignment email(s) sent successfully" });
  } catch (err) {
    handleEmailError(err, res);
  }
};

// ─── Assign JD to Recruiter (Accounts Manager flow) ──────────────────────────

export const assignJdToRecruiter = async (req: AuthRequest, res: Response) => {
  const { job_id, deadline_days, site_url } = req.body;
  // Accept recruiter_ids array or fall back to legacy recruiter_id
  const recruiter_ids: string[] = req.body.recruiter_ids?.length
    ? req.body.recruiter_ids
    : req.body.recruiter_id
    ? [req.body.recruiter_id]
    : [];

  if (!recruiter_ids.length || !job_id || !deadline_days) {
    return res
      .status(400)
      .json({ message: "recruiter_ids (or recruiter_id), job_id, and deadline_days are required" });
  }
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  try {
    const db = await getAtsPool(tenantId);

    // jobs is an ATS table (tenant DB); users/profiles/memberships are platform tables
    const [jobResult, recruiterResult] = await Promise.all([
      db.query(
        "SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2",
        [job_id, tenantId],
      ),
      platformPool.query(
        `SELECT u.id, u.email, p.full_name
           FROM users u
           JOIN tenant_memberships tm ON tm.user_id = u.id
           LEFT JOIN profiles p ON p.id = u.id
          WHERE u.id = ANY($1) AND tm.tenant_id = $2 AND tm.role = 'recruiter'`,
        [recruiter_ids, tenantId],
      ),
    ]);

    if (jobResult.rows.length === 0)
      return res.status(404).json({ message: "Job not found" });
    if (recruiterResult.rows.length === 0)
      return res.status(404).json({ message: "No valid recruiters found" });

    const job = jobResult.rows[0];
    const recruiters = recruiterResult.rows;

    const days = Number(deadline_days);
    const dayLabel = days === 1 ? "1 day" : `${days} days`;
    const urlPart = site_url ? ` at ${site_url}` : "";
    const bodyText = `You have been assigned to "${job.title}" and you have ${dayLabel} to work on this role${urlPart}.`;

    // Update both legacy single column (first item) and new array column
    await db.query(
      "UPDATE jobs SET assigned_recruiter_id = $1, assigned_recruiter_ids = $2, updated_at = now() WHERE id = $3 AND tenant_id = $4",
      [recruiters[0].id, recruiter_ids, job_id, tenantId],
    );

    await Promise.allSettled(
      recruiters.map((recruiter) =>
        sendEmailAsUser({
          userId,
          tenantId,
          to: recruiter.email,
          subject: `JD Assignment: ${job.title}`,
          html: `<div style="font-family:sans-serif;line-height:1.6">
            <p>Hi ${recruiter.full_name || "there"},</p>
            <p>${bodyText}</p>
          </div>`,
        }),
      ),
    );

    res.json({ message: "Assignment email(s) sent successfully" });
  } catch (err) {
    handleEmailError(err, res);
  }
};

// ─── Campaign management ──────────────────────────────────────────────────────

export const listCampaigns = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const db = await getAtsPool(tenantId);
    const result = await db.query(
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
    const db = await getAtsPool(tenantId);
    const result = await db.query(
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
    const db = await getAtsPool(tenantId);
    const campaignResult = await db.query(
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

    await db.query(
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
