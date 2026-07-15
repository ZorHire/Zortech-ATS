import { baseApi } from "./baseApi";

export interface VendorPortalJob {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  work_mode: string;
  employment_type: string;
  experience_min: number;
  experience_max: number;
  status: string;
  priority: string;
  headcount: number;
  mandatory_skills: string[];
  preferred_skills: string[];
  description: string | null;
  target_start_date: string | null;
  sla_deadline: string | null;
  created_at: string;
  client_name: string | null;
  my_submission_count: number;
}

export interface VendorSubmission {
  id: string;
  candidate_full_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  experience_years: number | null;
  skills: string[];
  cover_note: string | null;
  status: string;
  created_at: string;
  job_id: string;
  job_title: string;
  job_location: string | null;
  client_name: string | null;
  pipeline_stage: string | null;
  rejection_reason: string | null;
}

export interface VendorProfile {
  id: string;
  company_name: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string | null;
  industry_specializations: string[];
  geographies: string[];
  tier: string;
  is_active: boolean;
}

export interface SubmitCandidatePayload {
  job_id: string;
  candidate_full_name: string;
  candidate_email: string;
  candidate_phone?: string;
  experience_years?: number;
  skills?: string[];
  cover_note?: string;
}

export const vendorPortalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendorPortalJobs: builder.query<{ vendor_id: string; jobs: VendorPortalJob[] }, void>({
      query: () => "/vendor-portal/jobs",
      providesTags: ["VendorPortalJobs"],
    }),

    getVendorPortalJobDetail: builder.query<VendorPortalJob, string>({
      query: (id) => `/vendor-portal/jobs/${id}`,
      providesTags: (_res, _err, id) => [{ type: "VendorPortalJobs", id }],
    }),

    getVendorSubmissions: builder.query<VendorSubmission[], void>({
      query: () => "/vendor-portal/submissions",
      providesTags: ["VendorSubmissions"],
    }),

    getVendorProfile: builder.query<VendorProfile, void>({
      query: () => "/vendor-portal/profile",
      providesTags: ["VendorProfile"],
    }),

    submitCandidate: builder.mutation<
      { message: string; submission_id: string; candidate_id: string },
      SubmitCandidatePayload
    >({
      query: (body) => ({ url: "/vendor-portal/submit", method: "POST", body }),
      invalidatesTags: ["VendorSubmissions", "VendorPortalJobs"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetVendorPortalJobsQuery,
  useGetVendorPortalJobDetailQuery,
  useGetVendorSubmissionsQuery,
  useGetVendorProfileQuery,
  useSubmitCandidateMutation,
} = vendorPortalApi;
