import env from "../config/env";
import { generateJson } from "../lib/ai/geminiClient";
import { wrapUntrusted } from "../lib/ai/wrapUntrusted";
import { safeJson, categorizeError } from "../lib/ai/helpers";
import { asString, asStringArray, clampScore } from "../lib/ai/coerce";
import { checkBudget, logAiCall, PROMPT_VERSION } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";

const AGENT_ID = "candidate_scorer" as const;

// ---------------------------------------------------------------------------
// Bias stripping — best-effort text redaction only. No gender/dob/age/marital
// fields exist structurally on `candidates` to strip; free text is inherently
// leaky, so this is a defensible reduction of risk, not a guarantee.
// ---------------------------------------------------------------------------

const HONORIFIC_RE = /\b(Mr|Mrs|Ms|Mx|Dr)\.?\s+/gi;

const PRONOUN_MAP: Record<string, string> = {
  he: "they", him: "them", his: "their", hers: "theirs",
  she: "they", her: "their", himself: "themself", herself: "themself",
};

const AGE_REVEALING_RE = /\b\d{1,2}\s*(?:years?\s*old|yo)\b|\bborn\s+(?:in|on)\s+[^.,\n]{2,20}/gi;

export const stripBiasFromSummary = (summary: string | null | undefined): string => {
  if (!summary) return "";
  let text = summary.replace(HONORIFIC_RE, "");
  text = text.replace(/\b(He|Him|His|Hers|She|Her|Himself|Herself)\b/gi, (match) => {
    const replacement = PRONOUN_MAP[match.toLowerCase()] ?? match;
    return match[0] === match[0].toUpperCase()
      ? replacement[0].toUpperCase() + replacement.slice(1)
      : replacement;
  });
  text = text.replace(AGE_REVEALING_RE, "");
  return text.trim();
};

export interface RawScoringCandidateRow {
  current_title?: string | null;
  current_company?: string | null;
  experience_years?: number | null;
  skills?: string[] | null;
  notice_period_days?: number | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  summary?: string | null;
}

/** Structural removal: name/email/phone/location never enter the prompt at all. */
export const buildBiasStrippedCandidate = (row: RawScoringCandidateRow) => ({
  label: "Candidate",
  current_title: row.current_title ?? "",
  current_company: row.current_company ?? "",
  experience_years: row.experience_years ?? null,
  skills: row.skills ?? [],
  notice_period_days: row.notice_period_days ?? null,
  current_ctc: row.current_ctc ?? null,
  expected_ctc: row.expected_ctc ?? null,
  summary: stripBiasFromSummary(row.summary),
});

export interface CandidateScoreBreakdown {
  rationale: string;
  strengths: string[];
  gaps: string[];
  model: string;
  scored_at: string;
}

export interface CandidateScoreResult {
  score: number;
  breakdown: CandidateScoreBreakdown;
}

export interface JobForScoring {
  title: string;
  mandatory_skills: string[];
  preferred_skills: string[];
  description: string;
}

const SCHEMA_AND_INSTRUCTIONS = `Score how well this candidate fits this job on a scale of 0-100, based only on the role requirements and the candidate's professional background. Do not consider or infer the candidate's name, gender, age, ethnicity, or location — none of that is provided and none of it should factor into the score. Return ONLY a JSON object with these exact fields:

{
  "score": 0-100 integer fit score,
  "rationale": "2-3 sentence explanation of the score, focused on skills/experience fit",
  "strengths": ["specific strengths relevant to this role"],
  "gaps": ["specific gaps or missing requirements, if any"]
}`;

/**
 * One JD x one candidate. Never throws — callers must treat a null return as
 * "scoring unavailable", same graceful-degradation contract as embedText.
 */
export const scoreCandidateForJob = async (
  job: JobForScoring,
  candidate: RawScoringCandidateRow,
  tenantId: string,
  applicationId: string,
): Promise<CandidateScoreResult | null> => {
  if (!env.GEMINI_API_KEY) return null;

  if (!(await checkBudget(AGENT_ID, tenantId))) {
    void logAiCall({
      tenantId,
      agentId: AGENT_ID,
      entityType: "job_application",
      entityId: applicationId,
      model: getModelForAgent(AGENT_ID),
      promptVersion: PROMPT_VERSION,
      success: false,
      errorReason: "budget_exceeded",
    });
    return null;
  }

  const jdText = [
    `Title: ${job.title}`,
    job.mandatory_skills?.length ? `Mandatory skills: ${job.mandatory_skills.join(", ")}` : "",
    job.preferred_skills?.length ? `Preferred skills: ${job.preferred_skills.join(", ")}` : "",
    job.description ? `Description: ${job.description}` : "",
  ].filter(Boolean).join("\n").slice(0, 6000);

  const candidateJson = JSON.stringify(buildBiasStrippedCandidate(candidate)).slice(0, 6000);

  const prompt = wrapUntrusted(SCHEMA_AND_INSTRUCTIONS, [
    { tag: "job_description", label: "job description", text: jdText },
    { tag: "candidate_profile", label: "candidate profile", text: candidateJson },
  ]);

  const startedAt = Date.now();
  try {
    const result = await generateJson(AGENT_ID, prompt, { temperature: 0.1 });
    if (!result) return null;

    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Gemini returned unparseable JSON for candidate score");

    const scoreResult: CandidateScoreResult = {
      score: clampScore(parsed.score),
      breakdown: {
        rationale: asString(parsed.rationale, 600),
        strengths: asStringArray(parsed.strengths, 5, 120),
        gaps: asStringArray(parsed.gaps, 5, 120),
        model: result.model,
        scored_at: new Date().toISOString(),
      },
    };

    void logAiCall({
      tenantId,
      agentId: AGENT_ID,
      entityType: "job_application",
      entityId: applicationId,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cachedTokens: result.usage.cachedTokens,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed: result.fallbackUsed,
    });

    return scoreResult;
  } catch (err) {
    void logAiCall({
      tenantId,
      agentId: AGENT_ID,
      entityType: "job_application",
      entityId: applicationId,
      model: getModelForAgent(AGENT_ID),
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error("[Scoring] scoreCandidateForJob failed:", err instanceof Error ? err.message : err);
    return null;
  }
};
