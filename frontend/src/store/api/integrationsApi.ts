import { baseApi } from "./baseApi";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CalendarStatus {
  google: boolean;
  outlook: boolean;
}

export interface SchedulingLink {
  id: string;
  interview_id: string | null;
  candidate_email: string | null;
  booking_url: string;
  status: "pending" | "booked" | "cancelled";
  invitation_sent_at: string | null;
  booked_at: string | null;
  invitee_email: string | null;
  invitee_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
  scheduling_url: string;
}

export interface CalendlyStatus {
  connected: boolean;
  email?: string;
  name?: string;
}

export interface SMSLog {
  id: string;
  to_number: string;
  message: string;
  provider: string;
  external_id: string | null;
  status: string;
  sent_at: string;
}

export interface ExternalCandidate {
  id: string;
  name: string;
  currentDesignation: string;
  totalExperience: number;
  currentSalary: string;
  location: string;
  skills: string[];
  lastActive: string;
  resumeAge: string;
}

export interface ExternalSearchResult {
  total: number;
  candidates: ExternalCandidate[];
}

export interface JobBoardPosting {
  board_name: string;
  external_job_id: string | null;
  posted_at: string;
  closed_at: string | null;
  status: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const integrationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Calendar
    getCalendarStatus: builder.query<CalendarStatus, void>({
      query: () => "/integrations/calendar/status",
      providesTags: ["Integrations"],
    }),
    disconnectCalendar: builder.mutation<{ message: string }, "google_calendar" | "outlook_calendar">({
      query: (provider) => ({ url: `/integrations/calendar/${provider}`, method: "DELETE" }),
      invalidatesTags: ["Integrations"],
    }),
    createInterviewCalendarEvent: builder.mutation<{ message: string; calendarEventId: string }, { interviewId: string; provider?: string }>({
      query: ({ interviewId, provider = "google_calendar" }) => ({
        url: `/integrations/calendar/interviews/${interviewId}/event`,
        method: "POST",
        body: { provider },
      }),
    }),

    // Calendly scheduling
    getCalendlyStatus: builder.query<CalendlyStatus, void>({
      query: () => "/integrations/scheduling/status",
      providesTags: ["Integrations"],
    }),
    listCalendlyEventTypes: builder.query<CalendlyEventType[], void>({
      query: () => "/integrations/scheduling/event-types",
    }),
    createSchedulingLink: builder.mutation<{ bookingUrl: string; link: SchedulingLink }, { interviewId?: string; eventTypeUri: string; candidateEmail?: string }>({
      query: (body) => ({ url: "/integrations/scheduling/links", method: "POST", body }),
      invalidatesTags: ["SchedulingLinks"],
    }),
    listSchedulingLinks: builder.query<SchedulingLink[], { interviewId?: string }>({
      query: ({ interviewId } = {}) => `/integrations/scheduling/links${interviewId ? `?interviewId=${interviewId}` : ""}`,
      providesTags: ["SchedulingLinks"],
    }),
    sendSchedulingLink: builder.mutation<{ message: string }, string>({
      query: (linkId) => ({ url: `/integrations/scheduling/links/${linkId}/send`, method: "POST" }),
    }),

    // SMS / WhatsApp
    sendSMS: builder.mutation<{ message: string; sid: string }, { to: string; message: string; via?: "sms" | "whatsapp" }>({
      query: (body) => ({ url: "/integrations/sms/send", method: "POST", body }),
    }),
    sendInterviewReminder: builder.mutation<{ message: string; sid: string }, { interviewId: string; via?: "sms" | "whatsapp" }>({
      query: (body) => ({ url: "/integrations/sms/interview-reminder", method: "POST", body }),
    }),
    sendOfferNotification: builder.mutation<{ message: string; sid: string }, { offerId: string; via?: "sms" | "whatsapp" }>({
      query: (body) => ({ url: "/integrations/sms/offer-notification", method: "POST", body }),
    }),
    getSMSLogs: builder.query<SMSLog[], { limit?: number; offset?: number }>({
      query: ({ limit = 50, offset = 0 } = {}) => `/integrations/sms/logs?limit=${limit}&offset=${offset}`,
    }),

    // External resume DB
    searchExternalResumes: builder.query<ExternalSearchResult, { q: string; location?: string; minExp?: number; maxExp?: number; page?: number; source?: string }>({
      query: ({ q, location, minExp, maxExp, page = 1, source = "naukri" }) => {
        const params = new URLSearchParams({ q, page: String(page), source });
        if (location) params.set("location", location);
        if (minExp !== undefined) params.set("minExp", String(minExp));
        if (maxExp !== undefined) params.set("maxExp", String(maxExp));
        return `/integrations/resume-db/search?${params}`;
      },
    }),
    getExternalResumeDetails: builder.query<any, { candidateId: string; source?: string }>({
      query: ({ candidateId, source = "naukri" }) => `/integrations/resume-db/${candidateId}?source=${source}`,
    }),
    importExternalCandidate: builder.mutation<{ message: string; candidateId: string }, { candidateId: string; source?: string }>({
      query: (body) => ({ url: "/integrations/resume-db/import", method: "POST", body }),
      invalidatesTags: ["Candidates"],
    }),

    // LinkedIn / Naukri job board postings
    getJobBoardPostings: builder.query<JobBoardPosting[], string>({
      query: (jobId) => `/integrations/job-boards/jobs/${jobId}/postings`,
      providesTags: ["JobBoardPostings"],
    }),
    postJobToLinkedIn: builder.mutation<{ message: string; externalId: string }, { jobId: string; organizationId?: string }>({
      query: ({ jobId, ...body }) => ({ url: `/integrations/job-boards/linkedin/jobs/${jobId}`, method: "POST", body }),
      invalidatesTags: ["JobBoardPostings"],
    }),
    removeLinkedInJob: builder.mutation<{ message: string }, string>({
      query: (jobId) => ({ url: `/integrations/job-boards/linkedin/jobs/${jobId}`, method: "DELETE" }),
      invalidatesTags: ["JobBoardPostings"],
    }),
    postJobToNaukri: builder.mutation<{ message: string; externalId: string }, string>({
      query: (jobId) => ({ url: `/integrations/job-boards/naukri/jobs/${jobId}`, method: "POST" }),
      invalidatesTags: ["JobBoardPostings"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCalendarStatusQuery,
  useDisconnectCalendarMutation,
  useCreateInterviewCalendarEventMutation,
  useGetCalendlyStatusQuery,
  useListCalendlyEventTypesQuery,
  useCreateSchedulingLinkMutation,
  useListSchedulingLinksQuery,
  useSendSchedulingLinkMutation,
  useSendSMSMutation,
  useSendInterviewReminderMutation,
  useSendOfferNotificationMutation,
  useGetSMSLogsQuery,
  useSearchExternalResumesQuery,
  useGetExternalResumeDetailsQuery,
  useImportExternalCandidateMutation,
  useGetJobBoardPostingsQuery,
  usePostJobToLinkedInMutation,
  useRemoveLinkedInJobMutation,
  usePostJobToNaukriMutation,
} = integrationsApi;
