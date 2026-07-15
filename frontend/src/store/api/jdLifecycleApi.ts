import { baseApi } from "./baseApi";

export interface JobApproval {
  id: string;
  job_id: string;
  tenant_id: string;
  submitted_by: string | null;
  submitter_name: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  version_num: number | null;
}

export interface JobVersion {
  id: string;
  version_num: number;
  created_at: string;
  submitted_by_name: string | null;
  title: string | null;
  status: string | null;
}

export interface PendingApprovalItem {
  approval_id: string;
  job_id: string;
  title: string;
  priority: string;
  status: string;
  client_name: string;
  submitter_name: string | null;
  submitted_at: string;
  version_num: number | null;
}

export const jdLifecycleApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJobApproval: builder.query<JobApproval | null, string>({
      query: (jobId) => `/jd-lifecycle/jobs/${jobId}/approval`,
      providesTags: (_r, _e, jobId) => [{ type: "JobApproval", id: jobId }],
    }),

    getJobVersions: builder.query<JobVersion[], string>({
      query: (jobId) => `/jd-lifecycle/jobs/${jobId}/versions`,
      providesTags: (_r, _e, jobId) => [{ type: "JobVersions", id: jobId }],
    }),

    getPendingApprovals: builder.query<PendingApprovalItem[], void>({
      query: () => "/jd-lifecycle/pending",
      providesTags: ["PendingApprovals"],
    }),

    submitForReview: builder.mutation<{ message: string; approval: JobApproval; version_num: number }, string>({
      query: (jobId) => ({ url: `/jd-lifecycle/jobs/${jobId}/submit-for-review`, method: "POST" }),
      invalidatesTags: (_r, _e, jobId) => [
        { type: "JobApproval", id: jobId },
        { type: "JobVersions", id: jobId },
        { type: "Job", id: jobId },
        "Jobs",
        "PendingApprovals",
      ],
    }),

    approveJob: builder.mutation<{ message: string; approval: JobApproval }, { jobId: string; notes?: string }>({
      query: ({ jobId, notes }) => ({
        url: `/jd-lifecycle/jobs/${jobId}/approve`,
        method: "POST",
        body: { notes },
      }),
      invalidatesTags: (_r, _e, { jobId }) => [
        { type: "JobApproval", id: jobId },
        { type: "Job", id: jobId },
        "Jobs",
        "PendingApprovals",
      ],
    }),

    rejectJob: builder.mutation<{ message: string; approval: JobApproval }, { jobId: string; notes?: string }>({
      query: ({ jobId, notes }) => ({
        url: `/jd-lifecycle/jobs/${jobId}/reject`,
        method: "POST",
        body: { notes },
      }),
      invalidatesTags: (_r, _e, { jobId }) => [
        { type: "JobApproval", id: jobId },
        { type: "Job", id: jobId },
        "Jobs",
        "PendingApprovals",
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetJobApprovalQuery,
  useGetJobVersionsQuery,
  useGetPendingApprovalsQuery,
  useSubmitForReviewMutation,
  useApproveJobMutation,
  useRejectJobMutation,
} = jdLifecycleApi;
