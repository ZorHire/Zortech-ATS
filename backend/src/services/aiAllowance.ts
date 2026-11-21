/**
 * Monthly AI allowances: how many Claude-powered actions a company may run each
 * month, based on its plan and its number of users (docs/ai-allowances.md).
 *
 * - Counted in actions customers understand (shortlists, screenings, client
 *   profiles, LinkedIn prospects), not tokens or dollars.
 * - Pooled across the company: per-user allowance × billable users.
 * - The same candidate / screening / prospect counts once per month, so re-running
 *   it is free.
 * - Admins get an in-app alert at 80% and at 100%.
 * - ZorTech's own company (is_platform_owner) is not limited here; the per-agent
 *   dollar caps in modelRouter still apply.
 */
import pool from "../db";
import redis from "../lib/redis";
import type { AgentId } from "./modelRouter";
import { computeAccess } from "../modules/billing/subscriptionAccess";

export type Meter = "shortlists" | "screenings" | "client_profiles" | "linkedin_prospects";
export type PlanType = "starter" | "growth" | "enterprise";

export const METERS: { key: Meter; label: string; unit: string }[] = [
  { key: "shortlists", label: "AI shortlisting", unit: "candidates assessed" },
  { key: "screenings", label: "AI screening interviews", unit: "interviews" },
  { key: "client_profiles", label: "AI client profiles", unit: "profiles" },
  { key: "linkedin_prospects", label: "LinkedIn agent", unit: "people scored with a note" },
];

/**
 * Actions included per user per month. Sized so a user who uses every allowance
 * in full costs about 30% of the plan price at today's Claude Opus 5.5 rates
 * (typical use is far lower). Change these numbers here; nothing else needs to move.
 */
export const PLAN_ALLOWANCES: Record<PlanType, Record<Meter, number>> = {
  starter: { shortlists: 0, screenings: 0, client_profiles: 10, linkedin_prospects: 100 },
  growth: { shortlists: 150, screenings: 30, client_profiles: 20, linkedin_prospects: 300 },
  enterprise: { shortlists: 200, screenings: 40, client_profiles: 30, linkedin_prospects: 400 },
};

/** Free trial: a fixed pool for the whole company, whatever its size. */
export const TRIAL_ALLOWANCE: Record<Meter, number> = { shortlists: 50, screenings: 10, client_profiles: 10, linkedin_prospects: 100 };

/** Plans charge for at least this many users (matches the plan's user range). */
const PLAN_MIN_USERS: Record<PlanType, number> = { starter: 5, growth: 26, enterprise: 150 };

/** Which Claude agents each meter covers. */
export const AGENT_METER: Partial<Record<AgentId, Meter>> = {
  candidate_shortlister: "shortlists",
  screening_interviewer: "screenings",
  screening_evaluator: "screenings",
  submission_writer: "client_profiles",
  linkedin_prospect_scorer: "linkedin_prospects",
};

/**
 * Highest expected Claude cost of one action, in USD. Used to scale each agent's
 * dollar safety cap with the company's allowance, so a big customer is limited by
 * its allowance and not by a cap sized for a small one.
 */
export const MAX_USD_PER_ACTION: Record<Meter, number> = {
  shortlists: 0.12,
  screenings: 0.6, // interview turns + the evaluation
  client_profiles: 0.25,
  linkedin_prospects: 0.03,
};

const STAFF_ROLES = ["super_admin", "accounts_manager", "recruiter", "vendor_manager"];
const ADMIN_ROLES = ["super_admin", "accounts_manager"];

/** First day of the current month in India time, as YYYY-MM-01. */
export const currentMonth = (now = new Date()): string => {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return `${ist.toISOString().slice(0, 7)}-01`;
};

/** When the current month's allowance resets (midnight India time on the 1st), as ISO. */
export const resetsAt = (now = new Date()): string => {
  const [y, m] = currentMonth(now).split("-").map(Number);
  const nextUtcMidnight = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
  return new Date(nextUtcMidnight - 5.5 * 3600 * 1000).toISOString();
};

export interface MeterStatus {
  key: Meter;
  label: string;
  unit: string;
  used: number;
  /** null = unlimited */
  limit: number | null;
  included: number | null;
  topups: number;
  percent: number | null;
}

