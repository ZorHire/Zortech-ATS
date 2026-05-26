import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { withCache } from '../../lib/cache';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;

  try {
    const data = await withCache(`tenant:${tenantId}:dashboard:stats`, 60, async () => {
      const [
        activeJobsRes,
        totalCandidatesRes,
        upcomingInterviewsRes,
        slaAlertsRes,
        emailsSentRes,
        pipelineStagesRes,
      ] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS count FROM jobs
           WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL`,
          [tenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM candidates
           WHERE tenant_id = $1 AND deleted_at IS NULL`,
          [tenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM job_applications
           WHERE tenant_id = $1 AND stage = 'client_interview_scheduled'`,
          [tenantId],
        ),
        // Active jobs open for more than 30 days are treated as SLA breaches
        pool.query(
          `SELECT COUNT(*)::int AS count FROM jobs
           WHERE tenant_id = $1 AND status = 'active'
             AND deleted_at IS NULL
             AND created_at < NOW() - INTERVAL '30 days'`,
          [tenantId],
        ),
        pool.query(
          `SELECT COALESCE(SUM(delivered_count), 0)::int AS count
           FROM email_campaigns WHERE tenant_id = $1`,
          [tenantId],
        ),
        pool.query(
          `SELECT stage, COUNT(*)::int AS count
           FROM job_applications
           WHERE tenant_id = $1
           GROUP BY stage
           ORDER BY count DESC`,
          [tenantId],
        ),
      ]);

      return {
        active_jobs:          activeJobsRes.rows[0].count,
        total_candidates:     totalCandidatesRes.rows[0].count,
        upcoming_interviews:  upcomingInterviewsRes.rows[0].count,
        sla_alerts:           slaAlertsRes.rows[0].count,
        emails_sent:          emailsSentRes.rows[0].count,
        pipeline_stages:      pipelineStagesRes.rows.map((r) => ({
          stage: r.stage,
          count: r.count,
        })),
      };
    });

    res.json(data);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
