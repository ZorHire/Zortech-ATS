const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export const api = {
  async request(endpoint: string, options: RequestInit = {}, retry = true) {
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
        throw new Error(errorBody.message || "Token expired");
      }

      if (!response.ok) {
        if (retry && [500, 502, 503, 504].includes(response.status)) {
          return this.request(endpoint, options, false);
        }

        const error = await response
          .json()
          .catch(() => ({ message: "An error occurred" }));
        throw new Error(error.message || "An error occurred");
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