export interface AllowanceStatus {
  month: string;
  resets_at: string;
  plan: PlanType | null;
  subscription_status: string | null;
  unlimited: boolean;
  users: number;
  billable_users: number;
  meters: MeterStatus[];
}

interface TenantPlan {
  unlimited: boolean;
  plan: PlanType | null;
  status: string | null;
  users: number;
  billableUsers: number;
  perMeter: Record<Meter, number | null>; // included actions (null = unlimited)
}

async function loadPlan(tenantId: string): Promise<TenantPlan> {
  const r = await pool.query(
    `SELECT t.is_platform_owner, s.plan_type, s.status, s.end_date, s.seats,
            (SELECT count(*)::int FROM tenant_memberships m
              WHERE m.tenant_id = t.id AND m.is_active AND m.role = ANY($2)) AS users
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
      WHERE t.id = $1
      ORDER BY s.created_at DESC NULLS LAST
      LIMIT 1`,
    [tenantId, STAFF_ROLES],
  );
  const row = r.rows[0];
  const users = row?.users ?? 0;
  const none = { shortlists: 0, screenings: 0, client_profiles: 0, linkedin_prospects: 0 };
  if (!row) return { unlimited: false, plan: null, status: null, users, billableUsers: 0, perMeter: none };
  if (row.is_platform_owner) {
    return { unlimited: true, plan: row.plan_type ?? null, status: row.status ?? null, users, billableUsers: users,
      perMeter: { shortlists: null, screenings: null, client_profiles: null, linkedin_prospects: null } };
  }
  const plan = (row.plan_type ?? null) as PlanType | null;
  const status = row.status ?? null;
  // Same rule as sign-in: a plan works until its end date (a cancelled plan until the
  // end of the paid period), even before the nightly job marks it expired.
  const access = computeAccess(row);
  if (!plan || !access.active) {
    return { unlimited: false, plan, status, users, billableUsers: 0, perMeter: none };
  }
  if (status === "trial") return { unlimited: false, plan, status, users, billableUsers: users, perMeter: { ...TRIAL_ALLOWANCE } };
  // Paid seats, fixed at payment, so users added mid-period don't raise the allowance
  // before they're paid for. Plans bought before seat billing have no seats yet.
  const billableUsers = row.seats != null ? Number(row.seats) : Math.max(users, PLAN_MIN_USERS[plan] ?? 1);
  const per = PLAN_ALLOWANCES[plan];
  const perMeter = Object.fromEntries(METERS.map((m) => [m.key, per[m.key] * billableUsers])) as Record<Meter, number>;
  return { unlimited: false, plan, status, users, billableUsers, perMeter };
}

async function usageCounts(tenantId: string, month: string): Promise<{ used: Record<string, number>; topups: Record<string, number> }> {
  const [u, t] = await Promise.all([
    pool.query(`SELECT meter, count(*)::int AS n FROM ai_usage WHERE tenant_id = $1 AND month = $2 GROUP BY meter`, [tenantId, month]),
    pool.query(`SELECT meter, sum(units)::int AS n FROM ai_allowance_topups WHERE tenant_id = $1 AND month = $2 GROUP BY meter`, [tenantId, month]),
  ]);
  return {
    used: Object.fromEntries(u.rows.map((r) => [r.meter, r.n])),
    topups: Object.fromEntries(t.rows.map((r) => [r.meter, r.n])),
  };
}

export async function getAllowanceStatus(tenantId: string): Promise<AllowanceStatus> {
  const month = currentMonth();
  const [p, c] = await Promise.all([loadPlan(tenantId), usageCounts(tenantId, month)]);
  const meters = METERS.map((m): MeterStatus => {
    const used = c.used[m.key] ?? 0;
    const topups = c.topups[m.key] ?? 0;
    const included = p.perMeter[m.key];
    const limit = included === null ? null : included + topups;
    return { key: m.key, label: m.label, unit: m.unit, used, limit, included, topups,
      percent: limit === null ? null : limit === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100)) };
  });
  return { month, resets_at: resetsAt(), plan: p.plan, subscription_status: p.status, unlimited: p.unlimited,
    users: p.users, billable_users: p.billableUsers, meters };
}

