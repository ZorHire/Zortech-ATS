import axios from "axios";

// Retry only transient failures (network, timeout, 429, 5xx).
// maxRetries = 2, exponential backoff with jitter.
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isTransientError(err)) {
        throw err;
      }
      const delayMs = 400 * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
};

export const safeJson = (text: string): any | null => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const isTransientError = (err: unknown): boolean => {
  const status = categorizeError(err);
  return (
    status === "network" ||
    status === "timeout" ||
    status === "429_rate_limit" ||
    status === "5xx"
  );
};

// Unified error categorization for both axios and @google/generative-ai SDK errors.
// Returns: "403_forbidden", "429_rate_limit", "5xx", "timeout", "network", "schema_invalid", "budget_exceeded", "unknown"
export const categorizeError = (err: unknown): string => {
  let status: number | undefined;
  if (axios.isAxiosError(err)) {
    status = err.response?.status;
  } else if (typeof err === "object" && err !== null && "status" in err) {
    status = (err as { status?: number }).status;
  }
  if (status === 403) return "403_forbidden";
  if (status === 429) return "429_rate_limit";
  if (status && status >= 500) return "5xx";
  if (axios.isAxiosError(err) && err.code === "ECONNABORTED") return "timeout";
  if (axios.isAxiosError(err) && !err.response) return "network";
  if (err instanceof SyntaxError) return "schema_invalid";
  return "unknown";
};
