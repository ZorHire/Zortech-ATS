import pool from "../../db";
import { getTenantTransporter, getUserTransporter } from "../email/email.controller";

/** Data access for the AI agents. All queries are tenant-scoped and parameterised. */

export type AgentName = "shortlister" | "screener" | "screen_evaluator" | "scheduler";

export interface AutopilotSettings {
  job_id: string;
  enabled: boolean;
  shortlist_threshold: number;
  screen_pass_threshold: number;
  auto_screen: boolean;
  auto_schedule: boolean;
  interview_duration_min: number;
  interview_slots: string[];
  daily_outreach_cap: number;
  updated_at: string | null;
}

export const DEFAULT_SETTINGS: Omit<AutopilotSettings, "job_id" | "updated_at"> = {
  enabled: false,
  shortlist_threshold: 70,
  screen_pass_threshold: 65,
  auto_screen: true,
  auto_schedule: true,
  interview_duration_min: 45,
  interview_slots: [],
  daily_outreach_cap: 25,
};

const toSettings = (row: Record<string, unknown> | undefined, jobId: string): AutopilotSettings => ({
  job_id: jobId,
  enabled: (row?.enabled as boolean) ?? DEFAULT_SETTINGS.enabled,
  shortlist_threshold: (row?.shortlist_threshold as number) ?? DEFAULT_SETTINGS.shortlist_threshold,
  screen_pass_threshold: (row?.screen_pass_threshold as number) ?? DEFAULT_SETTINGS.screen_pass_threshold,
  auto_screen: (row?.auto_screen as boolean) ?? DEFAULT_SETTINGS.auto_screen,
  auto_schedule: (row?.auto_schedule as boolean) ?? DEFAULT_SETTINGS.auto_schedule,
  interview_duration_min: (row?.interview_duration_min as number) ?? DEFAULT_SETTINGS.interview_duration_min,
  interview_slots: Array.isArray(row?.interview_slots) ? (row!.interview_slots as string[]) : [],
  daily_outreach_cap: (row?.daily_outreach_cap as number) ?? DEFAULT_SETTINGS.daily_outreach_cap,
  updated_at: row?.updated_at ? new Date(row.updated_at as string).toISOString() : null,
});

export async function getSettings(tenantId: string, jobId: string): Promise<AutopilotSettings> {
  const r = await pool.query(`SELECT * FROM job_autopilot WHERE job_id = $1 AND tenant_id = $2`, [jobId, tenantId]);
  return toSettings(r.rows[0], jobId);
}

/** Keeps only future, valid ISO datetimes, de-duplicated and sorted, max 60. */
export function cleanSlots(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];
  const now = Date.now();
  const out = new Set<string>();
  for (const s of slots) {
    if (typeof s !== "string") continue;
    const t = Date.parse(s);
    if (Number.isFinite(t) && t > now) out.add(new Date(t).toISOString());
  }
  return [...out].sort().slice(0, 60);
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

export async function upsertSettings(
  tenantId: string,
  jobId: string,
  userId: string | undefined,
  patch: Partial<AutopilotSettings>,
): Promise<AutopilotSettings> {
  const current = await getSettings(tenantId, jobId);
  const next = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    shortlist_threshold: clampInt(patch.shortlist_threshold, 0, 100, current.shortlist_threshold),
    screen_pass_threshold: clampInt(patch.screen_pass_threshold, 0, 100, current.screen_pass_threshold),
    auto_screen: typeof patch.auto_screen === "boolean" ? patch.auto_screen : current.auto_screen,
    auto_schedule: typeof patch.auto_schedule === "boolean" ? patch.auto_schedule : current.auto_schedule,
    interview_duration_min: clampInt(patch.interview_duration_min, 15, 240, current.interview_duration_min),
    interview_slots: patch.interview_slots !== undefined ? cleanSlots(patch.interview_slots) : cleanSlots(current.interview_slots),
    daily_outreach_cap: clampInt(patch.daily_outreach_cap, 0, 1000, current.daily_outreach_cap),
  };
  const r = await pool.query(
    `INSERT INTO job_autopilot (job_id, tenant_id, enabled, shortlist_threshold, screen_pass_threshold, auto_screen,
                                auto_schedule, interview_duration_min, interview_slots, daily_outreach_cap, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11, now())
     ON CONFLICT (job_id) DO UPDATE SET
       enabled = EXCLUDED.enabled, shortlist_threshold = EXCLUDED.shortlist_threshold,
       screen_pass_threshold = EXCLUDED.screen_pass_threshold, auto_screen = EXCLUDED.auto_screen,
       auto_schedule = EXCLUDED.auto_schedule, interview_duration_min = EXCLUDED.interview_duration_min,
       interview_slots = EXCLUDED.interview_slots, daily_outreach_cap = EXCLUDED.daily_outreach_cap,
       updated_by = EXCLUDED.updated_by, updated_at = now()
     WHERE job_autopilot.tenant_id = EXCLUDED.tenant_id
     RETURNING *`,
    [
      jobId, tenantId, next.enabled, next.shortlist_threshold, next.screen_pass_threshold, next.auto_screen,
      next.auto_schedule, next.interview_duration_min, JSON.stringify(next.interview_slots), next.daily_outreach_cap, userId ?? null,
    ],
  );
  return toSettings(r.rows[0], jobId);
}