/** Limit for one meter this month (null = unlimited), cached for a minute. */
export async function meterLimit(tenantId: string, meter: Meter): Promise<number | null> {
  const key = `ai-allow:${tenantId}:${meter}:${currentMonth()}`;
  try {
    const cached = await redis.get(key);
    if (cached !== null) return cached === "unlimited" ? null : Number(cached);
  } catch { /* cache unavailable */ }
  const s = await getAllowanceStatus(tenantId);
  const limit = s.meters.find((m) => m.key === meter)?.limit ?? 0;
  try { await redis.set(key, limit === null ? "unlimited" : String(limit), "EX", 60); } catch { /* non-fatal */ }
  return limit;
}

export class AllowanceExceededError extends Error {
  constructor(public meter: Meter, public used: number, public limit: number) {
    super(allowanceMessage(meter));
    this.name = "AllowanceExceededError";
  }
}

export const allowanceMessage = (meter: Meter): string => {
  const label = METERS.find((m) => m.key === meter)?.label ?? "AI";
  return `This month's ${label} allowance is used up. It resets on the 1st; ask your admin to upgrade the plan or add more.`;
};

/** Body for a 402 response a client can recognise. */
export const allowanceErrorBody = (meter: Meter) => ({ code: "ai_allowance_exceeded", meter, message: allowanceMessage(meter) });

export interface ConsumeResult { ok: boolean; counted: boolean; used: number; limit: number | null }

/**
 * Count one action against the company's allowance, before the AI call.
 * Returns ok=true when the action may run: either it was already counted this month
 * (re-runs are free), or there is room and it is now counted. `force` counts it even
 * over the limit (used to finish a screening a candidate has already started).
 *
 * If the database can't be reached the action is refused: the AI call would almost
 * certainly fail the same way, and an unmetered call is what this exists to stop.
 */
