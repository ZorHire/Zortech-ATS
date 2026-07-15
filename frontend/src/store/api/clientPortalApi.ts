import { baseApi } from "./baseApi";

export interface ClientPortalJob {
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
  created_at: string;
  pending_review_count: number;
  reviewed_count: number;
}

export interface ClientCandidate {
  application_id: string;
  stage: string;
  notes: string | null;
  applied_at: string;
  candidate_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_title: string | null;
  experience_years: number | null;
  current_location: string | null;
  skills: string[];
  summary: string | null;
  resume_url: string | null;
  client_decision: "approved" | "rejected" | "hold" | null;
  client_notes: string | null;
  feedback_at: string | null;
}

export interface ClientProfile {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  headquarters_location: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  engagement_type: string | null;
  tier: string;
}

export interface ClientUserPayload {
  email: string;
  full_name: string;
  client_id: string;
  password: string;
}

export interface FeedbackPayload {
  applicationId: string;
  decision: "approved" | "rejected" | "hold";
  notes?: string;
}

export const clientPortalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getClientPortalJobs: builder.query<{ client_id: string; jobs: ClientPortalJob[] }, void>({
      query: () => "/client-portal/jobs",
      providesTags: ["ClientPortalJobs"],
    }),

    getClientPortalCandidates: builder.query<ClientCandidate[], string>({
      query: (jobId) => `/client-portal/jobs/${jobId}/candidates`,
      providesTags: (_res, _err, jobId) => [{ type: "ClientPortalCandidates", id: jobId }],
    }),

    getClientProfile: builder.query<ClientProfile, void>({
      query: () => "/client-portal/profile",
      providesTags: ["ClientProfile"],
    }),

    submitClientFeedback: builder.mutation<{ message: string }, FeedbackPayload>({
      query: ({ applicationId, ...body }) => ({
        url: `/client-portal/candidates/${applicationId}/feedback`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [
        { type: "ClientPortalCandidates", id: arg.applicationId },
        "ClientPortalJobs",
      ],
    }),

    // Admin endpoints
    listClientUsers: builder.query<
      { id: string; email: string; full_name: string; client_id: string; client_name: string; created_at: string }[],
      void
    >({
      query: () => "/client-portal/admin/users",
      providesTags: ["ClientUsers"],
    }),

    createClientUser: builder.mutation<{ message: string; user_id: string }, ClientUserPayload>({
      query: (body) => ({ url: "/client-portal/admin/users", method: "POST", body }),
      invalidatesTags: ["ClientUsers"],
    }),

    grantJobAccess: builder.mutation<{ message: string }, { jobId: string; client_id: string }>({
      query: ({ jobId, client_id }) => ({
        url: `/client-portal/admin/jobs/${jobId}/grant`,
        method: "POST",
        body: { client_id },
      }),
      invalidatesTags: ["ClientPortalJobs"],
    }),

    revokeJobAccess: builder.mutation<{ message: string }, { jobId: string; client_id: string }>({
      query: ({ jobId, client_id }) => ({
        url: `/client-portal/admin/jobs/${jobId}/revoke`,
        method: "DELETE",
        body: { client_id },
      }),
      invalidatesTags: ["ClientPortalJobs"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetClientPortalJobsQuery,
  useGetClientPortalCandidatesQuery,
  useGetClientProfileQuery,
  useSubmitClientFeedbackMutation,
  useListClientUsersQuery,
  useCreateClientUserMutation,
  useGrantJobAccessMutation,
  useRevokeJobAccessMutation,
} = clientPortalApi;
