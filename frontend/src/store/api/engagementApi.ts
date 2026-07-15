import { baseApi } from "./baseApi";

export interface PipelineEventRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  note: string | null;
  created_at: string;
  job_title: string;
  changed_by_email: string | null;
}

export interface InterviewRow {
  id: string;
  interview_type: string;
  scheduled_at: string;
  status: string;
  interviewer_name: string | null;
  feedback_score: number | null;
  feedback_locked: boolean;
  job_title: string;
}

export interface ManualLog {
  id: string;
  event_type: "call_logged" | "note" | "email_sent";
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
}

export interface CandidateEngagement {
  pipeline_events: PipelineEventRow[];
  interviews: InterviewRow[];
  manual_logs: ManualLog[];
}

const engagementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCandidateEngagement: builder.query<CandidateEngagement, string>({
      query: (candidateId) => `/candidates/${candidateId}/engagement`,
      providesTags: (_r, _e, id) => [{ type: "Candidate" as const, id: `engagement-${id}` }],
    }),

    logEngagement: builder.mutation<
      ManualLog,
      { candidateId: string; event_type: "call_logged" | "note" | "email_sent"; summary: string; meta?: Record<string, unknown> }
    >({
      query: ({ candidateId, ...body }) => ({
        url: `/candidates/${candidateId}/engagement`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, { candidateId }) => [{ type: "Candidate" as const, id: `engagement-${candidateId}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCandidateEngagementQuery,
  useLogEngagementMutation,
} = engagementApi;