export async function consumeAllowance(tenantId: string, meter: Meter, entityId: string, opts: { force?: boolean } = {}): Promise<ConsumeResult> {
  const month = currentMonth();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // One writer per company and meter at a time, so two parallel requests can't both take the last action.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`ai-allow:${tenantId}:${meter}`]);
    const seen = await client.query(`SELECT 1 FROM ai_usage WHERE tenant_id = $1 AND meter = $2 AND entity_id = $3 AND month = $4`, [tenantId, meter, entityId, month]);
    const usedRow = await client.query(`SELECT count(*)::int AS n FROM ai_usage WHERE tenant_id = $1 AND meter = $2 AND month = $3`, [tenantId, meter, month]);
    const used = usedRow.rows[0].n as number;
    if (seen.rows.length) { await client.query("COMMIT"); return { ok: true, counted: false, used, limit: null }; }
    const limit = await meterLimit(tenantId, meter);
    if (limit !== null && used >= limit && !opts.force) { await client.query("COMMIT"); return { ok: false, counted: false, used, limit }; }
    await client.query(`INSERT INTO ai_usage (tenant_id, meter, entity_id, month) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [tenantId, meter, entityId, month]);
    await client.query("COMMIT");
    const now = used + 1;
    if (limit !== null && limit > 0) void alertIfNeeded(tenantId, meter, month, now, limit);
    return { ok: true, counted: true, used: now, limit };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[AI allowance] consume failed:", err instanceof Error ? err.message : err);
    return { ok: false, counted: false, used: 0, limit: 0 };
  } finally {
    client.release();
  }
}

/** Throwing form for callers that want an exception. */
export async function requireAllowance(tenantId: string, meter: Meter, entityId: string, opts: { force?: boolean } = {}): Promise<void> {
  const r = await consumeAllowance(tenantId, meter, entityId, opts);
  if (!r.ok) throw new AllowanceExceededError(meter, r.used, r.limit ?? 0);
}

/** Whether the company has room for at least one more action (without counting one). */
export async function hasRoom(tenantId: string, meter: Meter): Promise<boolean> {
  const limit = await meterLimit(tenantId, meter);
  if (limit === null) return true;
  const r = await pool.query(`SELECT count(*)::int AS n FROM ai_usage WHERE tenant_id = $1 AND meter = $2 AND month = $3`, [tenantId, meter, currentMonth()]);
  return r.rows[0].n < limit;
}

/** Whether this action would be allowed now: already counted this month, or there is room. Counts nothing. */
export async function canRun(tenantId: string, meter: Meter, entityId: string): Promise<boolean> {
  const seen = await pool.query(`SELECT 1 FROM ai_usage WHERE tenant_id = $1 AND meter = $2 AND entity_id = $3 AND month = $4`, [tenantId, meter, entityId, currentMonth()]);
  return seen.rows.length > 0 || hasRoom(tenantId, meter);
}

/**
 * Companies that have used up a meter this month. Only companies with usage this
 * month can be over, so this stays cheap. Used by the Autopilot sweep to leave
 * their candidates alone (they're picked up again after a top-up or on the 1st).
 */
export async function tenantsWithoutRoom(meter: Meter): Promise<string[]> {
  const month = currentMonth();
  const r = await pool.query(`SELECT tenant_id, count(*)::int AS n FROM ai_usage WHERE meter = $1 AND month = $2 GROUP BY tenant_id`, [meter, month]);
  const out: string[] = [];
  for (const row of r.rows) {
    const limit = await meterLimit(row.tenant_id, meter);
    if (limit !== null && row.n >= limit) out.push(row.tenant_id);
  }
  // Companies whose plan includes none of this meter, even with no usage yet.
  const zero = await pool.query(
    `SELECT t.id FROM tenants t JOIN subscriptions s ON s.tenant_id = t.id
      WHERE NOT t.is_platform_owner
        AND (s.status NOT IN ('active','trial') OR s.end_date <= now() OR (s.status = 'active' AND s.plan_type = ANY($1)))`,
    [Object.entries(PLAN_ALLOWANCES).filter(([, a]) => a[meter] === 0).map(([k]) => k)],
  );
  for (const row of zero.rows) {
    if (out.includes(row.id)) continue;
    const limit = await meterLimit(row.id, meter);
    if (limit === 0) out.push(row.id);
  }
  return out;
}

/** Dollar safety cap for an agent, scaled to the company's allowance. */
export async function scaledCapUsd(tenantId: string, agentId: AgentId, baseCap: number): Promise<number> {
  const meter = AGENT_METER[agentId];
  if (!meter) return baseCap;
  try {
    const limit = await meterLimit(tenantId, meter);
    if (limit === null) return baseCap;
    return Math.max(baseCap, limit * MAX_USD_PER_ACTION[meter]);
  } catch {
    return baseCap;
  }
}

async function alertIfNeeded(tenantId: string, meter: Meter, month: string, used: number, limit: number): Promise<void> {
  const level = used >= limit ? 100 : used >= Math.ceil(limit * 0.8) ? 80 : 0;
  if (!level) return;
  try {
    const ins = await pool.query(
      `INSERT INTO ai_usage_alerts (tenant_id, meter, month, level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING level`,
      [tenantId, meter, month, level],
    );
    if (!ins.rows.length) return; // already told
    const label = METERS.find((m) => m.key === meter)?.label ?? "AI";
    const title = level === 100 ? `${label}: this month's allowance is used up` : `${label}: 80% of this month's allowance used`;
    const body = level === 100
      ? `${used} of ${limit} used. New ${label.toLowerCase()} actions are paused until the 1st. Upgrade the plan or add more in Settings → AI usage.`
      : `${used} of ${limit} used. See Settings → AI usage.`;
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, entity_type)
       SELECT m.user_id, $2, $3, $4, 'ai_usage' FROM tenant_memberships m
        WHERE m.tenant_id = $1 AND m.is_active AND m.role = ANY($5)`,
      [tenantId, level === 100 ? "error" : "warning", title, body, ADMIN_ROLES],
    );
  } catch (err) {
    console.error("[AI allowance] alert failed:", err instanceof Error ? err.message : err);
  }
}

/** Drop the cached limit after a plan change or a top-up, so it applies at once. */
export async function clearAllowanceCache(tenantId: string): Promise<void> {
  const month = currentMonth();
  for (const m of METERS) {
    try { await redis.del(`ai-allow:${tenantId}:${m.key}:${month}`); } catch { /* non-fatal */ }
  }
}
