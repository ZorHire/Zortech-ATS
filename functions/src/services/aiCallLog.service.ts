import { platformQuery } from "../db/platform";

/** Bump whenever a Gemini prompt template changes, so cost/quality can be tracked across revisions. */
export const PROMPT_VERSION = "v1-2026-07-14";

/** Thrown when Gemini returns a response that doesn't parse as valid JSON — distinguishable from transport errors. */
export class SchemaInvalidError extends Error {}

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
  if (err instanceof SchemaInvalidError) return "schema_invalid";
  const status = (err as { status?: number; response?: { status?: number } })?.status
    ?? (err as { response?: { status?: number } })?.response?.status;
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
  entityType?: "resume" | "job_description" | "vendor_profile" | "candidate" | "job" | "job_application" | "screening_session";
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
    await platformQuery(
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
