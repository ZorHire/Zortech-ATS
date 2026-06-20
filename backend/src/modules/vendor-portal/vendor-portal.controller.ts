import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

// ── Helper: resolve vendor_id for the logged-in vendor_user ─────────────────
async function getVendorId(userId: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT vendor_id FROM profiles WHERE id = $1",
    [userId],
  );
  return result.rows[0]?.vendor_id ?? null;
}

// GET /vendor-portal/jobs
export const getAssignedJobs = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;

    const vendorId = await getVendorId(userId!);
    if (!vendorId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a vendor company." });
    }

    const result = await pool.query(
      `SELECT
         j.id, j.title, j.department, j.location, j.work_mode, j.employment_type,
         j.experience_min, j.experience_max, j.status, j.priority, j.headcount,
         j.mandatory_skills, j.preferred_skills, j.description,
         j.target_start_date, j.sla_deadline, j.created_at,
         c.name AS client_name,
         (SELECT COUNT(*) FROM vendor_portal_submissions vps
          WHERE vps.job_id = j.id AND vps.vendor_id = $2 AND vps.tenant_id = $1
         ) AS my_submission_count
       FROM jobs j
       LEFT JOIN clients c ON c.id = j.client_id
       WHERE j.tenant_id = $1
         AND j.deleted_at IS NULL
         AND j.status IN ('active','on_hold')
         AND (j.assigned_vendor_ids @> ARRAY[$2::uuid]
              OR j.assigned_vendor_id = $2)
       ORDER BY j.created_at DESC`,
      [tenantId, vendorId],
    );

    res.json({ vendor_id: vendorId, jobs: result.rows });
  } catch (error) {
    console.error("Vendor portal getAssignedJobs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /vendor-portal/jobs/:id
export const getJobDetail = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;
    const { id } = req.params;

    const vendorId = await getVendorId(userId!);
    if (!vendorId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a vendor company." });
    }

    const result = await pool.query(
      `SELECT
         j.id, j.title, j.department, j.location, j.work_mode, j.employment_type,
         j.experience_min, j.experience_max, j.status, j.priority, j.headcount,
         j.mandatory_skills, j.preferred_skills, j.description,
         j.salary_min, j.salary_max, j.currency,
         j.target_start_date, j.sla_deadline, j.created_at,
         c.name AS client_name
       FROM jobs j
       LEFT JOIN clients c ON c.id = j.client_id
       WHERE j.id = $1
         AND j.tenant_id = $2
         AND j.deleted_at IS NULL
         AND (j.assigned_vendor_ids @> ARRAY[$3::uuid]
              OR j.assigned_vendor_id = $3)`,
      [id, tenantId, vendorId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Job not found or not assigned to your vendor." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Vendor portal getJobDetail error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /vendor-portal/submit
// Body: { job_id, candidate_full_name, candidate_email, candidate_phone?,
//         experience_years?, skills?, cover_note? }
export const submitCandidate = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;

    const vendorId = await getVendorId(userId!);
    if (!vendorId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a vendor company." });
    }

    const {
      job_id,
      candidate_full_name,
      candidate_email,
      candidate_phone,
      experience_years,
      skills,
      cover_note,
    } = req.body;

    if (!job_id || !candidate_full_name || !candidate_email) {
      return res
        .status(400)
        .json({ message: "job_id, candidate_full_name, and candidate_email are required." });
    }

    // Verify job is assigned to this vendor
    const jobCheck = await pool.query(
      `SELECT id FROM jobs
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         AND status = 'active'
         AND (assigned_vendor_ids @> ARRAY[$3::uuid] OR assigned_vendor_id = $3)`,
      [job_id, tenantId, vendorId],
    );
    if (jobCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "This job is not assigned to your vendor or is not active." });
    }

    // Check for duplicate submission by this vendor for this job
    const dupCheck = await pool.query(
      `SELECT id FROM vendor_portal_submissions
       WHERE vendor_id = $1 AND job_id = $2 AND tenant_id = $3 AND candidate_email = $4`,
      [vendorId, job_id, tenantId, candidate_email.toLowerCase().trim()],
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        message: "You have already submitted this candidate for this job.",
      });
    }

    const emailNorm = candidate_email.toLowerCase().trim();
    const skillsArr = Array.isArray(skills) ? skills : [];

    // Upsert candidate (match by email within tenant)
    const candidateResult = await pool.query(
      `INSERT INTO candidates (tenant_id, full_name, email, phone, experience_years, skills, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'vendor', $7)
       ON CONFLICT (email) WHERE deleted_at IS NULL
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = COALESCE(EXCLUDED.phone, candidates.phone),
         experience_years = COALESCE(EXCLUDED.experience_years, candidates.experience_years),
         skills = CASE WHEN array_length(EXCLUDED.skills, 1) > 0 THEN EXCLUDED.skills ELSE candidates.skills END,
         updated_at = now()
       RETURNING id`,
      [tenantId, candidate_full_name, emailNorm, candidate_phone || null, experience_years || null, skillsArr, userId],
    );
    const candidateId = candidateResult.rows[0].id;

    // Create job_application (ignore if candidate already in this job's pipeline)
    const appResult = await pool.query(
      `INSERT INTO job_applications (tenant_id, job_id, candidate_id, stage)
       VALUES ($1, $2, $3, 'new')
       ON CONFLICT (tenant_id, job_id, candidate_id) DO NOTHING
       RETURNING id`,
      [tenantId, job_id, candidateId],
    );
    const applicationId = appResult.rows[0]?.id ?? null;

    // If we inserted, log the pipeline event
    if (applicationId) {
      await pool.query(
        `INSERT INTO pipeline_events (tenant_id, application_id, to_stage, changed_by, note)
         VALUES ($1, $2, 'new', $3, $4)`,
        [tenantId, applicationId, userId, `Submitted by vendor via portal. Note: ${cover_note || "—"}`],
      );
    }

    // Record the vendor portal submission for vendor tracking
    const submissionResult = await pool.query(
      `INSERT INTO vendor_portal_submissions
         (tenant_id, vendor_id, job_id, submitted_by, application_id,
          candidate_full_name, candidate_email, candidate_phone,
          experience_years, skills, cover_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        tenantId, vendorId, job_id, userId, applicationId,
        candidate_full_name, emailNorm, candidate_phone || null,
        experience_years || null, skillsArr, cover_note || null,
      ],
    );

    res.status(201).json({
      message: "Candidate submitted successfully.",
      submission_id: submissionResult.rows[0].id,
      candidate_id: candidateId,
      application_id: applicationId,
    });
  } catch (error) {
    console.error("Vendor portal submitCandidate error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /vendor-portal/submissions
export const getSubmissions = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;

    const vendorId = await getVendorId(userId!);
    if (!vendorId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a vendor company." });
    }

    const result = await pool.query(
      `SELECT
         vps.id, vps.candidate_full_name, vps.candidate_email, vps.candidate_phone,
         vps.experience_years, vps.skills, vps.cover_note, vps.status, vps.created_at,
         j.id AS job_id, j.title AS job_title, j.location AS job_location,
         c.name AS client_name,
         ja.stage AS pipeline_stage,
         ja.rejection_reason
       FROM vendor_portal_submissions vps
       JOIN jobs j ON j.id = vps.job_id
       LEFT JOIN clients c ON c.id = j.client_id
       LEFT JOIN job_applications ja ON ja.id = vps.application_id
       WHERE vps.vendor_id = $1 AND vps.tenant_id = $2
       ORDER BY vps.created_at DESC`,
      [vendorId, tenantId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Vendor portal getSubmissions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /vendor-portal/profile  — read-only vendor company info
export const getVendorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;

    const vendorId = await getVendorId(userId!);
    if (!vendorId) {
      return res
        .status(403)
        .json({ message: "Your account is not linked to a vendor company." });
    }

    const result = await pool.query(
      `SELECT id, company_name, primary_contact_name, primary_contact_email,
              primary_contact_phone, industry_specializations, geographies, tier, is_active
       FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [vendorId, tenantId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Vendor profile not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Vendor portal getVendorProfile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
