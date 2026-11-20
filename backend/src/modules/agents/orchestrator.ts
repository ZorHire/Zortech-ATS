import pool from "../../db";
import env from "../../config/env";
import {
  AgentName,
  AgentTaskRow,
  claimDueTasks,
  enqueueTask,
  failTask,
  finishTask,
  recordEvent,
  releaseStaleTasks,
} from "./agentStore";
import { runShortlister } from "./shortlister";
import { runScreeningInvite, runScreeningEvaluation } from "./screener";
import { runScheduler } from "./schedulerAgent";
import { isClaudeConfigured } from "../../lib/ai/claudeClient";
import { AllowanceExceededError, tenantsWithoutRoom } from "../../services/aiAllowance";

/**
 * Autopilot is a sweep, not a set of hooks: every minute we look at autopilot
 * jobs and queue whatever step each application is due for. That covers every
 * way a candidate can land on a job (manual add, bulk upload, vendor, search)
 * and makes the whole flow idempotent and restart-safe.
 */

const SWEEP_LIMIT = 50; // per step per tick
const RUN_LIMIT = 10; // tasks executed per tick (keeps model spend and email bursts smooth)

type Runner = (t: { tenantId: string; applicationId: string; manual?: boolean }) => Promise<"done" | "skipped">;
const RUNNERS: Record<AgentName, Runner> = {
  shortlister: runShortlister,
  screener: runScreeningInvite,
  screen_evaluator: runScreeningEvaluation,
  scheduler: runScheduler,
};

async function queueRows(agent: AgentName, sql: string, skipTenants: string[] = []): Promise<number> {
  const r = await pool.query(sql, sql.includes("$2") ? [SWEEP_LIMIT, skipTenants] : [SWEEP_LIMIT]);
  let n = 0;
  for (const row of r.rows) {
    if (await enqueueTask({ tenantId: row.tenant_id, jobId: row.job_id, applicationId: row.application_id, agent })) n++;
  }
  return n;
}

export async function sweep(): Promise<void> {
  const base = `FROM job_applications ja
                JOIN job_autopilot ap ON ap.job_id = ja.job_id AND ap.tenant_id = ja.tenant_id AND ap.enabled
                JOIN jobs j ON j.id = ja.job_id AND j.deleted_at IS NULL`;
  const notQueued = (agent: AgentName) =>
    `NOT EXISTS (SELECT 1 FROM agent_tasks t WHERE t.application_id = ja.id AND t.agent = '${agent}' AND t.status IN ('pending','running','failed'))`;

  // Shortlisting and evaluation need Claude; without a key those steps simply don't run.
  const claude = isClaudeConfigured();
  // Companies that have used this month's AI allowance are left alone; their candidates are
  // picked up again after a top-up or when the allowance resets on the 1st.
  const noShortlists = await tenantsWithoutRoom("shortlists");
  const noScreenings = await tenantsWithoutRoom("screenings");
  const notBlocked = `NOT (ja.tenant_id = ANY($2::uuid[]))`;

  // 1. Score new candidates
  if (claude) await queueRows(
    "shortlister",
    `SELECT ja.tenant_id, ja.job_id, ja.id AS application_id ${base}
      WHERE ja.stage IN ('new','sourced') AND ja.ai_shortlist IS NULL AND ${notQueued("shortlister")} AND ${notBlocked}
      ORDER BY ja.created_at LIMIT $1`,
    noShortlists,
  );
  // 2. Invite shortlisted candidates to the screening interview
  await queueRows(
    "screener",
    `SELECT ja.tenant_id, ja.job_id, ja.id AS application_id ${base}
      WHERE ap.auto_screen AND ja.stage = 'shortlisted'
        AND NOT EXISTS (SELECT 1 FROM screening_sessions s WHERE s.application_id = ja.id)
        AND ${notQueued("screener")} AND ${notBlocked}
      ORDER BY ja.updated_at LIMIT $1`,
    noScreenings,
  );
  // 3. Evaluate finished screening interviews
  if (claude) await queueRows(
    "screen_evaluator",
    `SELECT DISTINCT ON (ja.id) ja.tenant_id, ja.job_id, ja.id AS application_id ${base}
       JOIN screening_sessions s ON s.application_id = ja.id
      WHERE s.status = 'completed' AND s.evaluation IS NULL AND ${notQueued("screen_evaluator")}
      ORDER BY ja.id LIMIT $1`,
  );
  // 4. Send scheduling links to candidates who passed (normally queued by step 3; this is the safety net)
  await queueRows(
    "scheduler",
    `SELECT DISTINCT ON (ja.id) ja.tenant_id, ja.job_id, ja.id AS application_id ${base}
       JOIN screening_sessions s ON s.application_id = ja.id
      WHERE ap.auto_schedule AND ja.stage = 'screened' AND ja.needs_review = false
        AND (s.evaluation->>'overall_score')::int >= ap.screen_pass_threshold
        AND s.evaluation->>'recommendation' <> 'do_not_advance'
        AND NOT EXISTS (SELECT 1 FROM interview_bookings b WHERE b.application_id = ja.id)
        AND ${notQueued("scheduler")}
      ORDER BY ja.id LIMIT $1`,
  );
}

async function runTask(task: AgentTaskRow): Promise<void> {
  try {
    const outcome = await RUNNERS[task.agent]({ tenantId: task.tenant_id, applicationId: task.application_id, manual: task.manual });
    await finishTask(task.id, outcome);
  } catch (err) {
    if (err instanceof AllowanceExceededError) {
      // Not a failure: drop the task so the sweep queues it again once there is allowance.
      await pool.query(`DELETE FROM agent_tasks WHERE id = $1`, [task.id]);
      await recordEvent({
        tenantId: task.tenant_id,
        jobId: task.job_id,
        applicationId: task.application_id,
        agent: task.agent === "screen_evaluator" ? "screener" : task.agent,
        action: "skipped",
        summary: `Paused: ${err.message}`,
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const willRetry = await failTask(task, message);
    if (!willRetry) {
      await recordEvent({
        tenantId: task.tenant_id,
        jobId: task.job_id,
        applicationId: task.application_id,
        agent: task.agent === "screen_evaluator" ? "screener" : task.agent,
        action: "failed",
        summary: `The ${task.agent.replace("_", " ")} step failed after several tries: ${message.slice(0, 200)}`,
      });
    }
  }
}

let running = false;

/** Called every minute by scheduler.ts. Re-entrancy guarded. */
export async function agentTick(): Promise<void> {
  if (!env.AI_AGENTS_ENABLED || running) return;
  running = true;
  try {
    await releaseStaleTasks();
    await sweep();
    const tasks = await claimDueTasks(RUN_LIMIT);
    for (const task of tasks) await runTask(task);
  } catch (err) {
    console.error("[Agents] tick failed:", err instanceof Error ? err.message : err);
  } finally {
    running = false;
  }
}
