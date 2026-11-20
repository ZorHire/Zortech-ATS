import { baseApi } from "./baseApi";

export type SkillLevel = "strong" | "some" | "not_shown";

export interface PackContent {
  headline: string;
  summary: string[];
  skills_match: { skill: string; level: SkillLevel; evidence: string }[];
  experience: { title: string; company: string; period: string; highlights: string[] }[];
  education: { qualification: string; institution: string; year: string }[];
  certifications: string[];
  recruiter_note: string;
}

export interface SubmissionView {
  application_id: string;
  stage: string;
  job: { id: string; title: string; location: string | null; work_mode: string | null; mandatory_skills: string[]; preferred_skills: string[] };
  client: { name: string | null; contact_name: string | null; contact_email: string | null };
  company: { name: string; is_platform_owner: boolean };
  facts: {
    candidate_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    current_title: string | null;
    current_company: string | null;
    experience_years: number | null;
    current_location: string | null;
    preferred_location: string | null;
    notice_period_days: number | null;
    current_ctc: number | null;
    expected_ctc: number | null;
    has_resume: boolean;
  };
  pack: null | {
    content: PackContent;
    hide_contacts: boolean;
    show_ctc: boolean;
    ai_generated: boolean;
    edited: boolean;
    generated_at: string | null;
    sent_at: string | null;
    sent_to: string | null;
    updated_at: string;
  };
  ai?: boolean;
  used_resume?: boolean;
}

export interface SendSubmissionBody {
  to: string[];
  cc?: string[];
  subject?: string;
  message?: string;
  attach_resume?: boolean;
  mark_submitted?: boolean;
}

const tag = (id: string) => [{ type: "Submission" as const, id }];

export const submissionsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getSubmission: b.query<SubmissionView, string>({ query: (id) => `/submissions/applications/${id}`, providesTags: (_r, _e, id) => tag(id) }),
    generateSubmission: b.mutation<SubmissionView, string>({
      query: (id) => ({ url: `/submissions/applications/${id}/generate`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [...tag(id), "AiUsage"],
    }),
    saveSubmission: b.mutation<SubmissionView, { id: string; content?: PackContent; hide_contacts?: boolean; show_ctc?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/submissions/applications/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => tag(id),
    }),
    sendSubmission: b.mutation<{ sent: true; moved_to_submitted: boolean; from: string }, { id: string; body: SendSubmissionBody }>({
      query: ({ id, body }) => ({ url: `/submissions/applications/${id}/send`, method: "POST", body }),
      invalidatesTags: (_r, _e, { id }) => [...tag(id), "Pipeline"],
    }),
  }),
});

export const { useGetSubmissionQuery, useGenerateSubmissionMutation, useSaveSubmissionMutation, useSendSubmissionMutation } = submissionsApi;
