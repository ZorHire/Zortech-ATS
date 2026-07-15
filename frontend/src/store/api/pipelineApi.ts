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
      { applicationId: string; stage: PipelineStage; note?: string }
    >({
      query: ({ applicationId, stage, note }) => ({
        url: `/pipeline/applications/${applicationId}/stage`,
        method: "PATCH",
        body: { to_stage: stage, note },
      }),
      invalidatesTags: ["Pipeline"],
    }),

    addToPipeline: builder.mutation<void, { candidateId: string; jobId: string }>({
      query: (body) => ({ url: "/pipeline/add", method: "POST", body }),
      invalidatesTags: ["Pipeline"],
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
      invalidatesTags: ["Pipeline"],
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
