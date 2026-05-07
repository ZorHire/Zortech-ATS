const API_URL = import.meta.env.VITE_API_URL || "/v1";

/**
 * Structured error thrown for non-2xx API responses.
 * Carries the full parsed response body so callers can read `code`, `message`, etc.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, any>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  async request(endpoint: string, options: RequestInit = {}, retry = true): Promise<any> {
    const token = localStorage.getItem("token");
    const body = options.body as any;

    const headers = {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        body:
          body instanceof FormData
            ? body
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        const errorBody = await response
          .json()
          .catch(() => ({ message: "Token expired" }));
        throw new ApiError(errorBody.message || "Token expired", 401, errorBody);
      }

      if (response.status === 402) {
        window.location.href = "/pricing";
        const errorBody = await response
          .json()
          .catch(() => ({ message: "Subscription required" }));
        throw new ApiError(errorBody.message || "Subscription required", 402, errorBody);
      }

      if (!response.ok) {
        if (retry && [500, 502, 503, 504].includes(response.status)) {
          return this.request(endpoint, options, false);
        }

        const errorData = await response
          .json()
          .catch(() => ({ message: "An error occurred" }));
        // Throw ApiError — preserves `code`, `message`, and any other fields
        throw new ApiError(
          errorData.message || "An error occurred",
          response.status,
          errorData,
        );
      }

      return response.json();
    } catch (error: any) {
      if (retry && error instanceof TypeError) {
        console.warn("Retrying API call after network failure:", endpoint);
        return this.request(endpoint, options, false);
      }
      throw error;
    }
  },

  get(endpoint: string) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint: string, body: any, options: RequestInit = {}) {
    return this.request(endpoint, {
      method: "POST",
      body,
      ...options,
    });
  },

  patch(endpoint: string, body: any, options: RequestInit = {}) {
    return this.request(endpoint, {
      method: "PATCH",
      body,
      ...options,
    });
  },

  delete(endpoint: string) {
    return this.request(endpoint, { method: "DELETE" });
  },
};

export default api;
