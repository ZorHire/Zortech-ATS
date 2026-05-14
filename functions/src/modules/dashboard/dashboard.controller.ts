import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { getAtsPool } from "../../db/poolRouter";

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const filterTenantId = req.user?.is_platform_owner ? null : req.user?.tenant_id;
    const isVendor = req.user?.role === "vendor_user" || req.user?.role === "vendor_manager";
    const isRecruiter = req.user?.role === "recruiter";

    // Vendor with no assigned vendor_id has no scope — return empty
    if (isVendor && !req.user?.vendor_id) {
      return res.json({ active_jobs: 0, total_candidates: 0, upcoming_interviews: 0, sla_alerts: 0, pipeline_stages: [] });
    }

    const db = await getAtsPool(filterTenantId);
    const params: any[] = [filterTenantId];

    let jobFilter = "";
    let appJobJoin = "";
    let appJobFilter = "";
    let candidateJobFilter = "";

    if (isVendor) {
      params.push(req.user!.vendor_id);
      const p = params.length;
      jobFilter = `AND $${p} = ANY(assigned_vendor_ids)`;
      appJobJoin = `JOIN jobs j ON j.id = ja.job_id`;
      appJobFilter = `AND $${p} = ANY(j.assigned_vendor_ids)`;
      candidateJobFilter = `AND $${p} = ANY(j2.assigned_vendor_ids)`;
    } else if (isRecruiter) {
      params.push(req.user!.id);
      const p = params.length;
      jobFilter = `AND $${p} = ANY(assigned_recruiter_ids)`;
      appJobJoin = `JOIN jobs j ON j.id = ja.job_id`;
      appJobFilter = `AND $${p} = ANY(j.assigned_recruiter_ids)`;
      candidateJobFilter = `AND $${p} = ANY(j2.assigned_recruiter_ids)`;
    }

    const needsScope = isVendor || isRecruiter;

    const [statsResult, pipelineResult] = await Promise.all([
      db.query(
        `SELECT
          (SELECT COUNT(*)::int FROM jobs
           WHERE ($1::uuid IS NULL OR tenant_id = $1) AND status = 'active' AND deleted_at IS NULL ${jobFilter}) AS active_jobs,
          (SELECT COUNT(*)::int FROM candidates
           WHERE ($1::uuid IS NULL OR tenant_id = $1) AND deleted_at IS NULL
           ${needsScope ? `AND EXISTS (SELECT 1 FROM job_applications ja2 JOIN jobs j2 ON j2.id = ja2.job_id WHERE ja2.candidate_id = candidates.id AND j2.deleted_at IS NULL ${candidateJobFilter})` : ""}) AS total_candidates,
          (SELECT COUNT(*)::int FROM interviews i
           JOIN job_applications ja ON i.application_id = ja.id
           ${needsScope ? appJobJoin : ""}
           WHERE ($1::uuid IS NULL OR ja.tenant_id = $1) AND i.status = 'scheduled' AND i.scheduled_at > NOW() ${appJobFilter}) AS upcoming_interviews,
          (SELECT COUNT(*)::int FROM jobs
           WHERE ($1::uuid IS NULL OR tenant_id = $1) AND status = 'active' AND deleted_at IS NULL
             AND sla_deadline IS NOT NULL AND sla_deadline < NOW() ${jobFilter}) AS sla_alerts`,
        params,
      ),
      db.query(
        `SELECT stage, COUNT(*)::int AS count
         FROM job_applications ja
         ${needsScope ? appJobJoin : ""}
         WHERE ($1::uuid IS NULL OR ja.tenant_id = $1)
         ${appJobFilter}
         GROUP BY stage
         ORDER BY count DESC`,
        params,
      ),
    ]);

    res.json({
      ...statsResult.rows[0],
      pipeline_stages: pipelineResult.rows,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
