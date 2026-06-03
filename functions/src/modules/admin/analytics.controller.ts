import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";

const FUNNEL_ORDER: Record<string, number> = {
  new: 1, sourced: 2, screened: 3, shortlisted: 4,
  submitted_to_client: 5, client_interview_scheduled: 6,
  interview_completed: 7, selected: 8, offer_extended: 9,
  offer_accepted: 10, joined: 11,
};

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;

  try {
    const db = await getAtsPool(tenantId);

    const [funnelResult, sourcesResult, monthlyResult, recruiterResult, vendorResult, summaryResult] =
      await Promise.all([
        // Hiring funnel: exclude terminal rejection stages
        db.query(
          `SELECT stage, COUNT(*)::int AS count
           FROM job_applications
           WHERE ($1::uuid IS NULL OR tenant_id = $1)
             AND stage NOT IN ('disqualified','offer_rejected')
           GROUP BY stage
           ORDER BY CASE stage
             WHEN 'new' THEN 1 WHEN 'sourced' THEN 2 WHEN 'screened' THEN 3
             WHEN 'shortlisted' THEN 4 WHEN 'submitted_to_client' THEN 5
             WHEN 'client_interview_scheduled' THEN 6 WHEN 'interview_completed' THEN 7
             WHEN 'selected' THEN 8 WHEN 'offer_extended' THEN 9
             WHEN 'offer_accepted' THEN 10 WHEN 'joined' THEN 11
             ELSE 99 END`,
          [tenantId],
        ),

        // Source effectiveness: candidates grouped by source channel
        db.query(
          `SELECT source, COUNT(*)::int AS count
           FROM candidates
           WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL
           GROUP BY source ORDER BY count DESC`,
          [tenantId],
        ),

        // Monthly placements (offer_accepted + joined) for the last 6 months
        db.query(
          `SELECT
             TO_CHAR(DATE_TRUNC('month', updated_at), 'Mon') AS label,
             COUNT(*)::int AS count
           FROM job_applications
           WHERE ($1::uuid IS NULL OR tenant_id = $1)
             AND stage IN ('offer_accepted','joined')
             AND updated_at >= NOW() - INTERVAL '6 months'
           GROUP BY DATE_TRUNC('month', updated_at)
           ORDER BY DATE_TRUNC('month', updated_at) ASC`,
          [tenantId],
        ),

        // Recruiter productivity: jobs assigned, candidates sourced, placed
        db.query(
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
             AND ($1::uuid IS NULL OR tm.tenant_id = $1)
             AND tm.is_active = true
             AND tm.role IN ('recruiter','super_admin','accounts_manager')
           LEFT JOIN jobs j ON ($1::uuid IS NULL OR j.tenant_id = $1)
             AND u.id = ANY(j.assigned_recruiter_ids)
             AND j.deleted_at IS NULL
           LEFT JOIN candidates c ON c.created_by = u.id
             AND ($1::uuid IS NULL OR c.tenant_id = $1)
             AND c.deleted_at IS NULL
           LEFT JOIN job_applications ja ON ja.job_id = j.id
             AND ($1::uuid IS NULL OR ja.tenant_id = $1)
           GROUP BY u.id, p.full_name
           HAVING COUNT(DISTINCT j.id) > 0 OR COUNT(DISTINCT c.id) > 0
           ORDER BY placements DESC, submitted DESC
           LIMIT 20`,
          [tenantId],
        ),

        // Vendor performance: use stored stats from vendors table
        db.query(
          `SELECT
             company_name AS name,
             ROUND(COALESCE(fill_rate, 0))::int AS rate,
             COALESCE(submission_count, 0)::int AS submits
           FROM vendors
           WHERE ($1::uuid IS NULL OR tenant_id = $1)
             AND deleted_at IS NULL AND is_active = true
           ORDER BY fill_rate DESC NULLS LAST, submission_count DESC
           LIMIT 10`,
          [tenantId],
        ),

        // Summary totals
        db.query(
          `SELECT
             (SELECT COUNT(*)::int FROM candidates
              WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL) AS total_candidates,
             (SELECT COUNT(*)::int FROM jobs
              WHERE ($1::uuid IS NULL OR tenant_id = $1)
                AND status = 'active' AND deleted_at IS NULL) AS active_jobs,
             (SELECT COUNT(*)::int FROM job_applications
              WHERE ($1::uuid IS NULL OR tenant_id = $1)
                AND stage IN ('offer_accepted','joined')) AS total_placements,
             (SELECT COUNT(*)::int FROM job_applications
              WHERE ($1::uuid IS NULL OR tenant_id = $1)
                AND stage = 'offer_extended') AS pending_offers`,
          [tenantId],
        ),
      ]);

    const summary = summaryResult.rows[0];
    const totalInFunnel = funnelResult.rows[0]?.count ?? 0;

    const funnel = funnelResult.rows.map((r) => ({
      stage: r.stage,
      count: r.count,
      conv: totalInFunnel > 0 ? Math.round((r.count / totalInFunnel) * 100) : 0,
    }));

    const offerExtended = funnelResult.rows.find((r) => r.stage === "offer_extended")?.count ?? 0;
    const offerAccepted = funnelResult.rows.find((r) => r.stage === "offer_accepted")?.count ?? 0;
    const offerAcceptRate =
      offerExtended > 0 ? Math.round((offerAccepted / offerExtended) * 100) : null;

    res.json({
      funnel,
      sources: sourcesResult.rows,
      monthly: monthlyResult.rows,
      recruiters: recruiterResult.rows,
      vendors: vendorResult.rows,
      summary: {
        ...summary,
        offer_accept_rate: offerAcceptRate,
      },
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const exportAnalytics = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
  const today = new Date().toISOString().slice(0, 10);

  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRow = (...cells: any[]) => cells.map(esc).join(",");

  try {
    const db = await getAtsPool(tenantId);

    const [funnelResult, recruiterResult, summaryResult] = await Promise.all([
      db.query(
        `SELECT stage, COUNT(*)::int AS count
         FROM job_applications
         WHERE ($1::uuid IS NULL OR tenant_id = $1)
           AND stage NOT IN ('disqualified','offer_rejected')
         GROUP BY stage
         ORDER BY CASE stage
           WHEN 'new' THEN 1 WHEN 'sourced' THEN 2 WHEN 'screened' THEN 3
           WHEN 'shortlisted' THEN 4 WHEN 'submitted_to_client' THEN 5
           WHEN 'client_interview_scheduled' THEN 6 WHEN 'interview_completed' THEN 7
           WHEN 'selected' THEN 8 WHEN 'offer_extended' THEN 9
           WHEN 'offer_accepted' THEN 10 WHEN 'joined' THEN 11 ELSE 99 END`,
        [tenantId],
      ),
      db.query(
        `SELECT
           p.full_name AS recruiter_name,
           COUNT(DISTINCT j.id)::int AS assigned_jobs,
           COUNT(DISTINCT c.id)::int AS candidates_sourced,
           COUNT(DISTINCT CASE WHEN ja.stage IN ('offer_accepted','joined') THEN ja.id END)::int AS placements
         FROM users u
         JOIN profiles p ON u.id = p.id
         JOIN tenant_memberships tm ON u.id = tm.user_id
           AND ($1::uuid IS NULL OR tm.tenant_id = $1)
           AND tm.is_active = true
           AND tm.role IN ('recruiter','super_admin','accounts_manager')
         LEFT JOIN jobs j ON ($1::uuid IS NULL OR j.tenant_id = $1)
           AND u.id = ANY(j.assigned_recruiter_ids) AND j.deleted_at IS NULL
         LEFT JOIN candidates c ON c.created_by = u.id
           AND ($1::uuid IS NULL OR c.tenant_id = $1) AND c.deleted_at IS NULL
         LEFT JOIN job_applications ja ON ja.job_id = j.id
           AND ($1::uuid IS NULL OR ja.tenant_id = $1)
         GROUP BY u.id, p.full_name
         HAVING COUNT(DISTINCT j.id) > 0 OR COUNT(DISTINCT c.id) > 0
         ORDER BY placements DESC`,
        [tenantId],
      ),
      db.query(
        `SELECT
           (SELECT COUNT(*)::int FROM candidates WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL) AS total_candidates,
           (SELECT COUNT(*)::int FROM jobs WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL) AS total_jobs,
           (SELECT COUNT(*)::int FROM vendors WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL) AS total_vendors,
           (SELECT COUNT(*)::int FROM job_applications WHERE ($1::uuid IS NULL OR tenant_id = $1) AND stage IN ('offer_accepted','joined')) AS total_placements`,
        [tenantId],
      ),
    ]);

    const s = summaryResult.rows[0];
    const lines: string[] = [
      csvRow("ZorHire Analytics Report", today),
      "",
      csvRow("SUMMARY"),
      csvRow("Metric", "Value"),
      csvRow("Total Candidates", s.total_candidates),
      csvRow("Total Jobs", s.total_jobs),
      csvRow("Total Vendors", s.total_vendors),
      csvRow("Total Placements", s.total_placements),
      "",
      csvRow("HIRING FUNNEL"),
      csvRow("Stage", "Count"),
      ...funnelResult.rows.map((r) => csvRow(r.stage, r.count)),
      "",
      csvRow("RECRUITER PRODUCTIVITY"),
      csvRow("Recruiter", "Assigned Jobs", "Candidates Sourced", "Placements"),
      ...recruiterResult.rows.map((r) =>
        csvRow(r.recruiter_name, r.assigned_jobs, r.candidates_sourced, r.placements),
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-${today}.csv"`);
    res.send(lines.join("\r\n"));
  } catch (error) {
    console.error("Export analytics error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
