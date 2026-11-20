import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { FREE_BOARDS, FREE_BOARD_KEYS } from "./freeBoards";
import { ExtRequest, UUID_RE } from "./linkedinStore";

/**
 * Assisted posting to free job boards. ZorHire records which boards a job should go to;
 * the recruiter's Chrome extension opens each board's post-a-job page, fills the form from
 * the job, and the recruiter signs in / signs up and presses the board's Post button.
 */

const fail = (res: Response, where: string, err: unknown) => {
  console.error(`job-board assist ${where} error:`, err);
  res.status(500).json({ message: "Internal server error" });
};

export const listFreeBoards = (_req: AuthRequest, res: Response) => res.json(FREE_BOARDS);

async function jobInTenant(tenantId: string, jobId: string) {
  if (!UUID_RE.test(jobId)) return null;
  const r = await pool.query(`SELECT id, title, employment_type, experience_min FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [jobId, tenantId]);
  return r.rows[0] ?? null;
}

/** GET /job-boards/jobs/:jobId/free-posts */
export const getFreePosts = async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobInTenant(req.user!.tenant_id, String(req.params.jobId));
    if (!job) return res.status(404).json({ message: "Job not found" });
    const r = await pool.query(
      `SELECT id, board_key, status, posting_url, error, requested_at, opened_at, posted_at FROM job_board_assisted_posts
        WHERE tenant_id = $1 AND job_id = $2`,
      [req.user!.tenant_id, job.id],
    );
    const byKey = new Map(r.rows.map((x) => [x.board_key, x]));
    res.json(
      FREE_BOARDS.map((b) => ({
        ...b,
        suitable: b.accepts.includes(job.employment_type) && (b.maxExperience === undefined || (job.experience_min ?? 0) <= b.maxExperience),
        freshers_only: b.maxExperience !== undefined && (job.experience_min ?? 0) > b.maxExperience,
        post: byKey.get(b.key) ?? null,
      })),
    );
  } catch (err) { fail(res, "getFreePosts", err); }
};

/** POST /job-boards/jobs/:jobId/free-posts { boards: ["naukri","indeed",...] } — queue for the extension. */
export const requestFreePosts = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenant_id;
    const job = await jobInTenant(tenantId, String(req.params.jobId));
    if (!job) return res.status(404).json({ message: "Job not found" });
    const boards: string[] = Array.isArray(req.body?.boards) ? [...new Set<string>(req.body.boards)].filter((k) => FREE_BOARD_KEYS.has(k)) : [];
    if (!boards.length) return res.status(400).json({ message: "Pick at least one job board." });
    for (const key of boards) {
      await pool.query(
        `INSERT INTO job_board_assisted_posts (tenant_id, job_id, board_key, requested_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (tenant_id, job_id, board_key) DO UPDATE
           SET requested_by = EXCLUDED.requested_by, requested_at = now(), updated_at = now(), error = NULL,
               status = CASE WHEN job_board_assisted_posts.status = 'posted' THEN 'posted' ELSE 'requested' END`,
        [tenantId, job.id, key, req.user!.id],
      );
    }
    res.status(202).json({ queued: boards.length });
  } catch (err) { fail(res, "requestFreePosts", err); }
};

/** PATCH /job-boards/free-posts/:id { status: posted|skipped|requested, posting_url? } — manual update from ZorHire. */
export const updateFreePost = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body?.status ?? "");
    if (!UUID_RE.test(id) || !["posted", "skipped", "requested"].includes(status)) return res.status(400).json({ message: "Bad request" });
    const url = typeof req.body?.posting_url === "string" && /^https:\/\//.test(req.body.posting_url) ? req.body.posting_url.slice(0, 500) : null;
    const r = await pool.query(
      `UPDATE job_board_assisted_posts SET status = $3, posting_url = COALESCE($4, posting_url),
              posted_at = CASE WHEN $3 = 'posted' THEN COALESCE(posted_at, now()) ELSE posted_at END,
              requested_at = CASE WHEN $3 = 'requested' THEN now() ELSE requested_at END,
              requested_by = CASE WHEN $3 = 'requested' THEN $5 ELSE requested_by END, updated_at = now()
        WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, req.user!.tenant_id, status, url, req.user!.id],
    );
    if (!r.rows[0]) return res.status(404).json({ message: "Not found" });
    res.json(r.rows[0]);
  } catch (err) { fail(res, "updateFreePost", err); }
};

/* ─────────────────────────────── Extension side ─────────────────────────────── */

