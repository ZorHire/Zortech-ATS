import env from "../config/env";
import { generateJson } from "../lib/ai/geminiClient";
import { wrapUntrusted } from "../lib/ai/wrapUntrusted";
import { safeJson, categorizeError } from "../lib/ai/helpers";
import { asString, asStringArray } from "../lib/ai/coerce";
import { logAiCall, PROMPT_VERSION, checkBudget } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";

export const draftOutreach = async (
  job: any,
  candidate: any, // bias-stripped projection
  tone: "formal" | "friendly" | "brief",
  recruiterName: string,
  companyName: string,
  salutationName: string, // for interpolation only
  tenantId: string,
  entityId: string,
  salaryRange?: string,
) => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agentId = "outreach_writer" as const;
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
    subject: string (max 120 chars)
    body: string (plain text, 120-200 words, max 2500 chars)
    personalisation_notes: array of strings (max 5, each max 160 chars)
  `;

  const jobInfo = {
    title: job.title,
    mandatory_skills: job.mandatory_skills,
    preferred_skills: job.preferred_skills,
    description: job.description,
    salaryRange: salaryRange || null,
  };

  const prompt = wrapUntrusted(schema, [
    { tag: "job_details", label: "job details", text: JSON.stringify(jobInfo) },
    {
      tag: "candidate_profile",
      label: "candidate profile",
      text: JSON.stringify(candidate),
    },
  ]);

  const fullPrompt = `${prompt}\n\nTone: ${tone}\nRecruiter name: ${recruiterName}\nCompany: ${companyName}`;

  const startedAt = Date.now();
  try {
    const result = await generateJson(agentId, fullPrompt, {
      temperature: 0.7,
    });
    if (!result) return null;
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON");

    let body = asString(parsed.body, 2500);
    // If no salary range provided, strip currency amounts from body.
    if (!salaryRange) {
      body = body.replace(/\$\s?\d[\d,.]*(k|K|M)?/g, "[compensation]");
    }

    // Interpolate salutation name after generation
    body = body.replace(/\{\{salutation\}\}/g, salutationName); // if used placeholder

    const output = {
      subject: asString(parsed.subject, 120),
      body,
      personalisation_notes: asStringArray(
        parsed.personalisation_notes,
        5,
        160,
      ),
    };

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
      "[OutreachWriter] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};
