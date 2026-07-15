import { Request, Response } from "express";
import pool from "../../db";
import * as linkedinSvc from "./services/linkedin.service";
import * as naukriSvc from "./services/naukri.service";

// ─── LinkedIn ────────────────────────────────────────────────────────────────

export async function linkedinAuthRedirect(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const url = linkedinSvc.getLinkedInAuthUrl(tenantId);
  res.redirect(url);
}

export async function linkedinAuthCallback(req: Request, res: Response) {
  try {
    const { code, state: tenantId } = req.query as Record<string, string>;
    const tokens = await linkedinSvc.exchangeLinkedInCode(code) as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    await pool.query(
      `INSERT INTO oauth_tokens (tenant_id, provider, access_token, expires_at)
       VALUES ($1, 'linkedin', $2, $3)
       ON CONFLICT (tenant_id, provider) DO UPDATE SET access_token=$2, expires_at=$3`,
      [tenantId, tokens.access_token, expiresAt],
    );
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/settings?jobboard=linkedin&status=connected`);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function postJobToLinkedIn(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { jobId } = req.params;
  const { organizationId } = req.body;

  try {
    const tokenRes = await pool.query(
      `SELECT access_token FROM oauth_tokens WHERE tenant_id=$1 AND provider='linkedin'`,
      [tenantId],
    );
    if (!tokenRes.rows[0]) return res.status(400).json({ message: "LinkedIn not connected" });

    const jobRes = await pool.query(
      `SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2`,
      [jobId, tenantId],
    );
    if (!jobRes.rows[0]) return res.status(404).json({ message: "Job not found" });

    const job = jobRes.rows[0];
    const applyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/apply/${jobId}`;

    const externalId = await linkedinSvc.postJobToLinkedIn({
      accessToken: tokenRes.rows[0].access_token,
      organizationId: organizationId || process.env.LINKEDIN_ORGANIZATION_ID || "",
      title: job.title,
      description: job.description,
      location: job.location || "",
      employmentType: job.work_mode === "remote" ? "FULL_TIME" : "FULL_TIME",
      workplaceType: job.work_mode === "remote" ? "REMOTE" : job.work_mode === "hybrid" ? "HYBRID" : "ON_SITE",
      externalApplyUrl: applyUrl,
    });

    await pool.query(
      `INSERT INTO job_board_postings (tenant_id, job_id, board_name, external_job_id, posted_at, status)
       VALUES ($1,$2,'linkedin',$3,NOW(),'active')
       ON CONFLICT (tenant_id, job_id, board_name) DO UPDATE SET external_job_id=$3, posted_at=NOW(), status='active'`,
      [tenantId, jobId, externalId],
    );

    res.json({ message: "Posted to LinkedIn", externalId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function removeLinkedInJob(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { jobId } = req.params;

  try {
    const [tokenRes, postRes] = await Promise.all([
      pool.query(`SELECT access_token FROM oauth_tokens WHERE tenant_id=$1 AND provider='linkedin'`, [tenantId]),
      pool.query(`SELECT external_job_id FROM job_board_postings WHERE tenant_id=$1 AND job_id=$2 AND board_name='linkedin'`, [tenantId, jobId]),
    ]);

    if (!tokenRes.rows[0] || !postRes.rows[0]) return res.status(404).json({ message: "LinkedIn posting not found" });

    await linkedinSvc.closeLinkedInJobPosting(tokenRes.rows[0].access_token, postRes.rows[0].external_job_id);
    await pool.query(
      `UPDATE job_board_postings SET status='closed', closed_at=NOW() WHERE tenant_id=$1 AND job_id=$2 AND board_name='linkedin'`,
      [tenantId, jobId],
    );

    res.json({ message: "Job removed from LinkedIn" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

// ─── Naukri ──────────────────────────────────────────────────────────────────

export async function postJobToNaukri(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { jobId } = req.params;

  try {
    const jobRes = await pool.query(
      `SELECT * FROM jobs WHERE id=$1 AND tenant_id=$2`,
      [jobId, tenantId],
    );
    if (!jobRes.rows[0]) return res.status(404).json({ message: "Job not found" });

    const job = jobRes.rows[0];
    const applyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/apply/${jobId}`;
    const skills = Array.isArray(job.required_skills) ? job.required_skills : [];

    const externalId = await naukriSvc.postJobToNaukri({
      title: job.title,
      description: job.description,
      location: job.location || "",
      minExperience: job.min_experience || 0,
      maxExperience: job.max_experience || 10,
      minSalary: job.min_salary,
      maxSalary: job.max_salary,
      skills,
      applyUrl,
    });

    await pool.query(
      `INSERT INTO job_board_postings (tenant_id, job_id, board_name, external_job_id, posted_at, status)
       VALUES ($1,$2,'naukri',$3,NOW(),'active')
       ON CONFLICT (tenant_id, job_id, board_name) DO UPDATE SET external_job_id=$3, posted_at=NOW(), status='active'`,
      [tenantId, jobId, externalId],
    );

    res.json({ message: "Posted to Naukri", externalId });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function getJobBoardPostings(req: Request, res: Response) {
  const tenantId = (req as any).user?.tenantId;
  const { jobId } = req.params;

  const result = await pool.query(
    `SELECT board_name, external_job_id, posted_at, closed_at, status
     FROM job_board_postings WHERE tenant_id=$1 AND job_id=$2 ORDER BY posted_at DESC`,
    [tenantId, jobId],
  );
  res.json(result.rows);
}
