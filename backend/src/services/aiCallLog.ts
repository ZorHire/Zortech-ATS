import { query } from "../db";

/**
 * Bump whenever a Gemini prompt template changes, so cost/quality can be tracked
 * across revisions. Also used as part of the Redis idempotency cache key in
 * parse.utils.ts, so a prompt edit naturally busts stale cached responses.
 */
export const PROMPT_VERSION = "v2-2026-07-13";

const RATE_CARD_USD_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
};

/** Returns undefined (not 0) when the model has no rate-card entry or either token count is missing — an unknown cost should never be reported as free. */
export const estimateCostUsd = (
  model: string,
  inputTokens?: number,
  outputTokens?: number,
): number | undefined => {
  const rate = RATE_CARD_USD_PER_M_TOKENS[model];
  if (!rate || inputTokens === undefined || outputTokens === undefined) return undefined;
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

export interface LogAiCallParams {
  tenantId: string;
  agentId: string;
  entityType?: "resume" | "job_description" | "candidate" | "job" | "job_application" | "screening_session";
  entityId?: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  costUsd?: number;
  latencyMs: number;
  success: boolean;
  fallbackUsed?: boolean;
  errorReason?: string;
}

/** Never throws — logging must never break the parse response it's observing. */
export const logAiCall = async (params: LogAiCallParams): Promise<void> => {
  try {
    await query(
      `INSERT INTO ai_call_log (tenant_id, agent_id, entity_type, entity_id, model, prompt_version, input_tokens, output_tokens, cached_tokens, cost_usd, latency_ms, success, fallback_used, error_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        params.tenantId,
        params.agentId,
        params.entityType ?? null,
        params.entityId ?? null,
        params.model,
        params.promptVersion,
        params.inputTokens ?? null,
        params.outputTokens ?? null,
        params.cachedTokens ?? 0,
        params.costUsd ?? null,
        params.latencyMs,
        params.success,
        params.fallbackUsed ?? false,
        params.errorReason ?? null,
      ],
    );
  } catch (err) {
    console.error("[AICallLog] Failed to write log row:", err instanceof Error ? err.message : err);
  }
};
