/**
 * Config-only, single-provider model router. Centralizes which model each
 * agent uses instead of hardcoding the model string at each call site.
 *
 * fallback/escalate/capUsdMonth are declared but inert — nothing reads or
 * enforces them yet. They exist so this shape doesn't need redesigning once
 * real multi-provider fallback and cost/audit logging (Phase 3 Step 2) land.
 *
 * No vendor_parser entry here — backend/'s vendor parser has no independent
 * Gemini call site (it delegates to parseResumeText), so it reuses
 * resume_parser's config by virtue of reusing the resume code path.
 */
export type AgentId = "resume_parser" | "jd_parser";

interface AgentModelConfig {
  model: string;
  fallback?: string;
  escalate?: string;
  capUsdMonth: number;
}

const MODEL_CONFIG: Record<AgentId, AgentModelConfig> = {
  resume_parser: {
    model: "gemini-2.5-flash-lite",
    fallback: "gpt-5.4-mini",
    escalate: "claude-haiku-4-5",
    capUsdMonth: 60,
  },
  jd_parser: {
    model: "gemini-2.5-flash-lite",
    fallback: "gpt-5.4-mini",
    capUsdMonth: 20,
  },
};

export const getModelForAgent = (agentId: AgentId): string => MODEL_CONFIG[agentId].model;
