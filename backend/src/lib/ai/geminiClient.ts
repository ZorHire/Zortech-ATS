import axios from "axios";
import env from "../../config/env";
import { AgentId, getAgentModelConfig } from "../../services/modelRouter";
import { withRetry } from "./helpers";

const GEMINI_URL_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

type Usage = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

type GenerateJsonOptions = {
  temperature?: number;
  systemInstruction?: string;
  contents?: Array<{ role: string; parts: Array<{ text: string }> }>;
};

export const generateJson = async (
  agentId: AgentId,
  prompt: string,
  opts: GenerateJsonOptions = {},
): Promise<{
  text: string;
  usage: Usage;
  model: string;
  fallbackUsed: boolean;
} | null> => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const config = getAgentModelConfig(agentId);
  const primaryModel = config.model;
  const fallbackModel = config.fallback;
  const temperature = opts.temperature ?? 0.1;

  let usedModel = primaryModel;
  let fallbackUsed = false;

  const makeRequest = async (model: string) => {
    // Build request body dynamically based on whether contents are provided.
    const requestBody: any = {
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    };

    if (opts.contents) {
      requestBody.contents = opts.contents;
    } else {
      requestBody.contents = [{ parts: [{ text: prompt }] }];
    }

    if (opts.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: opts.systemInstruction }],
      };
    }

    const response = await withRetry(() =>
      axios.post(
        `${GEMINI_URL_BASE}/${model}:generateContent?key=${apiKey}`,
        requestBody,
        { timeout: 20000 },
      ),
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");
    const usage: Usage = {
      inputTokens: response.data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.data?.usageMetadata?.candidatesTokenCount ?? 0,
      cachedTokens: response.data?.usageMetadata?.cachedContentTokenCount ?? 0,
    };
    return { text, usage };
  };

  try {
    const result = await makeRequest(primaryModel);
    usedModel = primaryModel;
    return { ...result, model: usedModel, fallbackUsed };
  } catch (err) {
    if (fallbackModel) {
      try {
        console.warn(
          `[GeminiClient] Primary model ${primaryModel} failed, trying fallback ${fallbackModel}`,
        );
        const result = await makeRequest(fallbackModel);
        usedModel = fallbackModel;
        fallbackUsed = true;
        return { ...result, model: usedModel, fallbackUsed };
      } catch (fallbackErr) {
        throw err;
      }
    }
    throw err;
  }
};

export const embed = async (
  agentId: AgentId,
  text: string,
  dimensions: number,
  taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<{
  vector: number[];
  usage: Usage;
  model: string;
  fallbackUsed: boolean;
} | null> => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const config = getAgentModelConfig(agentId);
  const primaryModel = config.model;
  const fallbackModel = config.fallback;
  let usedModel = primaryModel;
  let fallbackUsed = false;

  const makeRequest = async (model: string) => {
    const response = await withRetry(() =>
      axios.post(
        `${GEMINI_URL_BASE}/${model}:embedContent?key=${apiKey}`,
        {
          model: `models/${model}`,
          content: { parts: [{ text }] },
          ...(taskType ? { taskType } : {}),
          outputDimensionality: dimensions,
        },
        { timeout: 20000 },
      ),
    );
    const vector = response.data?.embedding?.values;
    if (!vector || !Array.isArray(vector))
      throw new Error("Empty embedding response");
    const usage: Usage = {
      inputTokens: response.data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: 0,
      cachedTokens: 0,
    };
    return { vector, usage };
  };

  try {
    const result = await makeRequest(primaryModel);
    usedModel = primaryModel;
    return { ...result, model: usedModel, fallbackUsed };
  } catch (err) {
    if (fallbackModel) {
      try {
        console.warn(
          `[GeminiClient] Primary embedding model ${primaryModel} failed, trying fallback ${fallbackModel}`,
        );
        const result = await makeRequest(fallbackModel);
        usedModel = fallbackModel;
        fallbackUsed = true;
        return { ...result, model: usedModel, fallbackUsed };
      } catch (fallbackErr) {
        throw err;
      }
    }
    throw err;
  }
};
