import { baseApi } from "./baseApi";
import type { EmailCampaign } from "../../types";

export interface CampaignAnalytics {
  delivered: number;
  unique_opens: number;
  total_opens: number;
  unique_clicks: number;
  total_clicks: number;
  unsubscribes: number;
  bounced: number;
  failed: number;
  open_rate: number;
  click_rate: number;
}

export interface CampaignRecipient {
  id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'delivered' | 'bounced' | 'failed';
  delivered_at: string | null;
  bounce_reason: string | null;
  last_opened_at: string | null;
  last_clicked_at: string | null;
  open_count: number;
  click_count: number;
  unsubscribed: boolean;
}

export interface Unsubscribe {
  id: string;
  email: string;
  unsubscribed_at: string;
  campaign_name: string | null;
}

export interface EmailConfig {
  configured: boolean;
  email?: string;
  provider?: string;
  updated_at?: string;
  is_corrupted?: boolean;
}

export interface SendSingleEmailPayload {
  to: string;
  subject?: string;
  body?: string;
  templateType?: string;
  templateData?: Record<string, unknown>;
}

export const emailApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmailConfig: builder.query<EmailConfig, void>({
      query: () => "/email/config",
      providesTags: ["EmailConfig"],
    }),

    saveEmailConfig: builder.mutation<
      EmailConfig,
      { email: string; appPassword: string; provider: string }
    >({
      query: (body) => ({ url: "/email/config", method: "POST", body }),
      invalidatesTags: ["EmailConfig"],
    }),

    deleteEmailConfig: builder.mutation<void, void>({
      query: () => ({ url: "/email/config", method: "DELETE" }),
      invalidatesTags: ["EmailConfig"],
    }),

    testEmailConfig: builder.mutation<{ success: boolean; message?: string }, void>({
      query: () => ({ url: "/email/config/test", method: "POST", body: {} }),
    }),

    getCampaigns: builder.query<EmailCampaign[], void>({
      query: () => "/email-campaigns",
      providesTags: ["EmailCampaigns"],
    }),

    createCampaign: builder.mutation<EmailCampaign, Record<string, unknown>>({
      query: (body) => ({ url: "/email-campaigns", method: "POST", body }),
      invalidatesTags: ["EmailCampaigns"],
    }),

    sendCampaign: builder.mutation<
      void,
      { id: string; recipients: Array<{ email: string; name?: string }>; track_opens?: boolean; track_clicks?: boolean }
    >({
      query: ({ id, recipients, track_opens = true, track_clicks = true }) => ({
        url: `/email-campaigns/${id}/send`,
        method: "POST",
        body: { recipients, track_opens, track_clicks },
      }),
      invalidatesTags: ["EmailCampaigns"],
    }),

    deleteCampaign: builder.mutation<void, string>({
      query: (id) => ({ url: `/email-campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: ["EmailCampaigns"],
    }),

    getCampaignAnalytics: builder.query<
      { campaign: EmailCampaign; analytics: CampaignAnalytics; top_links: { url: string; clicks: number }[] },
      string
    >({
      query: (id) => `/email-campaigns/${id}/analytics`,
      providesTags: (_r, _e, id) => [{ type: "EmailCampaigns", id }],
    }),

    getCampaignRecipients: builder.query<{ recipients: CampaignRecipient[] }, string>({
      query: (id) => `/email-campaigns/${id}/recipients`,
    }),

    listUnsubscribes: builder.query<{ unsubscribes: Unsubscribe[] }, void>({
      query: () => "/email/unsubscribes",
      providesTags: ["EmailUnsubscribes"],
    }),

    removeUnsubscribe: builder.mutation<void, string>({
      query: (email) => ({
        url: `/email/unsubscribes/${encodeURIComponent(email)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["EmailUnsubscribes"],
    }),

    sendSingleEmail: builder.mutation<void, SendSingleEmailPayload>({
      query: (body) => ({ url: "/email/send-single", method: "POST", body }),
    }),

    assignJd: builder.mutation<void, Record<string, unknown>>({
      query: (body) => ({ url: "/email/assign-jd", method: "POST", body }),
    }),

    assignJdRecruiter: builder.mutation<void, Record<string, unknown>>({
      query: (body) => ({ url: "/email/assign-jd-recruiter", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmailConfigQuery,
  useSaveEmailConfigMutation,
  useDeleteEmailConfigMutation,
  useTestEmailConfigMutation,
  useGetCampaignsQuery,
  useCreateCampaignMutation,
  useSendCampaignMutation,
  useDeleteCampaignMutation,
  useSendSingleEmailMutation,
  useAssignJdMutation,
  useAssignJdRecruiterMutation,
  useGetCampaignAnalyticsQuery,
  useGetCampaignRecipientsQuery,
  useListUnsubscribesQuery,
  useRemoveUnsubscribeMutation,
} = emailApi;
