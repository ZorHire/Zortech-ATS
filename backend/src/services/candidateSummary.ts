import env from "../config/env";
import { generateJson } from "../lib/ai/geminiClient";
import { wrapUntrusted } from "../lib/ai/wrapUntrusted";
import { safeJson, categorizeError } from "../lib/ai/helpers";
import { asString, asStringArray, asEnum } from "../lib/ai/coerce";
import { logAiCall, PROMPT_VERSION, checkBudget } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";
import redis from "../lib/redis";
import crypto from "crypto";

export const summariseCandidate = async (
  candidate: any, // bias-stripped projection
  resumeText: string,
  tenantId: string,
  entityId: string,
) => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agentId = "candidate_summariser" as const;

  // Idempotency cache key based on resume + prompt version
  const cacheKey = `summary:${crypto
    .createHash("sha256")
    .update(resumeText + PROMPT_VERSION)
    .digest("hex")}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    /* ignore */
  }

  const budgetOk = await checkBudget(agentId, tenantId);
  if (!budgetOk) {
    void logAiCall({
      tenantId,
      agentId,
      entityType: "candidate",
      entityId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      success: false,
      errorReason: "budget_exceeded",
    });
    return null;
  }

  const schema = `Return JSON with fields:
    summary: string (3-4 sentences, max 900 chars)
    headline: string (max 80 chars)
    key_skills: array of strings (max 10 items, each max 60 chars)
    seniority: enum ["junior", "mid", "senior", "lead", "principal"]
  `;

  const prompt = wrapUntrusted(schema, [
    {
      tag: "candidate_profile",
      label: "candidate profile",
      text: JSON.stringify(candidate),
    },
    { tag: "resume_text", label: "resume", text: resumeText.slice(0, 6000) },
  ]);

  const startedAt = Date.now();
  try {
    const result = await generateJson(agentId, prompt, { temperature: 0.2 });
    if (!result) return null;
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON");

    const output = {
      summary: asString(parsed.summary, 900),
      headline: asString(parsed.headline, 80),
      key_skills: asStringArray(parsed.key_skills, 10, 60),
      seniority: asEnum(
        parsed.seniority,
        ["junior", "mid", "senior", "lead", "principal"] as const,
        "mid",
      ),
    };

    // Cache for 1 week (as resume changes rarely)
    await redis
      .set(cacheKey, JSON.stringify(output), "EX", 7 * 24 * 3600)
      .catch(() => {});

    void logAiCall({
      tenantId,
      agentId,
      entityType: "candidate",
      entityId,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cachedTokens,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed: result.fallbackUsed,
    });
    return output;
  } catch (err) {
    void logAiCall({
      tenantId,
      agentId,
      entityType: "candidate",
      entityId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error(
      "[CandidateSummary] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};