export async function recordEvent(e: {
  tenantId: string;
  jobId?: string | null;
  applicationId?: string | null;
  agent: AgentName | "system";
  action: string;
  summary: string;
  detail?: unknown;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO agent_events (tenant_id, job_id, application_id, agent, action, summary, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [e.tenantId, e.jobId ?? null, e.applicationId ?? null, e.agent, e.action, e.summary.slice(0, 500), e.detail === undefined ? null : JSON.stringify(e.detail)],
    );
  } catch (err) {
    // The feed must never break the agent step it's describing.
    console.error("[Agents] recordEvent failed:", err instanceof Error ? err.message : err);
  }
}

/** Candidate-facing emails sent by agents for this job today (for daily_outreach_cap). */
export async function outreachSentToday(tenantId: string, jobId: string): Promise<number> {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM agent_events
      WHERE tenant_id = $1 AND job_id = $2 AND action IN ('screening_invited','schedule_link_sent')
        AND created_at >= date_trunc('day', now())`,
    [tenantId, jobId],
  );
  return r.rows[0]?.n ?? 0;
}

/** Queue a task unless one is already open for this application + agent. Returns true if queued. */
export async function enqueueTask(t: {
  tenantId: string;
  jobId: string | null;
  applicationId: string;
  agent: AgentName;
  manual?: boolean;
  runAfter?: Date;
}): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO agent_tasks (tenant_id, job_id, application_id, agent, manual, run_after)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (application_id, agent) WHERE status IN ('pending','running') DO NOTHING
     RETURNING id`,
    [t.tenantId, t.jobId, t.applicationId, t.agent, !!t.manual, t.runAfter ?? new Date()],
  );
  return r.rows.length > 0;
}

export interface AgentTaskRow {
  id: string;
  tenant_id: string;
  job_id: string | null;
  application_id: string;
  agent: AgentName;
  attempts: number;
  manual: boolean;
}

/** Atomically claim due tasks (safe with several backend instances). */
export async function claimDueTasks(limit: number): Promise<AgentTaskRow[]> {
  const r = await pool.query(
    `UPDATE agent_tasks SET status = 'running', attempts = attempts + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM agent_tasks
         WHERE status = 'pending' AND run_after <= now()
         ORDER BY run_after
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING id, tenant_id, job_id, application_id, agent, attempts, manual`,
    [limit],
  );
  return r.rows;
}

export async function finishTask(id: string, status: "done" | "skipped", note?: string): Promise<void> {
  await pool.query(`UPDATE agent_tasks SET status = $2, last_error = $3, updated_at = now() WHERE id = $1`, [id, status, note ?? null]);
}

const MAX_ATTEMPTS = 4;

/** Retry with backoff (2, 8, 32 min), then mark failed. Returns true if it will be retried. */
export async function failTask(task: AgentTaskRow, error: string): Promise<boolean> {
  if (task.attempts >= MAX_ATTEMPTS) {
    await pool.query(`UPDATE agent_tasks SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1`, [task.id, error.slice(0, 500)]);
    return false;
  }
  const delayMin = 2 * 4 ** (task.attempts - 1);
  await pool.query(
    `UPDATE agent_tasks SET status = 'pending', last_error = $2, run_after = now() + ($3 || ' minutes')::interval, updated_at = now() WHERE id = $1`,
    [task.id, error.slice(0, 500), String(delayMin)],
  );
  return true;
}

/** Tasks stuck in "running" (e.g. process restarted mid-task) go back to pending. */
export async function releaseStaleTasks(): Promise<void> {
  await pool.query(
    `UPDATE agent_tasks SET status = 'pending', updated_at = now()
      WHERE status = 'running' AND updated_at < now() - interval '15 minutes'`,
  );
}

/**
 * Mailbox for agent emails: the company mailbox first, otherwise the job's
 * assigned recruiter's mailbox. Null means "can't email" — the step is skipped.
 */
export async function getAgentMailer(tenantId: string, jobId: string | null) {
  const tenantMail = await getTenantTransporter(tenantId);
  if (tenantMail) return tenantMail;
  if (!jobId) return null;
  const r = await pool.query(`SELECT assigned_recruiter_id FROM jobs WHERE id = $1 AND tenant_id = $2`, [jobId, tenantId]);
  const recruiterId = r.rows[0]?.assigned_recruiter_id;
  return recruiterId ? getUserTransporter(recruiterId) : null;
}

/** Escape text for safe interpolation into HTML emails. */
export const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
