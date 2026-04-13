import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { Parser } from 'json2csv';

export const exportAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;

  try {
    // Fetch some summary data for the export
    // This is a sample query combining some stats
    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL) as total_candidates,
        (SELECT COUNT(*) FROM jobs WHERE tenant_id = $1 AND deleted_at IS NULL) as total_jobs,
        (SELECT COUNT(*) FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL) as total_vendors,
        (SELECT COUNT(*) FROM applications WHERE tenant_id = $1) as total_applications
    `, [tenantId]);

    const stats = statsResult.rows[0];

    // Fetch recruiter performance data
    const recruitersResult = await pool.query(`
      SELECT 
        p.full_name as recruiter_name,
        COUNT(DISTINCT j.id) as assigned_jobs,
        COUNT(DISTINCT c.id) as candidates_sourced
      FROM users u
      JOIN profiles p ON u.id = p.id
      LEFT JOIN jobs j ON j.created_by = u.id AND j.tenant_id = $1
      LEFT JOIN candidates c ON c.created_by = u.id AND c.tenant_id = $1
      WHERE u.id IN (SELECT user_id FROM tenant_memberships WHERE tenant_id = $1)
      GROUP BY p.full_name
    `, [tenantId]);

    const data = recruitersResult.rows.map(r => ({
      ...r,
      total_candidates: stats.total_candidates,
      total_jobs: stats.total_jobs,
      total_vendors: stats.total_vendors,
      total_applications: stats.total_applications,
      export_date: new Date().toISOString()
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment(`analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
