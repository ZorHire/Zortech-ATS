import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

// ─── Compute and persist vendor performance metrics ───────────────────────────
export async function refreshVendorMetrics(
  vendorId: string,
  tenantId: string,
): Promise<void> {
  await pool.query(
    `WITH sub_stats AS (
       SELECT
         COUNT(*)                                                           AS submission_count,
         ROUND(
           COUNT(*) FILTER (WHERE ja.stage IN ('shortlisted','offered','hired'))
           * 100.0 / NULLIF(COUNT(*), 0)
         )                                                                  AS shortlist_rate,
         ROUND(
           COUNT(*) FILTER (
             WHERE j.sla_deadline IS NULL OR vps.created_at <= j.sla_deadline
           ) * 100.0 / NULLIF(COUNT(*), 0)
         )                                                                  AS sla_adherence
       FROM vendor_portal_submissions vps
       JOIN jobs j ON j.id = vps.job_id
       LEFT JOIN job_applications ja ON ja.id = vps.application_id
       WHERE vps.vendor_id = $1 AND vps.tenant_id = $2
     ),
     fill_stats AS (
       SELECT
         ROUND(
           COUNT(DISTINCT vps.job_id) FILTER (WHERE ja.stage = 'hired')
           * 100.0 / NULLIF(COUNT(DISTINCT j.id), 0)
         ) AS fill_rate
       FROM jobs j
       LEFT JOIN vendor_portal_submissions vps
         ON vps.job_id = j.id AND vps.vendor_id = $1 AND vps.tenant_id = $2
       LEFT JOIN job_applications ja ON ja.id = vps.application_id
       WHERE j.tenant_id = $2
         AND j.deleted_at IS NULL
         AND (j.assigned_vendor_ids @> ARRAY[$1::uuid] OR j.assigned_vendor_id = $1)
     )
     UPDATE vendors
     SET
       submission_count = COALESCE(ss.submission_count, 0),
       shortlist_rate   = COALESCE(ss.shortlist_rate, 0),
       sla_adherence    = COALESCE(ss.sla_adherence, 100),
       fill_rate        = COALESCE(fs.fill_rate, 0),
       quality_score    = ROUND(
         COALESCE(ss.shortlist_rate, 0) * 0.5
         + COALESCE(fs.fill_rate, 0) * 0.3
         + COALESCE(ss.sla_adherence, 100) * 0.2
       ),
       updated_at = now()
     FROM sub_stats ss, fill_stats fs
     WHERE vendors.id = $1 AND vendors.tenant_id = $2`,
    [vendorId, tenantId],
  );
}

export const getVendors = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    const result = await pool.query(
      'SELECT * FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY company_name ASC',
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVendorById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      'SELECT * FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createVendor = async (req: AuthRequest, res: Response) => {
  const { company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `INSERT INTO vendors (tenant_id, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations || [], geographies || [], tier || 'standard']
    );

    const newVendor = result.rows[0];

    res.status(201).json(newVendor);
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateVendor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active } = req.body;
  const tenantId = req.user?.tenant_id;

  try {
    const result = await pool.query(
      `UPDATE vendors SET 
       company_name = COALESCE($1, company_name),
       registration_number = COALESCE($2, registration_number),
       gst_id = COALESCE($3, gst_id),
       primary_contact_name = COALESCE($4, primary_contact_name),
       primary_contact_email = COALESCE($5, primary_contact_email),
       primary_contact_phone = COALESCE($6, primary_contact_phone),
       industry_specializations = COALESCE($7, industry_specializations),
       geographies = COALESCE($8, geographies),
       tier = COALESCE($9, tier),
       is_active = COALESCE($10, is_active),
       updated_at = now()
       WHERE id = $11 AND tenant_id = $12 AND deleted_at IS NULL
       RETURNING *`,
      [company_name, registration_number, gst_id, primary_contact_name, primary_contact_email, primary_contact_phone, industry_specializations, geographies, tier, is_active, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteVendor = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user?.tenant_id;
  try {
    const result = await pool.query(
      'UPDATE vendors SET deleted_at = now() WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── GET /vendors/:id/scorecard ───────────────────────────────────────────────
export const getVendorScorecard = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenant_id;
  try {
    await refreshVendorMetrics(String(id), tenantId);

    const [vendorRes, breakdownRes, recentRes] = await Promise.all([
      pool.query(
        `SELECT id, company_name, tier, submission_count, shortlist_rate,
                fill_rate, quality_score, sla_adherence, is_active
         FROM vendors WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, tenantId],
      ),
      pool.query(
        `SELECT
           j.id AS job_id, j.title, j.status AS job_status,
           COUNT(vps.id)::int                                                           AS submissions,
           COUNT(vps.id) FILTER (WHERE ja.stage IN ('shortlisted','offered','hired'))::int AS shortlisted,
           COUNT(vps.id) FILTER (WHERE ja.stage = 'hired')::int                        AS hired,
           COUNT(vps.id) FILTER (WHERE ja.stage = 'rejected')::int                     AS rejected
         FROM jobs j
         LEFT JOIN vendor_portal_submissions vps
           ON vps.job_id = j.id AND vps.vendor_id = $1 AND vps.tenant_id = $2
         LEFT JOIN job_applications ja ON ja.id = vps.application_id
         WHERE j.tenant_id = $2
           AND j.deleted_at IS NULL
           AND (j.assigned_vendor_ids @> ARRAY[$1::uuid] OR j.assigned_vendor_id = $1)
         GROUP BY j.id, j.title, j.status
         ORDER BY submissions DESC
         LIMIT 10`,
        [id, tenantId],
      ),
      pool.query(
        `SELECT
           vps.candidate_full_name, vps.candidate_email, vps.created_at,
           j.title AS job_title, ja.stage AS pipeline_stage
         FROM vendor_portal_submissions vps
         JOIN jobs j ON j.id = vps.job_id
         LEFT JOIN job_applications ja ON ja.id = vps.application_id
         WHERE vps.vendor_id = $1 AND vps.tenant_id = $2
         ORDER BY vps.created_at DESC
         LIMIT 5`,
        [id, tenantId],
      ),
    ]);

    if (vendorRes.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    res.json({
      ...vendorRes.rows[0],
      job_breakdown: breakdownRes.rows,
      recent_submissions: recentRes.rows,
    });
  } catch (error) {
    console.error('getVendorScorecard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};