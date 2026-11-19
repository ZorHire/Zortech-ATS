import { Response } from "express";
import pool from "../../db";
import { AuthRequest } from "../../middleware/auth";
import { enqueueTask, getSettings, recordEvent, upsertSettings } from "./agentStore";
import type { AgentName } from "./agentStore";

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function jobInTenant(jobId: string, tenantId: string) {
  if (!UUID_RE.test(jobId)) return null;
  const r = await pool.query(`SELECT id, title FROM jobs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [jobId, tenantId]);
  return r.rows[0] ?? null;
}

/** GET /v1/agents/jobs/:jobId/autopilot */
export const getAutopilot = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const job = await jobInTenant(String(req.params.jobId), tenantId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(await getSettings(tenantId, job.id));
  } catch (err) {
    console.error("getAutopilot error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** PUT /v1/agents/jobs/:jobId/autopilot */
export const putAutopilot = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const job = await jobInTenant(String(req.params.jobId), tenantId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    const before = await getSettings(tenantId, job.id);
    const after = await upsertSettings(tenantId, job.id, req.user?.id, req.body ?? {});
    if (before.enabled !== after.enabled) {
      await recordEvent({
        tenantId,
        jobId: job.id,
        agent: "system",
        action: after.enabled ? "autopilot_on" : "paused",
        summary: `Autopilot ${after.enabled ? "turned on" : "turned off"} for ${job.title}.`,
      });
    }
    res.json(after);
  } catch (err) {
    console.error("putAutopilot error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /v1/agents/activity?jobId=&applicationId=&limit= */
export const getActivity = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const jobId = typeof req.query.jobId === "string" && UUID_RE.test(req.query.jobId) ? req.query.jobId : null;
  const applicationId = typeof req.query.applicationId === "string" && UUID_RE.test(req.query.applicationId) ? req.query.applicationId : null;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  try {
    const r = await pool.query(
      `SELECT e.id, e.job_id, j.title AS job_title, e.application_id, ja.candidate_id,
              NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), '') AS candidate_name,
              e.agent, e.action, e.summary, e.created_at
         FROM agent_events e
         LEFT JOIN jobs j ON j.id = e.job_id
         LEFT JOIN job_applications ja ON ja.id = e.application_id
         LEFT JOIN candidates c ON c.id = ja.candidate_id
        WHERE e.tenant_id = $1
          AND ($2::uuid IS NULL OR e.job_id = $2)
          AND ($3::uuid IS NULL OR e.application_id = $3)
        ORDER BY e.created_at DESC
        LIMIT $4`,
      [tenantId, jobId, applicationId, limit],
    );
    res.json(r.rows);
  } catch (err) {
    console.error("getActivity error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /v1/agents/summary */
export const getSummary = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const [jobs, today, pending, spend] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM job_autopilot WHERE tenant_id = $1 AND enabled`, [tenantId]),
      pool.query(
        `SELECT agent, action, COUNT(*)::int AS n FROM agent_events
          WHERE tenant_id = $1 AND created_at >= date_trunc('day', now())
          GROUP BY agent, action`,
        [tenantId],
      ),
      pool.query(`SELECT COUNT(*)::int AS n FROM agent_tasks WHERE tenant_id = $1 AND status IN ('pending','running')`, [tenantId]),
      pool.query(
        `SELECT SUM(cost_usd) AS total FROM ai_call_log
          WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())
            AND agent_id IN ('candidate_shortlister','screening_interviewer','screening_evaluator','screening_chat')`,
        [tenantId],
      ),
    ]);
    const count = (action: string, agent?: string) =>
      today.rows
        .filter((r: { agent: string; action: string }) => r.action === action && (!agent || r.agent === agent))
        .reduce((sum: number, r: { n: number }) => sum + r.n, 0);
    const total = spend.rows[0]?.total;
    res.json({
      autopilot_jobs: jobs.rows[0]?.n ?? 0,
      today: {
        shortlisted: count("shortlisted"),
        needs_review: count("needs_review"),
        screening_invites: count("screening_invited"),
        // Every evaluated screening records either "screening_passed" or a screener "needs_review".
        screenings_completed: count("screening_passed") + count("needs_review", "screener"),
        interviews_booked: count("interview_booked"),
      },
      pending_tasks: pending.rows[0]?.n ?? 0,
      spend_month_usd: total === null || total === undefined ? null : Math.round(Number(total) * 100) / 100,
    });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** POST /v1/agents/pause-all */
