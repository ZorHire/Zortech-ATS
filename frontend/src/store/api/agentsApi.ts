import { baseApi } from "./baseApi";
import type {
  AgentEvent,
  AgentName,
  AgentSummary,
  ApplicationInsights,
  AutopilotSettings,
} from "../../types/agents";

export interface AgentActivityArgs {
  jobId?: string;
  applicationId?: string;
  limit?: number;
}

// Tag ids: the summary lives under AgentActivity/SUMMARY so anything that changes
// activity (run, pause, settings) also refreshes the counters.
const ACTIVITY_LIST = { type: "AgentActivity" as const, id: "LIST" };
const SUMMARY = { type: "AgentActivity" as const, id: "SUMMARY" };

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAutopilot: builder.query<AutopilotSettings, string>({
      query: (jobId) => `/agents/jobs/${jobId}/autopilot`,
      providesTags: (_r, _e, jobId) => [{ type: "Autopilot", id: jobId }],
    }),

    updateAutopilot: builder.mutation<AutopilotSettings, { jobId: string; body: Partial<AutopilotSettings> }>({
      query: ({ jobId, body }) => ({ url: `/agents/jobs/${jobId}/autopilot`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { jobId }) => [{ type: "Autopilot", id: jobId }, SUMMARY, ACTIVITY_LIST],
    }),

    getAgentActivity: builder.query<AgentEvent[], AgentActivityArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.jobId) params.set("jobId", args.jobId);
        if (args?.applicationId) params.set("applicationId", args.applicationId);
        params.set("limit", String(args?.limit ?? 50));
        return `/agents/activity?${params.toString()}`;
      },
      providesTags: [ACTIVITY_LIST],
    }),

    getAgentSummary: builder.query<AgentSummary, void>({
      query: () => "/agents/summary",
      providesTags: [SUMMARY],
    }),

    pauseAllAgents: builder.mutation<{ paused: number }, void>({
      query: () => ({ url: "/agents/pause-all", method: "POST" }),
      invalidatesTags: ["Autopilot", "AgentActivity", "AgentInsights"],
    }),

    runAgent: builder.mutation<{ queued: true }, { applicationId: string; agent: AgentName }>({
      query: ({ applicationId, agent }) => ({
        url: `/agents/applications/${applicationId}/run`,
        method: "POST",
        body: { agent },
      }),
      invalidatesTags: (_r, _e, { applicationId }) => [
        ACTIVITY_LIST,
        SUMMARY,
        { type: "AgentInsights", id: applicationId },
      ],
    }),

    getApplicationInsights: builder.query<ApplicationInsights, string>({
      query: (applicationId) => `/agents/applications/${applicationId}/insights`,
      providesTags: (_r, _e, applicationId) => [{ type: "AgentInsights", id: applicationId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAutopilotQuery,
  useUpdateAutopilotMutation,
  useGetAgentActivityQuery,
  useGetAgentSummaryQuery,
  usePauseAllAgentsMutation,
  useRunAgentMutation,
  useGetApplicationInsightsQuery,
} = agentsApi;
