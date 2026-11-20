import { baseApi } from "./baseApi";

export type AiMeter = "shortlists" | "screenings" | "client_profiles" | "linkedin_prospects";

export interface AiMeterStatus {
  key: AiMeter;
  label: string;
  unit: string;
  used: number;
  /** null = unlimited */
  limit: number | null;
  included: number | null;
  topups: number;
  percent: number | null;
}

export interface AiUsage {
  month: string;
  resets_at: string;
  plan: "starter" | "growth" | "enterprise" | null;
  subscription_status: string | null;
  unlimited: boolean;
  users: number;
  billable_users: number;
  meters: AiMeterStatus[];
}

export const aiUsageApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getAiUsage: b.query<AiUsage, void>({ query: () => "/ai-usage", providesTags: ["AiUsage"] }),
  }),
});

export const { useGetAiUsageQuery } = aiUsageApi;

/** True when the server refused an AI action because the monthly allowance is used up. */
export const isAllowanceError = (err: unknown): boolean => {
  const e = err as { status?: number; data?: { code?: string } } | undefined;
  return e?.status === 402 || e?.data?.code === "ai_allowance_exceeded";
};
