import { baseApi } from "./baseApi";
import type { Candidate } from "../../types";

export interface SearchFilters {
  location: string;
  experience: string;
  noticePeriod: string;
}

export interface SearchParams extends SearchFilters {
  query: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  candidate: Candidate;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const candidateApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCandidates: builder.query<Candidate[], void>({
      query: () => "/candidates",
      providesTags: ["Candidates"],
    }),

    createCandidate: builder.mutation<Candidate, FormData>({
      query: (body) => ({ url: "/candidates", method: "POST", body }),
      invalidatesTags: ["Candidates"],
    }),

    deleteCandidate: builder.mutation<void, string>({
      query: (id) => ({ url: `/candidates/${id}`, method: "DELETE" }),
      invalidatesTags: ["Candidates"],
    }),

    parseResume: builder.mutation<Partial<Candidate>, FormData>({
      query: (body) => ({ url: "/parse/resume", method: "POST", body }),
    }),

    addCandidateToJob: builder.mutation<
      unknown,
      { jobId: string; body: Partial<Candidate> | FormData }
    >({
      query: ({ jobId, body }) => ({
        url: `/jobs/${jobId}/candidates`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Candidates", "Pipeline"],
    }),

    searchCandidates: builder.query<SearchResponse, SearchParams>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params.query) qs.set("query", params.query);
        if (params.location && params.location !== "All")
          qs.set("location", params.location);
        if (params.experience && params.experience !== "All")
          qs.set("experience", params.experience);
        if (params.noticePeriod && params.noticePeriod !== "Any")
          qs.set("noticePeriod", params.noticePeriod);
        qs.set("page", String(params.page ?? 1));
        qs.set("limit", String(params.limit ?? 10));
        return `/candidates/search?${qs.toString()}`;
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCandidatesQuery,
  useCreateCandidateMutation,
  useDeleteCandidateMutation,
  useParseResumeMutation,
  useAddCandidateToJobMutation,
  useSearchCandidatesQuery,
  useLazySearchCandidatesQuery,
} = candidateApi;
