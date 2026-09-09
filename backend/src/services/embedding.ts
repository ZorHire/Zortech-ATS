import env from "../config/env";
import { embed } from "../lib/ai/geminiClient";
import { categorizeError } from "../lib/ai/helpers";
import { logAiCall, PROMPT_VERSION } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";

const AGENT_ID = "candidate_embedder" as const;

export const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Only the untruncated (3072-dim) output is pre-normalized by the model — a truncated vector must be re-normalized to unit length for cosine similarity to behave correctly. */
const normalize = (values: number[]): number[] => {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return values;
  return values.map((v) => v / norm);
};

/**
 * Never throws — callers must treat a null return as "embedding not yet available",
 * the same graceful-degradation posture as every other Gemini-dependent feature.
 */
export const embedText = async (
  text: string,
  taskType: EmbeddingTaskType,
  tenantId: string,
  entityType: "candidate" | "job",
): Promise<number[] | null> => {
  if (!env.GEMINI_API_KEY) return null;

  const startedAt = Date.now();
  try {
    const response = await embed(AGENT_ID, text.slice(0, 9000), EMBEDDING_DIMENSIONS, taskType);
    if (!response) return null;

    if (response.vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding response shape (length ${response.vector.length})`);
    }

    void logAiCall({
      tenantId,
      agentId: AGENT_ID,
      entityType,
      model: response.model,
      promptVersion: PROMPT_VERSION,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      cachedTokens: response.usage.cachedTokens,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed: response.fallbackUsed,
    });

    return normalize(response.vector);
  } catch (err) {
    void logAiCall({
      tenantId,
      agentId: AGENT_ID,
      entityType,
      model: getModelForAgent(AGENT_ID),
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error("[Embedding] embedText failed:", err instanceof Error ? err.message : err);
    return null;
  }
};
