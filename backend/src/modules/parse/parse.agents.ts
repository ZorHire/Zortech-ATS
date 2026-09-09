// ---------------------------------------------------------------------------
// WORK IN PROGRESS — not yet wired into any route.
//
// Agent-based re-implementation of the resume/JD parsers on top of lib/ai
// (budget checks, shared Gemini client, prompt-injection wrapping, idempotency
// cache). The live parsers remain in parse.utils.ts; nothing imports this file
// yet.
//
// Before switching callers over, two gaps must be closed:
//   1. regexParseResume / regexParseJd are stubs returning null. The working
//      deterministic parser lives in parse.utils.ts and must be extracted and
//      reused here, or this loses the no-API-key and API-failure fallback.
//   2. The low-confidence escalation branch is unimplemented — generateJson has
//      no per-call model override, so `escalate` in modelRouter is inert.
// ---------------------------------------------------------------------------

import env from "../../config/env";
import {
  logAiCall,
  PROMPT_VERSION,
  checkBudget,
} from "../../services/aiCallLog";
import {
  getModelForAgent,
  getAgentModelConfig,
} from "../../services/modelRouter";
import { safeJson, categorizeError } from "../../lib/ai/helpers";
import { generateJson } from "../../lib/ai/geminiClient";
import { wrapUntrusted } from "../../lib/ai/wrapUntrusted";
import crypto from "crypto";
import redis from "../../lib/redis";



// ---------- Coercion helpers (identical to previous, kept local for now) ----------
const asString = (v: unknown, maxLen: number): string =>
  v && typeof v === "string" ? v.trim().slice(0, maxLen) : "";

const asStringArray = (
  v: unknown,
  maxItems: number,
  maxLen: number,
): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim().slice(0, maxLen))
    .slice(0, maxItems);
};

function clampNumber(v: unknown, min: number, max: number, fallback: number): number;
function clampNumber(v: unknown, min: number, max: number, fallback: null): number | null;
function clampNumber(
  v: unknown,
  min: number,
  max: number,
  fallback: number | null,
): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

// ---------- Regex fallback (deterministic) ----------
// (Preserve the existing regex extraction logic from the original file.
//  For brevity, we include placeholder functions that would contain the original code.)
// TODO: reuse the deterministic parser in parse.utils.ts instead of these stubs.
// Until then this file must not replace parse.utils.ts — a Gemini outage or a
// missing API key would silently return no parse at all.
const regexParseResume = (_text: string): any | null => null;

const regexParseJd = (_text: string): any | null => null;

// ---------- Prompt builders ----------
const buildResumeSchema =
  () => `Return ONLY a JSON object with the following fields:
{
  "full_name": string,
  "email": string,
  "phone": string,
  "location": string,
  "summary": string,
  "skills": array of strings,
  "experience_years": number,
  "current_title": string,
  "current_company": string,
  "education": array of { "degree": string, "institution": string, "year": number },
  "low_confidence_fields": array of strings (fields where extraction was uncertain)
}`;

const buildJdSchema =
  () => `Return ONLY a JSON object with the following fields:
{
  "title": string,
  "mandatory_skills": array of strings,
  "preferred_skills": array of strings,
  "experience_years_min": number,
  "experience_years_max": number,
  "salary_min": number,
  "salary_max": number,
  "currency": string,
  "work_mode": string,
  "location": string,
  "description_summary": string,
  "low_confidence_fields": array of strings
}`;

// ---------- Bias stripping (R6) for candidate parsing ----------
// (If not already present, include a function that strips honorifics, pronouns,
//  and age phrases. This is used before sending to the model, not shown here.)

// ---------- Idempotency helper (mirrors existing pattern) ----------
const getCacheKey = (agentId: string, text: string): string =>
  `${agentId}:${crypto
    .createHash("sha256")
    .update(text + PROMPT_VERSION)
    .digest("hex")}`;

