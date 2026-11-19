import { baseApi } from "./baseApi";

export interface DemoRequestBody {
  name: string;
  email: string;
  company: string;
  role?: string;
  phone?: string;
  teamSize?: string;
  message?: string;
  /** Honeypot: must stay empty. */
  website?: string;
}

export const demoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    requestDemo: builder.mutation<{ message: string }, DemoRequestBody>({
      query: (body) => ({ url: "/demo-requests", method: "POST", body, timeout: 20000 }),
    }),
  }),
});

export const { useRequestDemoMutation } = demoApi;
