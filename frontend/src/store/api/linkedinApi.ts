import { baseApi } from "./baseApi";
import type {
  CampaignInput,
  FreeBoard,
  LinkedInAccountStatus,
  LinkedInCampaign,
  LinkedInProspect,
  LinkedInSummary,
  RecruiterSearch,
  SearchFilters,
} from "../../types/linkedin";

const ACCOUNT = { type: "LinkedInAccount" as const, id: "ME" };
const CAMPAIGNS = { type: "LinkedInCampaigns" as const, id: "LIST" };
const campaignTags = (id: string) => [CAMPAIGNS, { type: "LinkedInCampaigns" as const, id }, { type: "LinkedInProspects" as const, id }];

export const linkedinApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getLinkedInAccount: b.query<LinkedInAccountStatus, void>({ query: () => "/linkedin-agent/account", providesTags: [ACCOUNT] }),
    updateLinkedInAccount: b.mutation<LinkedInAccountStatus, { recruiter_lite_override?: boolean | null; resume?: boolean }>({
      query: (body) => ({ url: "/linkedin-agent/account", method: "PUT", body }),
      invalidatesTags: [ACCOUNT],
    }),
    createConnectionCode: b.mutation<{ code: string }, void>({
      query: () => ({ url: "/linkedin-agent/connect", method: "POST", body: { label: "Chrome" } }),
      invalidatesTags: [ACCOUNT],
    }),
    revokeConnection: b.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/linkedin-agent/connections/${id}`, method: "DELETE" }),
      invalidatesTags: [ACCOUNT],
    }),
    getLinkedInSummary: b.query<LinkedInSummary, void>({ query: () => "/linkedin-agent/summary", providesTags: [CAMPAIGNS] }),

    getLinkedInCampaigns: b.query<LinkedInCampaign[], { scope?: "mine" | "all" } | void>({
      query: (a) => `/linkedin-agent/campaigns${a?.scope === "all" ? "?scope=all" : ""}`,
      providesTags: [CAMPAIGNS],
    }),
    getLinkedInCampaign: b.query<LinkedInCampaign, string>({
      query: (id) => `/linkedin-agent/campaigns/${id}`,
      providesTags: (_r, _e, id) => [{ type: "LinkedInCampaigns", id }],
    }),
    createLinkedInCampaign: b.mutation<LinkedInCampaign, CampaignInput>({
      query: (body) => ({ url: "/linkedin-agent/campaigns", method: "POST", body }),
      invalidatesTags: [CAMPAIGNS],
    }),
    updateLinkedInCampaign: b.mutation<LinkedInCampaign, { id: string; body: CampaignInput }>({
      query: ({ id, body }) => ({ url: `/linkedin-agent/campaigns/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => campaignTags(id),
    }),
    deleteLinkedInCampaign: b.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/linkedin-agent/campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: [CAMPAIGNS],
    }),
    setLinkedInCampaignStatus: b.mutation<{ ok: true }, { id: string; status: "active" | "paused" | "completed" }>({
      query: ({ id, status }) => ({ url: `/linkedin-agent/campaigns/${id}/status`, method: "POST", body: { status } }),
      invalidatesTags: (_r, _e, { id }) => campaignTags(id),
    }),
    generateLinkedInSearch: b.mutation<
      { search: SearchFilters; recruiter_search: RecruiterSearch; rationale: string; ai: boolean; url: string },
      string
    >({
      query: (id) => ({ url: `/linkedin-agent/campaigns/${id}/generate-search`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => campaignTags(id),
    }),
    requestLinkedInSearch: b.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/linkedin-agent/campaigns/${id}/run-search`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => campaignTags(id),
    }),

    getLinkedInProspects: b.query<LinkedInProspect[], { campaignId: string; status?: string }>({
      query: ({ campaignId, status }) => `/linkedin-agent/campaigns/${campaignId}/prospects${status ? `?status=${status}` : ""}`,
      providesTags: (_r, _e, { campaignId }) => [{ type: "LinkedInProspects", id: campaignId }],
    }),
    updateLinkedInProspect: b.mutation<
      LinkedInProspect,
      { id: string; campaignId: string; note?: string; inmail_subject?: string; action?: "approve" | "skip" | "unskip" }
    >({
      query: ({ id, campaignId: _c, ...body }) => ({ url: `/linkedin-agent/prospects/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { campaignId }) => campaignTags(campaignId),
    }),
    bulkLinkedInProspects: b.mutation<{ updated: number }, { campaignId: string; action: "approve" | "skip"; ids?: string[]; all_above?: number }>({
      query: ({ campaignId, ...body }) => ({ url: `/linkedin-agent/campaigns/${campaignId}/prospects/bulk`, method: "POST", body }),
      invalidatesTags: (_r, _e, { campaignId }) => campaignTags(campaignId),
    }),
    regenerateLinkedInNote: b.mutation<LinkedInProspect, { id: string; campaignId: string }>({
      query: ({ id }) => ({ url: `/linkedin-agent/prospects/${id}/regenerate-note`, method: "POST" }),
      invalidatesTags: (_r, _e, { campaignId }) => [{ type: "LinkedInProspects", id: campaignId }],
    }),
    prospectToCandidate: b.mutation<{ candidate_id: string; created: boolean }, { id: string; campaignId: string }>({
      query: ({ id }) => ({ url: `/linkedin-agent/prospects/${id}/to-candidate`, method: "POST" }),
      invalidatesTags: (_r, _e, { campaignId }) => [{ type: "LinkedInProspects", id: campaignId }, "Candidates", "Pipeline"],
    }),

    getFreeJobBoards: b.query<FreeBoard[], string>({
      query: (jobId) => `/free-job-boards/jobs/${jobId}`,
      providesTags: (_r, _e, jobId) => [{ type: "FreeJobBoards", id: jobId }],
    }),
    requestFreeJobPosts: b.mutation<{ queued: number }, { jobId: string; boards: string[] }>({
      query: ({ jobId, boards }) => ({ url: `/free-job-boards/jobs/${jobId}`, method: "POST", body: { boards } }),
      invalidatesTags: (_r, _e, { jobId }) => [{ type: "FreeJobBoards", id: jobId }],
    }),
    updateFreeJobPost: b.mutation<unknown, { id: string; jobId: string; status: "posted" | "skipped" | "requested"; posting_url?: string }>({
      query: ({ id, jobId: _j, ...body }) => ({ url: `/free-job-boards/posts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { jobId }) => [{ type: "FreeJobBoards", id: jobId }],
    }),
  }),
});

export const {
  useGetLinkedInAccountQuery,
  useUpdateLinkedInAccountMutation,
  useCreateConnectionCodeMutation,
  useRevokeConnectionMutation,
  useGetLinkedInSummaryQuery,
  useGetLinkedInCampaignsQuery,
  useGetLinkedInCampaignQuery,
  useCreateLinkedInCampaignMutation,
  useUpdateLinkedInCampaignMutation,
  useDeleteLinkedInCampaignMutation,
  useSetLinkedInCampaignStatusMutation,
  useGenerateLinkedInSearchMutation,
  useRequestLinkedInSearchMutation,
  useGetLinkedInProspectsQuery,
  useUpdateLinkedInProspectMutation,
  useBulkLinkedInProspectsMutation,
  useRegenerateLinkedInNoteMutation,
  useProspectToCandidateMutation,
  useGetFreeJobBoardsQuery,
  useRequestFreeJobPostsMutation,
  useUpdateFreeJobPostMutation,
} = linkedinApi;