const lakhs = (n: unknown) => (n === null || n === undefined || n === "" ? null : (Number(n) / 100000).toFixed(1).replace(/\.0$/, ""));
const MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
const TYPE: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship" };

/** The job as the extension should type it into board forms. */
export function jobPayload(j: any, applyEmail: string | null) {
  const range = [lakhs(j.salary_min), lakhs(j.salary_max)].filter(Boolean);
  const salary = range.length ? `${range.join(" - ")} LPA` : null;
  const skills: string[] = [...(j.mandatory_skills ?? []), ...(j.preferred_skills ?? [])];
  const experience = `${j.experience_min ?? 0}-${j.experience_max ?? j.experience_min ?? 0} years`;
  const lines = [
    (j.description ?? "").trim(),
    "",
    j.mandatory_skills?.length ? `Must-have skills: ${j.mandatory_skills.join(", ")}` : "",
    j.preferred_skills?.length ? `Good to have: ${j.preferred_skills.join(", ")}` : "",
    `Experience: ${experience}`,
    `Location: ${j.location || "India"} (${MODE[j.work_mode] ?? j.work_mode})`,
    `Employment type: ${TYPE[j.employment_type] ?? j.employment_type}`,
    applyEmail ? `\nTo apply, email your resume to ${applyEmail} with the subject "${j.title}".` : "",
  ].filter((l) => l !== "");
  return {
    title: j.title,
    company: j.company_name,
    location: j.location || "",
    work_mode: MODE[j.work_mode] ?? j.work_mode,
    employment_type: TYPE[j.employment_type] ?? j.employment_type,
    employment_type_key: j.employment_type,
    experience_min: j.experience_min ?? 0,
    experience_max: j.experience_max ?? j.experience_min ?? 0,
    experience,
    salary,
    salary_min_lpa: j.salary_min ? Number(j.salary_min) / 100000 : null,
    salary_max_lpa: j.salary_max ? Number(j.salary_max) / 100000 : null,
    openings: j.headcount ?? 1,
    skills,
    description: lines.join("\n"),
    apply_email: applyEmail,
  };
}

/** GET /extension/job-posts — boards this user asked to post to in the last 3 days. */
export const extPendingPosts = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const r = await pool.query(
      `SELECT j.*, p.id AS post_id, p.board_key, p.status AS post_status, t.name AS company_name, u.email AS requester_email
         FROM job_board_assisted_posts p
         JOIN jobs j ON j.id = p.job_id
         JOIN tenants t ON t.id = p.tenant_id
         JOIN users u ON u.id = p.requested_by
        WHERE p.tenant_id = $1 AND p.requested_by = $2 AND p.status IN ('requested','opened')
          AND p.requested_at > now() - interval '3 days'
        ORDER BY p.requested_at`,
      [tenantId, userId],
    );
    res.json(
      r.rows.map((row) => {
        const board = FREE_BOARDS.find((b) => b.key === row.board_key);
        // j.* also has an id (the job's); always use post_id for the post.
        return { id: row.post_id, board_key: row.board_key, board_name: board?.name, post_url: board?.postUrl, signup_url: board?.signupUrl, login_url: board?.loginUrl, status: row.post_status, job: jobPayload(row, row.requester_email) };
      }),
    );
  } catch (err) { fail(res, "extPendingPosts", err); }
};

/** POST /extension/job-posts/:id { status: opened|posted|skipped|failed, posting_url?, error? } */
export const extUpdatePost = async (req: ExtRequest, res: Response) => {
  try {
    const { tenantId, userId } = req.ext!;
    const id = String(req.params.id);
    const status = String(req.body?.status ?? "");
    if (!UUID_RE.test(id) || !["opened", "posted", "skipped", "failed"].includes(status)) return res.status(400).json({ message: "Bad request" });
    const url = typeof req.body?.posting_url === "string" && /^https:\/\//.test(req.body.posting_url) ? req.body.posting_url.slice(0, 500) : null;
    const r = await pool.query(
      `UPDATE job_board_assisted_posts SET status = $4, posting_url = COALESCE($5, posting_url), error = $6,
              opened_at = CASE WHEN $4 = 'opened' THEN now() ELSE opened_at END,
              posted_at = CASE WHEN $4 = 'posted' THEN now() ELSE posted_at END, updated_at = now()
        WHERE id = $1 AND tenant_id = $2 AND requested_by = $3 RETURNING id`,
      [id, tenantId, userId, status, url, typeof req.body?.error === "string" ? req.body.error.slice(0, 300) : null],
    );
    if (!r.rows[0]) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  } catch (err) { fail(res, "extUpdatePost", err); }
};
