import { baseApi } from "./baseApi";

export interface Interview {
  id: string;
  application_id: string;
  interview_type: "phone" | "video" | "face_to_face";
  scheduled_at: string;
  duration_minutes: number;
  interviewer_name: string | null;
  interviewer_email: string | null;
  meeting_link: string | null;
  feedback_score: number | null;
  feedback_notes: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  created_at: string;
  // Joined fields (from listInterviews)
  candidate_id?: string;
  first_name?: string;
  last_name?: string;
  candidate_email?: string;
  job_id?: string;
  job_title?: string;
  current_stage?: string;
}

export interface InterviewFilters {
  status?: string;
  from?: string;
  to?: string;
  job_id?: string;
}

export const interviewApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInterviews: builder.query<Interview[], InterviewFilters | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters?.status) params.set("status", filters.status);
        if (filters?.from) params.set("from", filters.from);
        if (filters?.to) params.set("to", filters.to);
        if (filters?.job_id) params.set("job_id", filters.job_id);
        const qs = params.toString();
        return `/interviews${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Interviews"],
    }),

    updateInterview: builder.mutation<
      Interview,
      { id: string; body: { status?: string; feedback_score?: number; feedback_notes?: string } }
    >({
      query: ({ id, body }) => ({ url: `/interviews/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Interviews"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInterviewsQuery,
  useUpdateInterviewMutation,
} = interviewApi;
