import { baseApi } from "./baseApi";

export type WhatsAppMode = "click" | "api";

export interface MyWhatsApp {
  number: null | { phone_e164: string; mode: WhatsAppMode; phone_number_id: string | null; updated_at?: string };
  company_api: boolean;
}
export interface CompanyWhatsApp {
  connected: boolean;
  waba_id?: string;
  template_name?: string | null;
  template_lang?: string;
  verify_token?: string;
  webhook_url: string;
  needs_reconnect?: boolean;
  numbers?: { id: string; number: string; name: string; quality?: string }[];
}
export interface WhatsAppMessage {
  id: string;
  direction: "in" | "out";
  mode: WhatsAppMode;
  body: string;
  template: string | null;
  status: "prepared" | "sent" | "delivered" | "read" | "failed" | "received";
  error: string | null;
  from_number: string | null;
  to_number: string | null;
  created_at: string;
  sender_name: string | null;
}
export interface WhatsAppThread {
  messages: WhatsAppMessage[];
  candidate_phone: string | null;
  session_open: boolean;
}

const ME = { type: "WhatsApp" as const, id: "ME" };
const COMPANY = { type: "WhatsApp" as const, id: "COMPANY" };
const thread = (id: string) => ({ type: "WhatsApp" as const, id: `thread-${id}` });

export const whatsappApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getMyWhatsApp: b.query<MyWhatsApp, void>({ query: () => "/whatsapp/me", providesTags: [ME] }),
    saveMyWhatsApp: b.mutation<MyWhatsApp, { phone: string; mode: WhatsAppMode }>({
      query: (body) => ({ url: "/whatsapp/me", method: "PUT", body }),
      invalidatesTags: [ME],
    }),
    removeMyWhatsApp: b.mutation<{ ok: true }, void>({ query: () => ({ url: "/whatsapp/me", method: "DELETE" }), invalidatesTags: [ME] }),
    getCompanyWhatsApp: b.query<CompanyWhatsApp, void>({ query: () => "/whatsapp/company", providesTags: [COMPANY] }),
    saveCompanyWhatsApp: b.mutation<CompanyWhatsApp, { waba_id: string; access_token?: string; app_secret?: string; template_name?: string; template_lang?: string }>({
      query: (body) => ({ url: "/whatsapp/company", method: "PUT", body }),
      invalidatesTags: [COMPANY, ME],
    }),
    removeCompanyWhatsApp: b.mutation<{ ok: true }, void>({ query: () => ({ url: "/whatsapp/company", method: "DELETE" }), invalidatesTags: [COMPANY, ME] }),
    getWhatsAppThread: b.query<WhatsAppThread, string>({ query: (candidateId) => `/whatsapp/candidates/${candidateId}/messages`, providesTags: (_r, _e, id) => [thread(id)] }),
    sendWhatsApp: b.mutation<{ mode: WhatsAppMode; id: string; url?: string; template?: string | null }, { candidateId: string; text: string }>({
      query: ({ candidateId, text }) => ({ url: `/whatsapp/candidates/${candidateId}/messages`, method: "POST", body: { text } }),
      invalidatesTags: (_r, _e, { candidateId }) => [thread(candidateId)],
    }),
    confirmWhatsAppSent: b.mutation<{ ok: boolean }, { id: string; candidateId: string }>({
      query: ({ id }) => ({ url: `/whatsapp/messages/${id}/sent`, method: "POST" }),
      invalidatesTags: (_r, _e, { candidateId }) => [thread(candidateId)],
    }),
  }),
});

export const {
  useGetMyWhatsAppQuery,
  useSaveMyWhatsAppMutation,
  useRemoveMyWhatsAppMutation,
  useGetCompanyWhatsAppQuery,
  useSaveCompanyWhatsAppMutation,
  useRemoveCompanyWhatsAppMutation,
  useGetWhatsAppThreadQuery,
  useSendWhatsAppMutation,
  useConfirmWhatsAppSentMutation,
} = whatsappApi;
