import { query } from "../db";
import redis from "../lib/redis";
import { AgentId, getAgentModelConfig } from "./modelRouter";

/**
 * Bump whenever a Gemini prompt template changes, so cost/quality can be tracked
 * across revisions. Also used as part of the Redis idempotency cache key in
 * parse.utils.ts, so a prompt edit naturally busts stale cached responses.
 */
export const PROMPT_VERSION = "v2-2026-07-13";

/**
 * USD per 1M tokens, list price. A model missing from this table yields an
 * undefined cost (never 0) — see estimateCostUsd.
 *
 * NOTE: these are list prices and drift without notice. Verify against
 * https://ai.google.dev/pricing before relying on the budget caps in
 * modelRouter, since caps are enforced from the costs derived here.
 */
const RATE_CARD_USD_PER_M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-embedding-001": { input: 0.15, output: 0 },
};

/** Returns undefined (not 0) when the model has no rate-card entry or either token count is missing — an unknown cost should never be reported as free. */
export const estimateCostUsd = (
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined => {
  const rate = RATE_CARD_USD_PER_M_TOKENS[model];
  if (!rate || inputTokens === undefined || outputTokens === undefined)
    return undefined;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
};

export const categorizeError = (err: unknown): string => {
  if (err instanceof SyntaxError) return "schema_invalid";
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    if (status === 403) return "403_forbidden";
    if (status === 429) return "429_rate_limit";
    if (status >= 500) return "5xx";
  }
  if (err instanceof Error && /timeout/i.test(err.message)) return "timeout";
  if (!status) return "network";
  return "unknown";
};

export type AiCallEntityType =
  | "resume"
  | "job_description"
  | "candidate"
  | "job"
  | "job_application"
  | "screening_session";

export interface LogAiCallParams {
  tenantId: string;
  agentId: string;
  entityType?: AiCallEntityType;
  /** Must be a uuid — omit entirely for agents with no entity (e.g. boolean search). */
  entityId?: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  /** Derived from the rate card when omitted. */
  costUsd?: number;
  /** Omitted for calls rejected before dispatch (e.g. budget_exceeded). */
  latencyMs?: number;
  success: boolean;
  fallbackUsed?: boolean;
  errorReason?: string;
}

/** Never throws — logging must never break the response it's observing. */
export const logAiCall = async (params: LogAiCallParams): Promise<void> => {
  try {
    const costUsd =
      params.costUsd ??
      estimateCostUsd(params.model, params.inputTokens, params.outputTokens);

    await query(
      `INSERT INTO ai_call_log (tenant_id, agent_id, entity_type, entity_id, model, prompt_version, input_tokens, output_tokens, cached_tokens, cost_usd, latency_ms, success, fallback_used, error_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        params.tenantId,
        params.agentId,
        params.entityType ?? null,
        params.entityId || null,
        params.model,
        params.promptVersion,
        params.inputTokens ?? null,
        params.outputTokens ?? null,
        params.cachedTokens ?? 0,
        costUsd ?? null,
        params.latencyMs ?? null,
        params.success,
        params.fallbackUsed ?? false,
        params.errorReason ?? null,
      ],
    );
  } catch (err) {
    console.error(
      "[AICallLog] Failed to write log row:",
      err instanceof Error ? err.message : err,
    );
  }
};

/**
 * Month-to-date spend check against the agent's cap in modelRouter.
 *
 * Fails open: an agent with no cap, a Redis outage, or a DB error all allow the
 * call through. A billing safeguard must never be the reason a recruiter's
 * parse or score silently stops working.
 */
export const checkBudget = async (
  agentId: AgentId,
  tenantId: string,
): Promise<boolean> => {
  const cap = getAgentModelConfig(agentId)?.capUsdMonth;
  if (!cap) return true;

  const month = new Date().toISOString().slice(0, 7);
  const cacheKey = `budget:${tenantId}:${agentId}:${month}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) return parseFloat(cached) < cap;
  } catch {
    // Cache unavailable — fall through to the authoritative DB read.
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  try {
    const result = await query(
      `SELECT COALESCE(SUM(cost_usd), 0) AS total
         FROM ai_call_log
        WHERE tenant_id = $1 AND agent_id = $2 AND created_at >= $3`,
      [tenantId, agentId, monthStart],
    );
    const spent = parseFloat(result.rows[0]?.total ?? "0");
    try {
      // Short TTL: a stale under-count only ever delays the cap by a minute.
      await redis.set(cacheKey, String(spent), "EX", 60);
    } catch {
      // Non-fatal.
    }
    return spent < cap;
  } catch (err) {
    console.error(
      "[Budget] Error checking budget:",
      err instanceof Error ? err.message : err,
    );
    return true;
  }
};