export const pauseAll = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  try {
    const r = await pool.query(`UPDATE job_autopilot SET enabled = false, updated_by = $2, updated_at = now() WHERE tenant_id = $1 AND enabled RETURNING job_id`, [tenantId, req.user?.id ?? null]);
    await pool.query(`UPDATE agent_tasks SET status = 'skipped', last_error = 'paused by user', updated_at = now() WHERE tenant_id = $1 AND status = 'pending' AND NOT manual`, [tenantId]);
    await recordEvent({ tenantId, agent: "system", action: "paused", summary: `All agents paused (${r.rows.length} job${r.rows.length === 1 ? "" : "s"} switched off autopilot).` });
    res.json({ paused: r.rows.length });
  } catch (err) {
    console.error("pauseAll error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const MANUAL_AGENTS: Record<string, AgentName> = { shortlister: "shortlister", screener: "screener", scheduler: "scheduler" };

/** POST /v1/agents/applications/:id/run  { agent } */
export const runAgentNow = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const agent = MANUAL_AGENTS[String(req.body?.agent ?? "")];
  if (!agent) return res.status(400).json({ message: "agent must be shortlister, screener or scheduler" });
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ message: "Application not found" });
  try {
    const r = await pool.query(`SELECT id, job_id FROM job_applications WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (!r.rows[0]) return res.status(404).json({ message: "Application not found" });
    const queued = await enqueueTask({ tenantId, jobId: r.rows[0].job_id, applicationId: id, agent, manual: true });
    res.status(202).json({ queued: true, already_queued: !queued });
  } catch (err) {
    console.error("runAgentNow error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/** GET /v1/agents/applications/:id/insights */
export const getInsights = async (req: AuthRequest, res: Response) => {
  const tenantId = req.user!.tenant_id;
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ message: "Application not found" });
  try {
    const a = await pool.query(`SELECT id, stage, needs_review, ai_shortlist FROM job_applications WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    const app = a.rows[0];
    if (!app) return res.status(404).json({ message: "Application not found" });

    const [sessionR, bookingR, eventsR] = await Promise.all([
      pool.query(
        `SELECT id, status, created_at, completed_at, expires_at, evaluation FROM screening_sessions
          WHERE application_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [id, tenantId],
      ),
      pool.query(
        `SELECT status, slots, chosen_slot, expires_at FROM interview_bookings
          WHERE application_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
        [id, tenantId],
      ),
      pool.query(
        `SELECT e.id, e.job_id, j.title AS job_title, e.application_id, ja.candidate_id,
                NULLIF(TRIM(CONCAT(c.first_name, ' ', c.last_name)), '') AS candidate_name,
                e.agent, e.action, e.summary, e.created_at
           FROM agent_events e
           LEFT JOIN jobs j ON j.id = e.job_id
           LEFT JOIN job_applications ja ON ja.id = e.application_id
           LEFT JOIN candidates c ON c.id = ja.candidate_id
          WHERE e.tenant_id = $1 AND e.application_id = $2
          ORDER BY e.created_at DESC LIMIT 20`,
        [tenantId, id],
      ),
    ]);

    const s = sessionR.rows[0];
    let screening = null;
    if (s) {
      const transcript = await pool.query(`SELECT role, content FROM screening_messages WHERE session_id = $1 ORDER BY created_at ASC`, [s.id]);
      const expired = s.status !== "completed" && new Date(s.expires_at).getTime() < Date.now();
      screening = {
        status: s.status === "completed" ? "completed" : expired || s.status === "expired" ? "expired" : transcript.rows.length ? "in_progress" : "invited",
        invited_at: s.created_at,
        completed_at: s.completed_at,
        // A skipped evaluation (too few answers) is stored as a marker, not shown as a score.
        evaluation: s.evaluation && !s.evaluation.skipped ? s.evaluation : null,
        transcript: transcript.rows,
      };
    }
    const b = bookingR.rows[0];
    const booking = b
      ? {
          status: b.status === "booked" ? "booked" : b.status === "sent" && new Date(b.expires_at).getTime() > Date.now() ? "sent" : "expired",
          slots: Array.isArray(b.slots) ? b.slots : [],
          chosen_slot: b.chosen_slot,
        }
      : null;

    res.json({
      application_id: app.id,
      stage: app.stage,
      needs_review: app.needs_review,
      shortlist: app.ai_shortlist ?? null,
      screening,
      booking,
      events: eventsR.rows,
    });
  } catch (err) {
    console.error("getInsights error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
