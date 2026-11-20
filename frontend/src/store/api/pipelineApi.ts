import { baseApi } from "./baseApi";
import type { JobApplication, PipelineStage } from "../../types";

export const pipelineApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPipelineApplications: builder.query<JobApplication[], string>({
      query: (jobId) => `/pipeline/jobs/${jobId}/applications`,
      providesTags: (_r, _e, jobId) => [{ type: "Pipeline", id: jobId }],
    }),

    updateApplicationStage: builder.mutation<
      void,
      {
        applicationId: string;
        stage: PipelineStage;
        note?: string;
        /** Stored on the application when moving to "disqualified" / "offer_rejected". */
        rejectionReason?: string;
      }
    >({
      query: ({ applicationId, stage, note, rejectionReason }) => ({
        url: `/pipeline/applications/${applicationId}/stage`,
        method: "PATCH",
        body: { to_stage: stage, note, rejection_reason: rejectionReason },
      }),
      invalidatesTags: ["Pipeline", "Dashboard", "Candidates", "Candidate"],
    }),

    addToPipeline: builder.mutation<void, { candidateId: string; jobId: string }>({
      query: (body) => ({ url: "/pipeline/add", method: "POST", body }),
      invalidatesTags: ["Pipeline", "Dashboard", "Candidates", "Candidate"],
    }),

    addApplicationToJob: builder.mutation<
      void,
      { jobId: string; candidateId: string; stage: PipelineStage }
    >({
      query: ({ jobId, candidateId, stage }) => ({
        url: `/pipeline/jobs/${jobId}/applications`,
        method: "POST",
        body: { candidate_id: candidateId, stage },
      }),
      // "Job" too: the job header shows the pipeline count.
      invalidatesTags: ["Pipeline", "Dashboard", "Candidates", "Candidate", "Job"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPipelineApplicationsQuery,
  useUpdateApplicationStageMutation,
  useAddToPipelineMutation,
  useAddApplicationToJobMutation,
} = pipelineApi;
