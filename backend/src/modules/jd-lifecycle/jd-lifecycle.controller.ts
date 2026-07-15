import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { invalidate } from "../../lib/cache";
import {
  getUserTransporter,
  getTenantTransporter,
} from "../email/email.controller";

// ─── Submit for Review ────────────────────────────────────────────────────────

export const submitForReview = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const jobRes = await client.query(
      `SELECT * FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (jobRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Job not found" });
    }
    const job = jobRes.rows[0];

    if (job.status !== "draft") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Cannot submit for review: job is currently '${job.status}'. Only draft jobs can be submitted.`,
      });
    }

    // Check no existing pending approval
    const existingRes = await client.query(
      `SELECT id FROM job_approvals WHERE job_id = $1 AND status = 'pending'`,
      [id],
    );
    if (existingRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "A review is already pending for this job." });
    }

    // Next version number
    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version_num), 0) + 1 AS next_version FROM job_versions WHERE job_id = $1`,
      [id],
    );
    const versionNum: number = versionRes.rows[0].next_version;

    // Snapshot the job
    await client.query(
      `INSERT INTO job_versions (job_id, tenant_id, version_num, submitted_by, snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, tenantId, versionNum, userId, JSON.stringify(job)],
    );

    // Create approval record
    const approvalRes = await client.query(
      `INSERT INTO job_approvals (job_id, tenant_id, submitted_by, version_num)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, tenantId, userId, versionNum],
    );

    // Update job status
    await client.query(
      `UPDATE jobs SET status = 'pending_review', updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await client.query("COMMIT");
    await invalidate(`tenant:${tenantId}:jobs`);

    res.json({
      message: "Job submitted for review.",
      approval: approvalRes.rows[0],
      version_num: versionNum,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("submitForReview error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── Approve ─────────────────────────────────────────────────────────────────

export const approveJob = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body as { notes?: string };
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const jobRes = await client.query(
      `SELECT * FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (jobRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Job not found" });
    }
    if (jobRes.rows[0].status !== "pending_review") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Cannot approve: job status is '${jobRes.rows[0].status}'.`,
      });
    }

    // Update pending approval
    const approvalRes = await client.query(
      `UPDATE job_approvals
       SET status = 'approved', reviewed_by = $1, reviewed_at = now(), notes = $2
       WHERE job_id = $3 AND status = 'pending'
       RETURNING *`,
      [userId, notes ?? null, id],
    );
    if (approvalRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No pending approval found for this job." });
    }

    // Activate job
    await client.query(
      `UPDATE jobs SET status = 'active', updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await client.query("COMMIT");
    await invalidate(`tenant:${tenantId}:jobs`);

    // Broadcast to assigned vendors (fire-and-forget — don't fail the approval)
    broadcastToVendors(String(id), tenantId, userId, jobRes.rows[0]).catch((err) =>
      console.error("broadcastToVendors error:", err),
    );

    res.json({
      message: "Job approved and set to active.",
      approval: approvalRes.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("approveJob error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── Reject ───────────────────────────────────────────────────────────────────

export const rejectJob = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body as { notes?: string };
  const tenantId = req.user!.tenant_id;
  const userId = req.user!.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const jobRes = await client.query(
      `SELECT status FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, tenantId],
    );
    if (jobRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Job not found" });
    }
    if (jobRes.rows[0].status !== "pending_review") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Cannot reject: job status is '${jobRes.rows[0].status}'.`,
      });
    }

    const approvalRes = await client.query(
      `UPDATE job_approvals
       SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), notes = $2
       WHERE job_id = $3 AND status = 'pending'
       RETURNING *`,
      [userId, notes ?? null, id],
    );
    if (approvalRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No pending approval found for this job." });
    }

    // Return job to draft
    await client.query(
      `UPDATE jobs SET status = 'draft', updated_at = now()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    await client.query("COMMIT");
    await invalidate(`tenant:${tenantId}:jobs`);

    res.json({
      message: "Job rejected and returned to draft.",
      approval: approvalRes.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("rejectJob error:", err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ─── Get current approval for a job ──────────────────────────────────────────

export const getJobApproval = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT ja.*,
              u1.full_name AS submitter_name,
              u2.full_name AS reviewer_name
       FROM job_approvals ja
       LEFT JOIN profiles u1 ON u1.id = ja.submitted_by
       LEFT JOIN profiles u2 ON u2.id = ja.reviewed_by
       WHERE ja.job_id = $1 AND ja.tenant_id = $2
       ORDER BY ja.created_at DESC LIMIT 1`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("getJobApproval error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Get version history for a job ───────────────────────────────────────────

export const getJobVersions = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT jv.id, jv.version_num, jv.created_at,
              p.full_name AS submitted_by_name,
              jv.snapshot->>'title' AS title,
              jv.snapshot->>'status' AS status
       FROM job_versions jv
       LEFT JOIN profiles p ON p.id = jv.submitted_by
       WHERE jv.job_id = $1 AND jv.tenant_id = $2
       ORDER BY jv.version_num DESC`,
      [id, tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getJobVersions error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Pending approvals list (for admins) ─────────────────────────────────────

export const getPendingApprovals = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const result = await pool.query(
      `SELECT ja.id AS approval_id, ja.submitted_at, ja.version_num,
              j.id AS job_id, j.title, j.priority, j.status,
              c.name AS client_name,
              p.full_name AS submitter_name
       FROM job_approvals ja
       JOIN jobs j ON j.id = ja.job_id
       JOIN clients c ON c.id = j.client_id
       LEFT JOIN profiles p ON p.id = ja.submitted_by
       WHERE ja.tenant_id = $1 AND ja.status = 'pending'
         AND j.deleted_at IS NULL
       ORDER BY ja.submitted_at ASC`,
      [tenantId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("getPendingApprovals error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Vendor broadcast (internal, fire-and-forget) ────────────────────────────

async function broadcastToVendors(
  _jobId: string,
  tenantId: string,
  approverId: string,
  job: Record<string, unknown>,
) {
  // Collect assigned vendor IDs (array column + single column)
  const vendorIds: string[] = [];
  if (Array.isArray(job.assigned_vendor_ids)) {
    vendorIds.push(...(job.assigned_vendor_ids as string[]));
  }
  if (job.assigned_vendor_id && !vendorIds.includes(job.assigned_vendor_id as string)) {
    vendorIds.push(job.assigned_vendor_id as string);
  }
  if (vendorIds.length === 0) return;

  // Fetch vendor contact emails
  const placeholders = vendorIds.map((_, i) => `$${i + 1}`).join(",");
  const vendorRes = await pool.query(
    `SELECT company_name, primary_contact_email
     FROM vendors
     WHERE id IN (${placeholders}) AND tenant_id = $${vendorIds.length + 1}
       AND deleted_at IS NULL AND primary_contact_email IS NOT NULL`,
    [...vendorIds, tenantId],
  );
  if (vendorRes.rows.length === 0) return;

  // Get SMTP transporter — user first, tenant fallback
  let transport: Awaited<ReturnType<typeof getUserTransporter>> = null;
  try {
    transport = await getUserTransporter(approverId);
  } catch {
    // ignore
  }
  if (!transport) {
    try {
      transport = await getTenantTransporter(tenantId);
    } catch {
      // ignore
    }
  }
  if (!transport) {
    console.warn(`broadcastToVendors: no SMTP configured for tenant ${tenantId}, skipping`);
    return;
  }

  const { transporter, fromEmail } = transport;
  const jobTitle = job.title as string;
  const jobLocation = job.location as string;
  const jobSkills = Array.isArray(job.mandatory_skills)
    ? (job.mandatory_skills as string[]).join(", ")
    : "";

  for (const vendor of vendorRes.rows) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to: vendor.primary_contact_email,
        subject: `New Opportunity: ${jobTitle}`,
        html: `
          <p>Dear ${vendor.company_name},</p>
          <p>A new job opening has been approved and is now available for candidate submissions.</p>
          <table style="border-collapse:collapse;width:100%;max-width:500px">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Position</td><td style="padding:6px 0;font-weight:600;font-size:13px">${jobTitle}</td></tr>
            ${jobLocation ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Location</td><td style="padding:6px 0;font-size:13px">${jobLocation}</td></tr>` : ""}
            ${jobSkills ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Key Skills</td><td style="padding:6px 0;font-size:13px">${jobSkills}</td></tr>` : ""}
            ${job.experience_min != null ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Experience</td><td style="padding:6px 0;font-size:13px">${job.experience_min}–${job.experience_max} years</td></tr>` : ""}
          </table>
          <p style="margin-top:16px">Please log in to the Vendor Portal to view the full JD and submit candidates.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:24px">You are receiving this because your firm is assigned to this position.</p>
        `,
      });
    } catch (err) {
      console.error(`broadcastToVendors: failed to email ${vendor.primary_contact_email}:`, err);
    }
  }
}
