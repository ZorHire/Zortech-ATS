import { Response } from 'express';
import pool from '../../db';
import { AuthRequest } from '../../middleware/auth';

const STAGE_LABELS: Record<string, string> = {
  new: 'New', sourced: 'Sourced', screened: 'Screened', shortlisted: 'Shortlisted',
  submitted_to_client: 'Submitted', client_interview_scheduled: 'Interview Sched.',
  interview_completed: 'Interviewed', selected: 'Selected',
  offer_extended: 'Offer Extended', offer_accepted: 'Offer Accepted', joined: 'Joined',
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const { from, to } = req.query as { from?: string; to?: string };
  const hasRange = !!(from && to);

  // When a date range is specified, all date-sensitive queries are scoped to it.
  // Without a range the queries behave identically to the original all-time defaults.
  const appParams = hasRange ? [tenantId, from, to] : [tenantId];
  const appDateCond = hasRange ? 'AND updated_at BETWEEN $2 AND $3' : '';
  const jaDateCond = hasRange ? 'AND ja.updated_at BETWEEN $2 AND $3' : '';
  const cDateCond = hasRange ? 'AND c.created_at BETWEEN $2 AND $3' : '';
  const monthlyDateCond = hasRange
    ? 'AND updated_at BETWEEN $2 AND $3'
    : "AND updated_at >= NOW() - INTERVAL '6 months'";

  try {
    const [funnelResult, sourcesResult, monthlyResult, recruiterResult, vendorResult, summaryResult, timeToFillResult, sourceConversionResult] =
      await Promise.all([
        pool.query(
          `SELECT stage, COUNT(*)::int AS count
           FROM job_applications
           WHERE tenant_id = $1
             AND stage NOT IN ('disqualified','offer_rejected')
             ${appDateCond}
           GROUP BY stage
           ORDER BY CASE stage
             WHEN 'new' THEN 1 WHEN 'sourced' THEN 2 WHEN 'screened' THEN 3
             WHEN 'shortlisted' THEN 4 WHEN 'submitted_to_client' THEN 5
             WHEN 'client_interview_scheduled' THEN 6 WHEN 'interview_completed' THEN 7
             WHEN 'selected' THEN 8 WHEN 'offer_extended' THEN 9
             WHEN 'offer_accepted' THEN 10 WHEN 'joined' THEN 11
             ELSE 99 END`,
          appParams,
        ),
        pool.query(
          `SELECT source, COUNT(*)::int AS count
           FROM candidates
           WHERE tenant_id = $1 AND deleted_at IS NULL
             ${hasRange ? 'AND created_at BETWEEN $2 AND $3' : ''}
           GROUP BY source ORDER BY count DESC`,
          appParams,
        ),
        pool.query(
          `SELECT
             TO_CHAR(DATE_TRUNC('month', updated_at), 'Mon') AS label,
             COUNT(*)::int AS count
           FROM job_applications
           WHERE tenant_id = $1
             AND stage IN ('offer_accepted','joined')
             ${monthlyDateCond}
           GROUP BY DATE_TRUNC('month', updated_at)
           ORDER BY DATE_TRUNC('month', updated_at) ASC`,
          appParams,
        ),
        pool.query(
          `SELECT
             p.full_name AS recruiter_name,
             COUNT(DISTINCT j.id)::int AS assigned_jobs,
             COUNT(DISTINCT c.id)::int AS candidates_sourced,
             COUNT(DISTINCT CASE WHEN ja.stage IN (
               'shortlisted','submitted_to_client','client_interview_scheduled',
               'interview_completed','selected','offer_extended','offer_accepted','joined'
             ) THEN ja.id END)::int AS shortlisted,
             COUNT(DISTINCT CASE WHEN ja.stage IN (
               'submitted_to_client','client_interview_scheduled','interview_completed',
               'selected','offer_extended','offer_accepted','joined'
             ) THEN ja.id END)::int AS submitted,
             COUNT(DISTINCT CASE WHEN ja.stage IN ('offer_accepted','joined') THEN ja.id END)::int AS placements
           FROM users u
           JOIN profiles p ON u.id = p.id
           JOIN tenant_memberships tm ON u.id = tm.user_id
             AND tm.tenant_id = $1
             AND tm.is_active = true
             AND tm.role IN ('recruiter','super_admin','accounts_manager')
           LEFT JOIN jobs j ON j.tenant_id = $1
             AND u.id = ANY(j.assigned_recruiter_ids)
             AND j.deleted_at IS NULL
           LEFT JOIN candidates c ON c.created_by = u.id
             AND c.tenant_id = $1 AND c.deleted_at IS NULL
             ${cDateCond}
           LEFT JOIN job_applications ja ON ja.job_id = j.id
             AND ja.tenant_id = $1
             ${jaDateCond}
           GROUP BY u.id, p.full_name
           HAVING COUNT(DISTINCT j.id) > 0 OR COUNT(DISTINCT c.id) > 0
           ORDER BY placements DESC, submitted DESC
           LIMIT 20`,
          appParams,
        ),
        pool.query(
          `SELECT
             company_name AS name,
             ROUND(COALESCE(fill_rate, 0))::int AS rate,
             COALESCE(submission_count, 0)::int AS submits
           FROM vendors
           WHERE tenant_id = $1
             AND deleted_at IS NULL AND is_active = true
           ORDER BY fill_rate DESC NULLS LAST, submission_count DESC
           LIMIT 10`,
          [tenantId],
        ),
        pool.query(
          `SELECT
             (SELECT COUNT(*)::int FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL ${hasRange ? 'AND created_at BETWEEN $2 AND $3' : ''}) AS total_candidates,
             (SELECT COUNT(*)::int FROM jobs WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL) AS active_jobs,
             (SELECT COUNT(*)::int FROM job_applications WHERE tenant_id = $1 AND stage IN ('offer_accepted','joined') ${appDateCond}) AS total_placements,
             (SELECT COUNT(*)::int FROM job_applications WHERE tenant_id = $1 AND stage = 'offer_extended') AS pending_offers`,
          appParams,
        ),
        // Time-to-Fill: average days from job creation to placement
        pool.query(
          `SELECT
             ROUND(AVG(EXTRACT(EPOCH FROM (pe.created_at - j.created_at)) / 86400)::numeric, 1) AS avg_days_to_fill,
             COUNT(*)::int AS total_filled
           FROM pipeline_events pe
           JOIN job_applications ja ON pe.application_id = ja.id
           JOIN jobs j ON ja.job_id = j.id
           WHERE pe.tenant_id = $1
             AND pe.to_stage IN ('offer_accepted','joined')
             ${hasRange ? 'AND pe.created_at BETWEEN $2 AND $3' : ''}`,
          appParams,
        ),
        // Source conversion: volume + placement rate per source
        pool.query(
          `SELECT
             c.source,
             COUNT(DISTINCT c.id)::int AS total,
             COUNT(DISTINCT CASE WHEN ja.stage IN ('offer_accepted','joined') THEN c.id END)::int AS placements,
             ROUND(
               COUNT(DISTINCT CASE WHEN ja.stage IN ('offer_accepted','joined') THEN c.id END)::numeric /
               NULLIF(COUNT(DISTINCT c.id), 0) * 100, 1
             )::float AS conversion_rate
           FROM candidates c
           LEFT JOIN job_applications ja ON ja.candidate_id = c.id AND ja.tenant_id = $1
           WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
           ${hasRange ? 'AND c.created_at BETWEEN $2 AND $3' : ''}
           GROUP BY c.source
           ORDER BY total DESC`,
          appParams,
        ),
      ]);

    const summary = summaryResult.rows[0];
    const totalInFunnel = funnelResult.rows[0]?.count ?? 0;

    const funnel = funnelResult.rows.map((r) => ({
      stage: r.stage,
      count: r.count,
      conv: totalInFunnel > 0 ? Math.round((r.count / totalInFunnel) * 100) : 0,
    }));

    const offerExtended = funnelResult.rows.find((r) => r.stage === 'offer_extended')?.count ?? 0;
    const offerAccepted = funnelResult.rows.find((r) => r.stage === 'offer_accepted')?.count ?? 0;
    const offerAcceptRate = offerExtended > 0 ? Math.round((offerAccepted / offerExtended) * 100) : null;

    res.json({
      funnel,
      sources: sourcesResult.rows,
      monthly: monthlyResult.rows,
      recruiters: recruiterResult.rows,
      vendors: vendorResult.rows,
      summary: { ...summary, offer_accept_rate: offerAcceptRate },
      time_to_fill: {
        avg_days: timeToFillResult.rows[0]?.avg_days_to_fill ?? null,
        total_filled: timeToFillResult.rows[0]?.total_filled ?? 0,
      },
      source_conversion: sourceConversionResult.rows,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const exportAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.tenant_id;
  const today = new Date().toISOString().slice(0, 10);
  const { from, to } = req.query as { from?: string; to?: string };
  const hasRange = !!(from && to);
  const exportParams = hasRange ? [tenantId, from, to] : [tenantId];
  const appDateCond = hasRange ? 'AND updated_at BETWEEN $2 AND $3' : '';
  const jaDateCond = hasRange ? 'AND ja.updated_at BETWEEN $2 AND $3' : '';

  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvRow = (...cells: any[]) => cells.map(esc).join(',');

  try {
    const [funnelResult, recruiterResult, summaryResult] = await Promise.all([
      pool.query(
        `SELECT stage, COUNT(*)::int AS count
         FROM job_applications
         WHERE tenant_id = $1
           AND stage NOT IN ('disqualified','offer_rejected')
           ${appDateCond}
         GROUP BY stage
         ORDER BY CASE stage
           WHEN 'new' THEN 1 WHEN 'sourced' THEN 2 WHEN 'screened' THEN 3
           WHEN 'shortlisted' THEN 4 WHEN 'submitted_to_client' THEN 5
           WHEN 'client_interview_scheduled' THEN 6 WHEN 'interview_completed' THEN 7
           WHEN 'selected' THEN 8 WHEN 'offer_extended' THEN 9
           WHEN 'offer_accepted' THEN 10 WHEN 'joined' THEN 11 ELSE 99 END`,
        exportParams,
      ),
      pool.query(
        `SELECT
           p.full_name AS recruiter_name,
           COUNT(DISTINCT j.id)::int AS assigned_jobs,
           COUNT(DISTINCT c.id)::int AS candidates_sourced,
           COUNT(DISTINCT CASE WHEN ja.stage IN ('offer_accepted','joined') THEN ja.id END)::int AS placements
         FROM users u
         JOIN profiles p ON u.id = p.id
         JOIN tenant_memberships tm ON u.id = tm.user_id
           AND tm.tenant_id = $1 AND tm.is_active = true
           AND tm.role IN ('recruiter','super_admin','accounts_manager')
         LEFT JOIN jobs j ON j.tenant_id = $1
           AND u.id = ANY(j.assigned_recruiter_ids) AND j.deleted_at IS NULL
         LEFT JOIN candidates c ON c.created_by = u.id
           AND c.tenant_id = $1 AND c.deleted_at IS NULL
         LEFT JOIN job_applications ja ON ja.job_id = j.id AND ja.tenant_id = $1
           ${jaDateCond}
         GROUP BY u.id, p.full_name
         HAVING COUNT(DISTINCT j.id) > 0 OR COUNT(DISTINCT c.id) > 0
         ORDER BY placements DESC`,
        exportParams,
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM candidates WHERE tenant_id = $1 AND deleted_at IS NULL) AS total_candidates,
           (SELECT COUNT(*)::int FROM jobs WHERE tenant_id = $1 AND deleted_at IS NULL) AS total_jobs,
           (SELECT COUNT(*)::int FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL) AS total_vendors,
           (SELECT COUNT(*)::int FROM job_applications WHERE tenant_id = $1 AND stage IN ('offer_accepted','joined') ${appDateCond}) AS total_placements`,
        exportParams,
      ),
    ]);

    const s = summaryResult.rows[0];
    const rangeLabel = hasRange ? `${from} to ${to}` : 'All Time';
    const lines: string[] = [
      csvRow('ZorHire Analytics Report', today, rangeLabel),
      '',
      csvRow('SUMMARY'),
      csvRow('Metric', 'Value'),
      csvRow('Total Candidates', s.total_candidates),
      csvRow('Total Jobs', s.total_jobs),
      csvRow('Total Vendors', s.total_vendors),
      csvRow('Total Placements', s.total_placements),
      '',
      csvRow('HIRING FUNNEL'),
      csvRow('Stage', 'Count'),
      ...funnelResult.rows.map((r) => csvRow(STAGE_LABELS[r.stage] ?? r.stage, r.count)),
      '',
      csvRow('RECRUITER PRODUCTIVITY'),
      csvRow('Recruiter', 'Assigned Jobs', 'Candidates Sourced', 'Placements'),
      ...recruiterResult.rows.map((r) =>
        csvRow(r.recruiter_name, r.assigned_jobs, r.candidates_sourced, r.placements),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${today}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
