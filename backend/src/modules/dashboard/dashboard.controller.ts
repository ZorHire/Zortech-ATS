import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';
import { withCache } from '../../lib/cache';

export const getRecentActivity = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const [applications, stageChanges, interviews] = await Promise.all([
      pool.query(
        `SELECT
           'application' AS type,
           c.first_name || ' ' || c.last_name AS candidate_name,
           j.title AS job_title,
           j.location AS job_location,
           c.current_location,
           ja.stage,
           ja.created_at
         FROM job_applications ja
         JOIN candidates c ON c.id = ja.candidate_id
         JOIN jobs j ON j.id = ja.job_id
         WHERE ja.tenant_id = $1
         ORDER BY ja.created_at DESC LIMIT 5`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           'stage_change' AS type,
           c.first_name || ' ' || c.last_name AS candidate_name,
           j.title AS job_title,
           pe.from_stage,
           pe.to_stage,
           pe.created_at
         FROM pipeline_events pe
         JOIN job_applications ja ON ja.id = pe.application_id
         JOIN candidates c ON c.id = ja.candidate_id
         JOIN jobs j ON j.id = ja.job_id
         WHERE pe.tenant_id = $1
         ORDER BY pe.created_at DESC LIMIT 5`,
        [tenantId],
      ),
      pool.query(
        `SELECT
           'interview' AS type,
           c.first_name || ' ' || c.last_name AS candidate_name,
           j.title AS job_title,
           i.interview_type,
           i.scheduled_at,
           i.created_at
         FROM interviews i
         JOIN job_applications ja ON ja.id = i.application_id
         JOIN candidates c ON c.id = ja.candidate_id
         JOIN jobs j ON j.id = ja.job_id
         WHERE i.tenant_id = $1
         ORDER BY i.created_at DESC LIMIT 5`,
        [tenantId],
      ),
    ]);

    const all = [
      ...applications.rows,
      ...stageChanges.rows,
      ...interviews.rows,
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    res.json(all);
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getDashboardTasks = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  try {
    const [slaJobs, pendingScreening, upcomingInterviews, newApplications] = await Promise.all([
      pool.query(
        `SELECT j.title, j.created_at,
           EXTRACT(DAY FROM NOW() - j.created_at)::int AS open_days
         FROM jobs j
         WHERE j.tenant_id = $1 AND j.status = 'active' AND j.deleted_at IS NULL
           AND j.created_at < NOW() - INTERVAL '30 days'
         ORDER BY j.created_at ASC LIMIT 3`,
        [tenantId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM job_applications
         WHERE tenant_id = $1 AND stage = 'screened'
           AND updated_at < NOW() - INTERVAL '7 days'`,
        [tenantId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM interviews
         WHERE tenant_id = $1 AND status = 'scheduled'
           AND scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '2 days'`,
        [tenantId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM job_applications
         WHERE tenant_id = $1 AND stage = 'new'
           AND created_at > NOW() - INTERVAL '7 days'`,
        [tenantId],
      ),
    ]);

    const tasks: { text: string; due: string; priority: 'overdue' | 'urgent' | 'normal' }[] = [];

    slaJobs.rows.forEach((j) => {
      tasks.push({
        text: `SLA breach: "${j.title}" open for ${j.open_days} days`,
        due: 'Overdue',
        priority: 'overdue',
      });
    });

    const screening = pendingScreening.rows[0].count;
    if (screening > 0) {
      tasks.push({
        text: `Follow up with ${screening} candidate${screening > 1 ? 's' : ''} stuck in screening`,
        due: 'Overdue',
        priority: 'overdue',
      });
    }

    const upcoming = upcomingInterviews.rows[0].count;
    if (upcoming > 0) {
      tasks.push({
        text: `Schedule or confirm ${upcoming} upcoming interview${upcoming > 1 ? 's' : ''}`,
        due: 'Due today',
        priority: 'urgent',
      });
    }

    const newApps = newApplications.rows[0].count;
    if (newApps > 0) {
      tasks.push({
        text: `Review ${newApps} new application${newApps > 1 ? 's' : ''} this week`,
        due: 'Due this week',
        priority: 'normal',
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error('Dashboard tasks error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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
