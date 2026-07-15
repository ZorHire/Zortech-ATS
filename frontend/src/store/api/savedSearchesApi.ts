import { baseApi } from "./baseApi";

export interface SavedSearch {
  id: string;
  name: string;
  query: Record<string, unknown>;
  email_alerts: boolean;
  created_at: string;
}

export const savedSearchesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSavedSearches: builder.query<SavedSearch[], void>({
      query: () => "/saved-searches",
      providesTags: ["SavedSearches"],
    }),
    createSavedSearch: builder.mutation<SavedSearch, { name: string; query: Record<string, unknown>; email_alerts?: boolean }>({
      query: (body) => ({ url: "/saved-searches", method: "POST", body }),
      invalidatesTags: ["SavedSearches"],
    }),
    deleteSavedSearch: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/saved-searches/${id}`, method: "DELETE" }),
      invalidatesTags: ["SavedSearches"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSavedSearchesQuery,
  useCreateSavedSearchMutation,
  useDeleteSavedSearchMutation,
} = savedSearchesApi;
