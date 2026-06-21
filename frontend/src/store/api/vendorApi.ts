import { baseApi } from "./baseApi";
import type { Vendor } from "../../types";

export interface VendorScorecardJob {
  job_id: string;
  title: string;
  job_status: string;
  submissions: number;
  shortlisted: number;
  hired: number;
  rejected: number;
}

export interface VendorScorecardSubmission {
  candidate_full_name: string;
  candidate_email: string;
  created_at: string;
  job_title: string;
  pipeline_stage: string | null;
}

export interface VendorScorecard {
  id: string;
  company_name: string;
  tier: string;
  submission_count: number;
  shortlist_rate: number;
  fill_rate: number;
  quality_score: number;
  sla_adherence: number;
  is_active: boolean;
  job_breakdown: VendorScorecardJob[];
  recent_submissions: VendorScorecardSubmission[];
}

export const vendorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendors: builder.query<Vendor[], void>({
      query: () => "/vendors",
      providesTags: ["Vendors"],
    }),

    createVendor: builder.mutation<Vendor, Record<string, unknown>>({
      query: (body) => ({ url: "/vendors", method: "POST", body }),
      invalidatesTags: ["Vendors"],
    }),

    updateVendor: builder.mutation<Vendor, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/vendors/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Vendors", "VendorScorecard"],
    }),

    deleteVendor: builder.mutation<void, string>({
      query: (id) => ({ url: `/vendors/${id}`, method: "DELETE" }),
      invalidatesTags: ["Vendors"],
    }),

    parseVendor: builder.mutation<Record<string, unknown>, FormData>({
      query: (body) => ({ url: "/parse/vendor", method: "POST", body }),
    }),

    getVendorScorecard: builder.query<VendorScorecard, string>({
      query: (id) => `/vendors/${id}/scorecard`,
      providesTags: (_result, _err, id) => [{ type: "VendorScorecard" as const, id }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
  useParseVendorMutation,
  useGetVendorScorecardQuery,
} = vendorApi;
