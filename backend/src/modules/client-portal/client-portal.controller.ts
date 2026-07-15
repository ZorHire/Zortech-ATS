import { Response } from "express";
import bcrypt from "bcryptjs";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

// ── Helper: resolve client_id for the logged-in client_user ─────────────────
async function getClientId(userId: string, tenantId: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT client_id FROM client_users WHERE user_id = $1 AND tenant_id = $2",
    [userId, tenantId],
  );
  return result.rows[0]?.client_id ?? null;
}

// ── Admin endpoints (super_admin / accounts_manager only) ────────────────────

// POST /client-portal/admin/users
// Creates a new client_user account and links it to a client company.
export const createClientUser = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const createdBy = req.user?.id;

  const { email, full_name, client_id, password } = req.body;
  if (!email || !full_name || !client_id || !password) {
    return res
      .status(400)
      .json({ message: "email, full_name, client_id, and password are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify client belongs to this tenant
    const clientCheck = await client.query(
      "SELECT id FROM clients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [client_id, tenantId],
    );
    if (clientCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Client not found." });
    }

    // Check for duplicate email
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase().trim()],
    );
    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email already registered." });
    }

    const hashed = await bcrypt.hash(password, 12);
    const emailNorm = email.toLowerCase().trim();

    // Create user
    const userResult = await client.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [emailNorm, hashed],
    );
    const userId = userResult.rows[0].id;

    // Create profile
    await client.query(
      "INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3)",
      [userId, emailNorm, full_name],
    );

    // Create tenant membership with client_user role
    await client.query(
      `INSERT INTO tenant_memberships (user_id, tenant_id, role) VALUES ($1, $2, 'client_user')`,
      [userId, tenantId],
    );

    // Link to client company
    await client.query(
      "INSERT INTO client_users (tenant_id, client_id, user_id) VALUES ($1, $2, $3)",
      [tenantId, client_id, userId],
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Client user created successfully.",
      user_id: userId,
      email: emailNorm,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("createClientUser error:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

// GET /client-portal/admin/users
// Lists all client_user accounts for this tenant.
export const listClientUsers = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.email, u.is_active,
         p.full_name, p.phone,
         cu.client_id, c.name AS client_name,
         cu.created_at
       FROM client_users cu
       JOIN users u ON u.id = cu.user_id
       JOIN profiles p ON p.id = cu.user_id
       JOIN clients c ON c.id = cu.client_id
       WHERE cu.tenant_id = $1
       ORDER BY cu.created_at DESC`,
      [tenantId],
    );
    res.json(result.rows);
  } catch (error) {
    console.error("listClientUsers error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /client-portal/admin/jobs/:jobId/grant
// Shares a JD with a client.
export const grantJobAccess = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const grantedBy = req.user?.id;
  const { jobId } = req.params;
  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required." });
  }

  try {
    // Verify job and client belong to this tenant
    const [jobCheck, clientCheck] = await Promise.all([
      pool.query("SELECT id FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [jobId, tenantId]),
      pool.query("SELECT id FROM clients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", [client_id, tenantId]),
    ]);

    if (jobCheck.rows.length === 0) return res.status(404).json({ message: "Job not found." });
    if (clientCheck.rows.length === 0) return res.status(404).json({ message: "Client not found." });

    await pool.query(
      `INSERT INTO client_job_access (tenant_id, client_id, job_id, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_id, job_id) DO NOTHING`,
      [tenantId, client_id, jobId, grantedBy],
    );

    res.json({ message: "Job access granted." });
  } catch (error) {
    console.error("grantJobAccess error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /client-portal/admin/jobs/:jobId/revoke
// Removes a client's access to a JD.
export const revokeJobAccess = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { jobId } = req.params;
  const { client_id } = req.body;

  if (!client_id) {
    return res.status(400).json({ message: "client_id is required." });
  }

  try {
    await pool.query(
      "DELETE FROM client_job_access WHERE client_id = $1 AND job_id = $2 AND tenant_id = $3",
      [client_id, jobId, tenantId],
    );
    res.json({ message: "Job access revoked." });
  } catch (error) {
    console.error("revokeJobAccess error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Client-facing endpoints ──────────────────────────────────────────────────

// GET /client-portal/jobs
export const getAccessibleJobs = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;

  try {
    const clientId = await getClientId(userId!, tenantId!);
    if (!clientId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a client company." });
    }

    const result = await pool.query(
      `SELECT
         j.id, j.title, j.department, j.location, j.work_mode, j.employment_type,
         j.experience_min, j.experience_max, j.status, j.priority, j.headcount,
         j.mandatory_skills, j.preferred_skills, j.description,
         j.target_start_date, j.created_at,
         (SELECT COUNT(*) FROM job_applications ja
          WHERE ja.job_id = j.id AND ja.stage = 'submitted_to_client'
         ) AS pending_review_count,
         (SELECT COUNT(*) FROM client_feedback cf
          WHERE cf.client_id = $2
            AND cf.application_id IN (SELECT id FROM job_applications WHERE job_id = j.id)
         ) AS reviewed_count
       FROM client_job_access cja
       JOIN jobs j ON j.id = cja.job_id
       WHERE cja.client_id = $2 AND cja.tenant_id = $1 AND j.deleted_at IS NULL
       ORDER BY cja.granted_at DESC`,
      [tenantId, clientId],
    );

    res.json({ client_id: clientId, jobs: result.rows });
  } catch (error) {
    console.error("getAccessibleJobs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /client-portal/jobs/:jobId/candidates
// Returns candidates at 'submitted_to_client' stage, with any existing feedback from this client.
export const getJobCandidates = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { jobId } = req.params;

  try {
    const clientId = await getClientId(userId!, tenantId!);
    if (!clientId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a client company." });
    }

    // Verify client has access to this job
    const accessCheck = await pool.query(
      "SELECT id FROM client_job_access WHERE client_id = $1 AND job_id = $2 AND tenant_id = $3",
      [clientId, jobId, tenantId],
    );
    if (accessCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this job." });
    }

    const result = await pool.query(
      `SELECT
         ja.id AS application_id, ja.stage, ja.notes, ja.created_at AS applied_at,
         cand.id AS candidate_id, cand.full_name, cand.email, cand.phone,
         cand.current_title, cand.experience_years, cand.current_location,
         cand.skills, cand.summary, cand.resume_url,
         cf.decision AS client_decision, cf.notes AS client_notes, cf.updated_at AS feedback_at
       FROM job_applications ja
       JOIN candidates cand ON cand.id = ja.candidate_id
       LEFT JOIN client_feedback cf
         ON cf.application_id = ja.id AND cf.client_id = $2
       WHERE ja.job_id = $3 AND ja.tenant_id = $1
         AND ja.stage = 'submitted_to_client'
         AND cand.deleted_at IS NULL
       ORDER BY ja.created_at DESC`,
      [tenantId, clientId, jobId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("getJobCandidates error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /client-portal/candidates/:applicationId/feedback
// Body: { decision: 'approved'|'rejected'|'hold', notes?: string }
export const submitFeedback = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;
  const { applicationId } = req.params;
  const { decision, notes } = req.body;

  if (!decision || !["approved", "rejected", "hold"].includes(decision)) {
    return res
      .status(400)
      .json({ message: "decision must be 'approved', 'rejected', or 'hold'." });
  }

  try {
    const clientId = await getClientId(userId!, tenantId!);
    if (!clientId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a client company." });
    }

    // Verify this application belongs to a job the client can access
    const accessCheck = await pool.query(
      `SELECT ja.id FROM job_applications ja
       JOIN client_job_access cja ON cja.job_id = ja.job_id
       WHERE ja.id = $1 AND ja.tenant_id = $2 AND cja.client_id = $3`,
      [applicationId, tenantId, clientId],
    );
    if (accessCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this candidate." });
    }

    await pool.query(
      `INSERT INTO client_feedback (tenant_id, application_id, client_id, decision, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (application_id, client_id)
       DO UPDATE SET decision = EXCLUDED.decision, notes = EXCLUDED.notes, updated_at = now()`,
      [tenantId, applicationId, clientId, decision, notes || null, userId],
    );

    res.json({ message: "Feedback recorded." });
  } catch (error) {
    console.error("submitFeedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /client-portal/profile
export const getClientProfile = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const userId = req.user?.id;

  try {
    const clientId = await getClientId(userId!, tenantId!);
    if (!clientId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a client company." });
    }

    const result = await pool.query(
      `SELECT id, name, industry, company_size, website, headquarters_location,
              primary_contact_name, primary_contact_email, engagement_type, tier
       FROM clients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [clientId, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Client profile not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("getClientProfile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
