import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;

    const [statsResult, pipelineResult] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*)::int FROM jobs
           WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL) AS active_jobs,
          (SELECT COUNT(*)::int FROM candidates
           WHERE tenant_id = $1 AND deleted_at IS NULL) AS total_candidates,
          (SELECT COUNT(*)::int FROM interviews i
           JOIN job_applications ja ON i.application_id = ja.id
           WHERE ja.tenant_id = $1 AND i.status = 'scheduled' AND i.scheduled_at > NOW()) AS upcoming_interviews,
          (SELECT COUNT(*)::int FROM jobs
           WHERE tenant_id = $1 AND status = 'active' AND deleted_at IS NULL
             AND sla_deadline IS NOT NULL AND sla_deadline < NOW()) AS sla_alerts`,
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

    res.json({
      ...statsResult.rows[0],
      pipeline_stages: pipelineResult.rows,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
