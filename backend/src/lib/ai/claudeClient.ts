import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import env from "../../config/env";
import { checkBudget, logAiCall, PROMPT_VERSION } from "../../services/aiCallLog";
import type { AiCallEntityType } from "../../services/aiCallLog";
import { getModelForAgent } from "../../services/modelRouter";
import type { AgentId } from "../../services/modelRouter";

/**
 * Claude for the recruiting agents. One place for: the client, budget checks,
 * structured (schema-validated) output, prompt caching of the stable system
 * prompt, server-side refusal fallback, and ai_call_log accounting.
 *
 * Never throws: returns null when Claude is not configured, the monthly cap is
 * reached, the request fails, or the model refuses — callers degrade gracefully
 * (skip the step / fall back to Gemini) exactly like the Gemini services do.
 */

let client: Anthropic | null = null;
const getClient = (): Anthropic | null => {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
  }
  return client;
};

export const isClaudeConfigured = (): boolean => !!env.ANTHROPIC_API_KEY;

export type Effort = "low" | "medium" | "high";

export interface ClaudeStructuredParams<S extends z.ZodType> {
  agentId: AgentId;
  tenantId: string;
  entityType?: AiCallEntityType;
  entityId?: string;
  /** Stable instructions. Cached (prompt caching), so keep request-specific data out of it. */
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema: S;
  effort?: Effort;
  maxTokens?: number;
}

export interface ClaudeStructuredResult<T> {
  data: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
}

export async function claudeStructured<S extends z.ZodType>(
  params: ClaudeStructuredParams<S>,
): Promise<ClaudeStructuredResult<z.infer<S>> | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const model = getModelForAgent(params.agentId);
  const base = {
    tenantId: params.tenantId,
    agentId: params.agentId,
    entityType: params.entityType,
    entityId: params.entityId,
    promptVersion: PROMPT_VERSION,
  };

  if (!(await checkBudget(params.agentId, params.tenantId))) {
    void logAiCall({ ...base, model, success: false, errorReason: "budget_exceeded" });
    return null;
  }

  const startedAt = Date.now();
  try {
    const response = await anthropic.beta.messages.parse({
      model,
      max_tokens: params.maxTokens ?? 8000,
      // Opus 5.5 defaults to medium effort; set it explicitly per agent.
      output_config: {
        effort: params.effort ?? "medium",
        format: betaZodOutputFormat(params.schema),
      },
      // If a safety classifier declines, the API re-runs the request on a suitable
      // fallback model inside the same call (no client-side retry needed).
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: params.system, cache_control: { type: "ephemeral" } }],
      messages: params.messages,
    });

    const usage = {
      inputTokens:
        (response.usage.input_tokens ?? 0) +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens ?? 0,
      cachedTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    const fallbackUsed = response.model !== model;

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
      void logAiCall({
        ...base,
        model: response.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedTokens: usage.cachedTokens,
        latencyMs: Date.now() - startedAt,
        success: false,
        fallbackUsed,
        errorReason: response.stop_reason === "refusal" ? "refusal" : response.stop_reason === "max_tokens" ? "max_tokens" : "schema_invalid",
      });
      return null;
    }

    void logAiCall({
      ...base,
      model: response.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed,
    });
    return { data: response.parsed_output as z.infer<S>, model: response.model, usage };
  } catch (err) {
    let reason = "unknown";
    if (err instanceof Anthropic.RateLimitError) reason = "429_rate_limit";
    else if (err instanceof Anthropic.AuthenticationError) reason = "401_auth";
    else if (err instanceof Anthropic.BadRequestError) reason = "400_bad_request";
    else if (err instanceof Anthropic.APIConnectionTimeoutError) reason = "timeout";
    else if (err instanceof Anthropic.APIConnectionError) reason = "network";
    else if (err instanceof Anthropic.APIError) reason = (err.status ?? 0) >= 500 ? "5xx" : `http_${err.status}`;
    void logAiCall({ ...base, model, latencyMs: Date.now() - startedAt, success: false, errorReason: reason });
    console.error(`[Claude] ${params.agentId} failed (${reason}):`, err instanceof Error ? err.message : err);
    return null;
  }
}
