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
  submission_id: string;
  candidate_full_name: string;
  candidate_email: string;
  created_at: string;
  job_title: string;
  pipeline_stage: string | null;
  recruiter_rating: number | null;
  recruiter_notes: string | null;
}

export interface VendorLeaderboardEntry {
  id: string;
  company_name: string;
  tier: string;
  submission_count: number;
  shortlist_rate: number;
  fill_rate: number;
  quality_score: number;
  sla_adherence: number;
  is_active: boolean;
  rank: number;
}

export interface VendorContract {
  id: string;
  tenant_id: string;
  vendor_id: string;
  contract_type: "msa" | "nda" | "sow" | "other";
  title: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "expired" | "terminated" | "draft";
  terms: string | null;
  value: number | null;
  currency: string;
  renewal_reminder_days: number;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
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

    getVendorLeaderboard: builder.query<VendorLeaderboardEntry[], void>({
      query: () => "/vendors/leaderboard",
      providesTags: ["VendorLeaderboard"],
    }),

    listVendorContracts: builder.query<VendorContract[], string>({
      query: (vendorId) => `/vendors/${vendorId}/contracts`,
      providesTags: (_result, _err, vendorId) => [{ type: "VendorContracts" as const, id: vendorId }],
    }),

    createVendorContract: builder.mutation<VendorContract, { vendorId: string; body: Record<string, unknown> }>({
      query: ({ vendorId, body }) => ({ url: `/vendors/${vendorId}/contracts`, method: "POST", body }),
      invalidatesTags: (_result, _err, { vendorId }) => [{ type: "VendorContracts" as const, id: vendorId }],
    }),

    updateVendorContract: builder.mutation<VendorContract, { vendorId: string; contractId: string; body: Record<string, unknown> }>({
      query: ({ vendorId, contractId, body }) => ({ url: `/vendors/${vendorId}/contracts/${contractId}`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { vendorId }) => [{ type: "VendorContracts" as const, id: vendorId }],
    }),

    deleteVendorContract: builder.mutation<void, { vendorId: string; contractId: string }>({
      query: ({ vendorId, contractId }) => ({ url: `/vendors/${vendorId}/contracts/${contractId}`, method: "DELETE" }),
      invalidatesTags: (_result, _err, { vendorId }) => [{ type: "VendorContracts" as const, id: vendorId }],
    }),

    addSubmissionFeedback: builder.mutation<{ id: string; recruiter_rating: number | null; recruiter_notes: string | null; feedback_given_at: string }, { vendorId: string; submissionId: string; body: { recruiter_rating?: number | null; recruiter_notes?: string | null } }>({
      query: ({ vendorId, submissionId, body }) => ({ url: `/vendors/${vendorId}/submissions/${submissionId}/feedback`, method: "PATCH", body }),
      invalidatesTags: (_result, _err, { vendorId }) => [{ type: "VendorScorecard" as const, id: vendorId }],
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
  useGetVendorLeaderboardQuery,
  useListVendorContractsQuery,
  useCreateVendorContractMutation,
  useUpdateVendorContractMutation,
  useDeleteVendorContractMutation,
  useAddSubmissionFeedbackMutation,
} = vendorApi;
