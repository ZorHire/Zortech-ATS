import env from "../config/env";
import { generateJson } from "../lib/ai/geminiClient";
import { wrapUntrusted } from "../lib/ai/wrapUntrusted";
import { safeJson, categorizeError } from "../lib/ai/helpers";
import { asString, asStringArray } from "../lib/ai/coerce";
import { logAiCall, PROMPT_VERSION, checkBudget } from "./aiCallLog";
import { getModelForAgent } from "./modelRouter";

export const buildBooleanQuery = async (
  brief: string,
  platform: "linkedin" | "naukri" | "github" | "generic",
  tenantId: string,
) => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agentId = "boolean_search_builder" as const;
  const budgetOk = await checkBudget(agentId, tenantId);
  if (!budgetOk) {
    void logAiCall({
      tenantId,
      agentId,
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      success: false,
      errorReason: "budget_exceeded",
    });
    return null;
  }

  const schema = `Return JSON with fields:
    query: string (max 1000 chars)
    must_have: array of strings (max 20, each 60 chars)
    nice_to_have: array of strings (max 20, each 60 chars)
    excluded: array of strings (max 20, each 60 chars)
    explanation: string (max 300 chars)
  `;

  const prompt = wrapUntrusted(schema, [
    { tag: "hiring_brief", label: "hiring brief", text: brief.slice(0, 2000) },
  ]);

  const fullPrompt = `${prompt}\n\nTarget platform: ${platform}`;

  const startedAt = Date.now();
  try {
    const result = await generateJson(agentId, fullPrompt, {
      temperature: 0.2,
    });
    if (!result) return null;
    const parsed = safeJson(result.text);
    if (!parsed) throw new Error("Unparseable JSON");

    const query = asString(parsed.query, 1000);
    // Syntactic validation
    if (!isValidBooleanQuery(query)) {
      throw new Error("Invalid boolean query syntax");
    }

    const output = {
      query,
      must_have: asStringArray(parsed.must_have, 20, 60),
      nice_to_have: asStringArray(parsed.nice_to_have, 20, 60),
      excluded: asStringArray(parsed.excluded, 20, 60),
      explanation: asString(parsed.explanation, 300),
    };

    void logAiCall({
      tenantId,
      agentId,
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
      model: getModelForAgent(agentId),
      promptVersion: PROMPT_VERSION,
      latencyMs: Date.now() - startedAt,
      success: false,
      errorReason: categorizeError(err),
    });
    console.error(
      "[BooleanSearch] failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};

function isValidBooleanQuery(query: string): boolean {
  // Balanced parentheses
  let depth = 0;
  for (const ch of query) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  if (depth !== 0) return false;

  // Balanced quotes
  const quoteCount = (query.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) return false;

  // Allowed operators and characters
  const allowedRegex = /^[a-zA-Z0-9\s()"*+\-:]+$/;
  if (!allowedRegex.test(query)) return false;

  // Check for invalid operator usage? Simple check: ensure AND/OR/NOT are uppercase when used.
  // This is a basic validation; more robust would require a tokenizer.
  return true;
}
