import env from "../config/env";
import { generateJson } from "../lib/ai/geminiClient";
import { wrapUntrusted } from "../lib/ai/wrapUntrusted";
import { safeJson, categorizeError } from "../lib/ai/helpers";
import { asString, asStringArray, clampNumber } from "../lib/ai/coerce";
import { logAiCall, PROMPT_VERSION, checkBudget } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";
import redis from "../lib/redis";

const DENY_LIST = [
  "age", "marital", "family", "pregnancy", "religion", "caste", "national origin",
  "disability", "salary history", "current salary", "compensation history"
];

export const generateInterviewKit = async (
  job: any,
  stage: "screening" | "technical" | "managerial" | "final",
  durationMinutes: number,
  tenantId: string,
  entityId: string,
) => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agentId = "interview_kit_generator" as const;
  const budgetOk = await checkBudget(agentId, tenantId);
  if (!budgetOk) {
    void logAiCall({
      tenantId, agentId, entityType: "job", entityId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      success: false,
      errorReason: "budget_exceeded",
    });
    return null;
  }

  // Cache per job+stage+prompt version
  const cacheKey = `interviewkit:${job.id}:${stage}:${PROMPT_VERSION}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  const schema = `Return JSON with fields:
    competencies: array of {
      name: string,
      questions: array of strings (2-4 items, each max 300 chars),
      what_good_looks_like: string (max 500 chars),
      red_flags: array of strings (max 4 items, each max 160 chars)
    } (max 6 competencies)
    suggested_duration_split: array of { competency: string, minutes: number } (minutes 5-120)
  `;

  const jobInfo = {
    title: job.title,
    mandatory_skills: job.mandatory_skills,
    preferred_skills: job.preferred_skills,
    description: job.description,
  };

  const prompt = wrapUntrusted(schema, [
    { tag: "job_details", label: "job details", text: JSON.stringify(jobInfo) },
  ]);

  const fullPrompt = `${prompt}\n\nInterview stage: ${stage}\nDuration: ${durationMinutes} minutes.\nRemember: questions must be job-related only. Forbid questions about age, marital/family status, pregnancy, religion, caste, national origin, disability, or salary history.`;

  const startedAt = Date.now();
  try {
    const result = await generateJson(agentId, fullPrompt, { temperature: 0.4 });
    if (!result) return null;
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON");

    // Coerce and filter
    const competencies = asCompetencies(parsed.competencies);
    // Filter out denied topics in questions and red_flags
    const filteredCompetencies = competencies
      .map(comp => ({
        ...comp,
        questions: comp.questions.filter(q => !DENY_LIST.some(topic => q.toLowerCase().includes(topic))),
        red_flags: comp.red_flags.filter(r => !DENY_LIST.some(topic => r.toLowerCase().includes(topic))),
      }))
      .filter(comp => comp.questions.length > 0);

    // Validate duration split
    const split = asDurationSplit(parsed.suggested_duration_split, durationMinutes);
    const totalSplitMinutes = split.reduce((sum, s) => sum + s.minutes, 0);
    if (totalSplitMinutes > durationMinutes * 1.2) {
      // scale down proportionally
      const scale = durationMinutes / totalSplitMinutes;
      split.forEach(s => s.minutes = Math.max(5, Math.round(s.minutes * scale)));
    }

    const output = {
      competencies: filteredCompetencies,
      suggested_duration_split: split,
    };

    // Cache for 7 days
    await redis.set(cacheKey, JSON.stringify(output), "EX", 7 * 24 * 3600).catch(() => {});

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
    return output;
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
    console.error("[InterviewKit] failed:", err instanceof Error ? err.message : err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Coercion of model output into the declared schema. Anything the model returns
// that doesn't fit the shape is dropped rather than passed through to the UI.
// ---------------------------------------------------------------------------

export interface Competency {
  name: string;
  questions: string[];
  what_good_looks_like: string;
  red_flags: string[];
}

export interface DurationSplitEntry {
  competency: string;
  minutes: number;
}

const asCompetencies = (v: unknown): Competency[] => {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .slice(0, 6)
    .map((c) => ({
      name: asString(c.name, 80),
      questions: asStringArray(c.questions, 4, 300),
      what_good_looks_like: asString(c.what_good_looks_like, 500),
      red_flags: asStringArray(c.red_flags, 4, 160),
    }))
    .filter((c) => c.name.length > 0 && c.questions.length > 0);
};

const asDurationSplit = (v: unknown, durationMinutes: number): DurationSplitEntry[] => {
  if (!Array.isArray(v)) return [];
  const maxPerCompetency = Math.max(5, Math.min(120, durationMinutes));
  return v
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .slice(0, 6)
    .map((s) => ({
      competency: asString(s.competency, 80),
      minutes: clampNumber(s.minutes, 5, maxPerCompetency, 5),
    }))
    .filter((s) => s.competency.length > 0);
};