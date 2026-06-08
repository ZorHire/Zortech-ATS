import { baseApi } from "./baseApi";

export interface FunnelRow {
  stage: string;
  count: number;
  conv: number;
}

export interface SourceRow {
  source: string;
  count: number;
}

export interface MonthlyRow {
  label: string;
  count: number;
}

export interface RecruiterRow {
  recruiter_name: string;
  assigned_jobs: number;
  candidates_sourced: number;
  shortlisted: number;
  submitted: number;
  placements: number;
}

export interface VendorRow {
  name: string;
  rate: number;
  submits: number;
}

export interface AnalyticsSummary {
  total_candidates: number;
  active_jobs: number;
  total_placements: number;
  pending_offers: number;
  offer_accept_rate: number | null;
}

export interface AnalyticsData {
  funnel: FunnelRow[];
  sources: SourceRow[];
  monthly: MonthlyRow[];
  recruiters: RecruiterRow[];
  vendors: VendorRow[];
  summary: AnalyticsSummary;
}

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnalytics: builder.query<AnalyticsData, void>({
      query: () => "/admin/analytics",
      providesTags: ["Analytics"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetAnalyticsQuery } = analyticsApi;
