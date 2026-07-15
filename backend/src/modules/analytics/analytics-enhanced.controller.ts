import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const getTimeToFill = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { from, to, department } = req.query;
  try {
    const conditions: string[] = ['ja.tenant_id=$1', "ja.stage='joined'"];
    const params: any[] = [tenantId];
    let i = 2;
    if (from) { conditions.push(`ja.created_at >= $${i++}`); params.push(from); }
    if (to) { conditions.push(`ja.created_at <= $${i++}`); params.push(to); }
    if (department) { conditions.push(`j.department = $${i++}`); params.push(department); }

    const result = await pool.query(`
      SELECT
        j.department,
        j.work_mode,
        COUNT(*) as placements,
        ROUND(AVG(EXTRACT(EPOCH FROM (ja.updated_at - j.created_at))/86400)::numeric, 1) as avg_days_to_fill,
        ROUND(MIN(EXTRACT(EPOCH FROM (ja.updated_at - j.created_at))/86400)::numeric, 1) as min_days,
        ROUND(MAX(EXTRACT(EPOCH FROM (ja.updated_at - j.created_at))/86400)::numeric, 1) as max_days
      FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY j.department, j.work_mode
      ORDER BY avg_days_to_fill DESC
    `, params);

    const overall = await pool.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ja.updated_at - j.created_at))/86400)::numeric, 1) as overall_avg
      FROM job_applications ja JOIN jobs j ON j.id = ja.job_id
      WHERE ja.tenant_id=$1 AND ja.stage='joined'
    `, [tenantId]);

    res.json({ by_department: result.rows, overall_avg_days: overall.rows[0]?.overall_avg });
  } catch (err) {
    console.error('getTimeToFill error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getSourceEffectiveness = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  try {
    const conditions = ['tenant_id=$1'];
    const params: any[] = [tenantId];
    let i = 2;
    if (from) { conditions.push(`created_at >= $${i++}`); params.push(from); }
    if (to) { conditions.push(`created_at <= $${i++}`); params.push(to); }

    const result = await pool.query(`
      SELECT
        COALESCE(source, 'direct') as source,
        COUNT(*) as total_candidates,
        COUNT(*) FILTER (WHERE stage IN ('shortlisted','submitted_to_client','client_interview_scheduled','selected','offer_extended','offer_accepted','joined')) as shortlisted,
        COUNT(*) FILTER (WHERE stage = 'joined') as placements,
        ROUND(COUNT(*) FILTER (WHERE stage='joined')::numeric / NULLIF(COUNT(*),0) * 100, 1) as placement_rate_pct
      FROM job_applications
      WHERE ${conditions.join(' AND ')}
      GROUP BY source
      ORDER BY total_candidates DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getSourceEffectiveness error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRecruiterProductivity = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query;
  try {
    const conditions = ['ja.tenant_id=$1'];
    const params: any[] = [tenantId];
    let i = 2;
    if (from) { conditions.push(`ja.created_at >= $${i++}`); params.push(from); }
    if (to) { conditions.push(`ja.created_at <= $${i++}`); params.push(to); }

    const result = await pool.query(`
      SELECT
        u.id as recruiter_id,
        u.first_name || ' ' || u.last_name as recruiter_name,
        COUNT(*) as total_submissions,
        COUNT(*) FILTER (WHERE ja.stage IN ('shortlisted','submitted_to_client','selected','offer_extended','offer_accepted','joined')) as shortlisted,
        COUNT(*) FILTER (WHERE ja.stage='joined') as placements,
        COUNT(DISTINCT ja.job_id) as active_jobs,
        ROUND(COUNT(*) FILTER (WHERE ja.stage='joined')::numeric / NULLIF(COUNT(*),0) * 100, 1) as conversion_pct
      FROM job_applications ja
      JOIN users u ON u.id = ja.assigned_recruiter_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY placements DESC, total_submissions DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('getRecruiterProductivity error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};
