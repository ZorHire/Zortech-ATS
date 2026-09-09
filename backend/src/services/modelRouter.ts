// At the top, export type AgentId with new values
export type AgentId =
  | "resume_parser"
  | "jd_parser"
  | "candidate_scorer"
  | "screening_chat"
  | "candidate_embedder"
  | "candidate_summariser"
  | "outreach_writer"
  | "interview_kit_generator"
  | "boolean_search_builder";

interface AgentModelConfig {
  model: string;
  fallback?: string;
  escalate?: string;
  capUsdMonth: number;
}

const MODEL_CONFIG: Record<AgentId, AgentModelConfig> = {
  resume_parser: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 20,
  },
  jd_parser: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 20,
  },
  candidate_scorer: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 50,
  },
  screening_chat: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 80,
  },
  candidate_embedder: { model: "gemini-embedding-001", capUsdMonth: 10 },
  candidate_summariser: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 30,
  },
  outreach_writer: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 40,
  },
  interview_kit_generator: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 25,
  },
  boolean_search_builder: {
    model: "gemini-2.5-flash-lite",
    fallback: "gemini-2.5-flash",
    capUsdMonth: 15,
  },
};

export const getAgentModelConfig = (agentId: AgentId): AgentModelConfig =>
  MODEL_CONFIG[agentId];

export const getModelForAgent = (agentId: AgentId): string =>
  MODEL_CONFIG[agentId].model;