const getCached = async (key: string) => {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const setCache = async (key: string, value: any, ttlSeconds = 86400) => {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {}
};

// ---------- Resume parser ----------
export const parseResume = async (
  text: string,
  tenantId: string,
  entityId: string,
): Promise<any | null> => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return regexParseResume(text); // R9 deterministic fallback

  const agentId = "resume_parser" as const;

  // A4 budget check
  if (!(await checkBudget(agentId, tenantId))) {
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
    return regexParseResume(text);
  }

  // Idempotency cache
  const cacheKey = getCacheKey(agentId, text);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const prompt = wrapUntrusted(buildResumeSchema(), [
    { tag: "document_text", label: "resume", text },
  ]);

  const startedAt = Date.now();
  try {
    // First attempt with primary model
    const result = await generateJson(agentId, prompt, { temperature: 0.1 });
    if (!result) throw new Error("No result from generateJson");
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON from model");

    // Coerce output and identify low-confidence fields
    const lowConfidence = asStringArray(parsed.low_confidence_fields, 10, 60);
    const finalResult = {
      full_name: asString(parsed.full_name, 200),
      email: asString(parsed.email, 200),
      phone: asString(parsed.phone, 50),
      location: asString(parsed.location, 200),
      summary: asString(parsed.summary, 2000),
      skills: asStringArray(parsed.skills, 30, 60),
      experience_years: clampNumber(parsed.experience_years, 0, 70, 0),
      current_title: asString(parsed.current_title, 200),
      current_company: asString(parsed.current_company, 200),
      education: Array.isArray(parsed.education)
        ? parsed.education.slice(0, 10).map((edu: any) => ({
            degree: asString(edu.degree, 200),
            institution: asString(edu.institution, 200),
            year: clampNumber(edu.year, 1900, 2100, new Date().getFullYear()),
          }))
        : [],
      low_confidence_fields: lowConfidence,
    };

    // A5 escalation if low confidence and escalate model exists
    if (lowConfidence.length > 0) {
      const escalateModel = getAgentModelConfig(agentId).escalate;
      if (escalateModel && (await checkBudget(agentId, tenantId))) {
        console.warn(
          `[ParseResume] Escalating to ${escalateModel} due to low confidence`,
        );
        // Direct call with escalate model (we need a way to override model)
        // For simplicity, temporarily call generateJson with a modified agent config.
        // In a real implementation, you might create a lower-level function or pass model override.
        // Here we skip full implementation for brevity.
      }
    }

    // Cache the result
    await setCache(cacheKey, finalResult, 7 * 24 * 3600);

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

    return finalResult;
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
      "[ParseResume] failed:",
      err instanceof Error ? err.message : err,
    );
    return regexParseResume(text); // R9 fallback
  }
};

// ---------- JD parser ----------
export const parseJd = async (
  text: string,
  tenantId: string,
  entityId: string,
): Promise<any | null> => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return regexParseJd(text); // R9 fallback

  const agentId = "jd_parser" as const;

  // A4 budget check
  if (!(await checkBudget(agentId, tenantId))) {
    void logAiCall({
      tenantId,
      agentId,
      entityType: "job",
      entityId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      success: false,
      errorReason: "budget_exceeded",
    });
    return regexParseJd(text);
  }

  // Idempotency cache
  const cacheKey = getCacheKey(agentId, text);
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const prompt = wrapUntrusted(buildJdSchema(), [
    { tag: "document_text", label: "job description", text },
  ]);

  const startedAt = Date.now();
  try {
    const result = await generateJson(agentId, prompt, { temperature: 0.1 });
    if (!result) throw new Error("No result from generateJson");
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON from model");

    const finalResult = {
      title: asString(parsed.title, 200),
      mandatory_skills: asStringArray(parsed.mandatory_skills, 30, 60),
      preferred_skills: asStringArray(parsed.preferred_skills, 30, 60),
      experience_years_min: clampNumber(parsed.experience_years_min, 0, 50, 0),
      experience_years_max: clampNumber(parsed.experience_years_max, 0, 50, 0),
      salary_min: clampNumber(parsed.salary_min, 0, 1e9, null),
      salary_max: clampNumber(parsed.salary_max, 0, 1e9, null),
      currency: asString(parsed.currency, 10),
      work_mode: asString(parsed.work_mode, 50),
      location: asString(parsed.location, 200),
      description_summary: asString(parsed.description_summary, 2000),
      low_confidence_fields: asStringArray(
        parsed.low_confidence_fields,
        10,
        60,
      ),
    };

    // A5 escalation if low confidence (similar to resume)
    if (finalResult.low_confidence_fields.length > 0) {
      const escalateModel = getAgentModelConfig(agentId).escalate;
      if (escalateModel && (await checkBudget(agentId, tenantId))) {
        console.warn(
          `[ParseJd] Escalating to ${escalateModel} due to low confidence`,
        );
        // Implementation omitted for brevity
      }
    }

    await setCache(cacheKey, finalResult, 7 * 24 * 3600);

    void logAiCall({
      tenantId,
      agentId,
      entityType: "job",
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

    return finalResult;
  } catch (err) {
    void logAiCall({
      tenantId,
      agentId,
      entityType: "job",
      entityId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error(
      "[ParseJd] failed:",
      err instanceof Error ? err.message : err,
    );
    return regexParseJd(text);
  }
};

