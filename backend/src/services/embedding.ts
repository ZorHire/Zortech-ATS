import axios from "axios";
import env from "../config/env";
import { logAiCall, PROMPT_VERSION } from "./aiCallLog";

const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Google's Matryoshka-truncatable embedding model. Model-name confidence here is moderate —
// embedding model names/availability shift without much notice, and the current GEMINI_API_KEY
// is revoked so this can't be verified live — isolated behind this one constant to keep a
// wrong guess a one-line fix.
const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Transient failures (network/timeout/429/5xx) are worth a retry; 4xx auth/bad-request errors are not. */
const isTransientError = (err: unknown): boolean => {
  if (axios.isAxiosError(err)) {
    if (!err.response) return true; // network error / timeout, no response received
    const status = err.response.status;
    return status === 429 || status >= 500;
  }
  return false;
};

/** Retries only transient failures, exponential backoff with jitter. Non-transient errors throw immediately. */
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !isTransientError(err)) throw err;
      const backoff = 400 * 2 ** attempt + Math.random() * 200;
      console.warn(
        `[Embedding] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(backoff)}ms:`,
        err instanceof Error ? err.message : err,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
};

/** Only the untruncated (3072-dim) output is pre-normalized by the model — a truncated vector must be re-normalized to unit length for cosine similarity to behave correctly. */
const normalize = (values: number[]): number[] => {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return values;
  return values.map((v) => v / norm);
};

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const categorizeError = (err: unknown): string => {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  if (typeof status === "number") {
    if (status === 403) return "403_forbidden";
    if (status === 429) return "429_rate_limit";
    if (status >= 500) return "5xx";
  }
  if (err instanceof Error && /timeout/i.test(err.message)) return "timeout";
  if (!status) return "network";
  return "unknown";
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
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const startedAt = Date.now();
  try {
    const response = await withRetry(() =>
      axios.post(
        `${GEMINI_URL_BASE}/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
        {
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: text.slice(0, 9000) }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        },
        { timeout: 20000 },
      ),
    );

    const values: number[] | undefined = response.data?.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Unexpected embedding response shape (length ${values?.length})`);
    }

    void logAiCall({
      tenantId,
      agentId: "candidate_embedder",
      entityType,
      model: EMBEDDING_MODEL,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return normalize(values);
  } catch (err) {
    void logAiCall({
      tenantId,
      agentId: "candidate_embedder",
      entityType,
      model: EMBEDDING_MODEL,
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error("[Embedding] embedText failed:", err instanceof Error ? err.message : err);
    return null;
  }
};
