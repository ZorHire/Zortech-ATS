import { baseApi } from "./baseApi";

export interface JobVersion {
  id: string;
  job_id: string;
  version_number: number;
  snapshot: Record<string, any>;
  changed_by: string | null;
  changed_by_name: string | null;
  change_note: string | null;
  created_at: string;
}

export const jdVersionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJobVersions: builder.query<JobVersion[], string>({
      query: (jobId) => `/jobs/${jobId}/versions`,
      providesTags: (_r, _e, jobId) => [{ type: "JobVersions" as const, id: jobId }],
    }),
    rollbackJobVersion: builder.mutation<{ message: string }, { jobId: string; versionId: string }>({
      query: ({ jobId, versionId }) => ({
        url: `/jobs/${jobId}/versions/${versionId}/rollback`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { jobId }) => ["Jobs", { type: "JobVersions" as const, id: jobId }],
    }),
    submitForApproval: builder.mutation<{ id: string; approval_status: string }, string>({
      query: (id) => ({ url: `/jobs/${id}/submit-for-approval`, method: "POST" }),
      invalidatesTags: ["Jobs"],
    }),
    approveJob: builder.mutation<{ id: string; approval_status: string }, { id: string; notes?: string }>({
      query: ({ id, notes }) => ({ url: `/jobs/${id}/approve`, method: "POST", body: { notes } }),
      invalidatesTags: ["Jobs"],
    }),
    rejectJob: builder.mutation<{ id: string; approval_status: string }, { id: string; notes: string }>({
      query: ({ id, notes }) => ({ url: `/jobs/${id}/reject`, method: "POST", body: { notes } }),
      invalidatesTags: ["Jobs"],
    }),
    getPendingApprovals: builder.query<any[], void>({
      query: () => "/jobs/pending-approval",
      providesTags: ["Jobs"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetJobVersionsQuery,
  useRollbackJobVersionMutation,
  useSubmitForApprovalMutation,
  useApproveJobMutation,
  useRejectJobMutation,
  useGetPendingApprovalsQuery,
} = jdVersionsApi;
