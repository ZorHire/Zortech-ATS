import { baseApi } from "./baseApi";

export interface DeletionRequest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  deletion_requested_at: string;
}

export const gdprApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateGdprConsent: builder.mutation<{ id: string; gdpr_consent: boolean }, { id: string; consent: boolean }>({
      query: ({ id, consent }) => ({
        url: `/candidates/${id}/gdpr-consent`,
        method: "PATCH",
        body: { consent },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Candidates" as const, id }],
    }),
    requestCandidateDeletion: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/candidates/${id}/request-deletion`, method: "POST" }),
      invalidatesTags: ["Candidates"],
    }),
    anonymizeCandidate: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/candidates/${id}/anonymize`, method: "POST" }),
      invalidatesTags: ["Candidates"],
    }),
    getDeletionRequests: builder.query<DeletionRequest[], void>({
      query: () => "/candidates/deletion-requests",
      providesTags: ["Candidates"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useUpdateGdprConsentMutation,
  useRequestCandidateDeletionMutation,
  useAnonymizeCandidateMutation,
  useGetDeletionRequestsQuery,
} = gdprApi;
