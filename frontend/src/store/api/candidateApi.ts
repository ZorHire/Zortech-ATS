import { baseApi } from "./baseApi";
import type { Candidate, ParsedResumeData } from "../../types";

export interface InterviewEntry {
  id: string;
  type: string;
  scheduled_at: string;
  status: string;
  interviewer_name?: string;
  duration_minutes?: number;
}

export interface ApplicationEntry {
  id: string;
  stage: string;
  notes?: string;
  ai_score?: number;
  created_at: string;
  updated_at: string;
  job_id: string;
  job_title: string;
  job_location?: string;
  interviews: InterviewEntry[];
}

export interface SearchFilters {
  location: string;
  experience: string;
  noticePeriod: string;
  /** Candidate must have every skill (case-insensitive substring match). */
  skills?: string[];
  /** Current title contains this text. */
  role?: string;
  /** Exact source key, e.g. "linkedin". "All"/empty = no filter. */
  source?: string;
}

export type SearchSort = "relevance" | "recent" | "experience";

export interface SearchParams extends SearchFilters {
  query: string;
  sort?: SearchSort;
  page?: number;
  limit?: number;
}

/**
 * Query string shared by /candidates/search and /candidates/export so an
 * export always matches what is on screen. Paging params are added separately.
 */
export function buildSearchQueryString(params: Omit<SearchParams, "page" | "limit">): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.query?.trim()) qs.set("query", params.query.trim());
  if (params.location && params.location !== "All") qs.set("location", params.location);
  if (params.experience && params.experience !== "All") qs.set("experience", params.experience);
  if (params.noticePeriod && params.noticePeriod !== "Any") qs.set("noticePeriod", params.noticePeriod);
  if (params.skills && params.skills.length > 0) qs.set("skills", params.skills.join(","));
  if (params.role?.trim()) qs.set("role", params.role.trim());
  if (params.source && params.source !== "All") qs.set("source", params.source.toLowerCase());
  if (params.sort && params.sort !== "relevance") qs.set("sort", params.sort);
  return qs;
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

    getCandidateById: builder.query<Candidate, string>({
      query: (id) => `/candidates/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Candidate", id }],
    }),

    getCandidateTimeline: builder.query<ApplicationEntry[], string>({
      query: (id) => `/candidates/${id}/pipeline`,
      providesTags: (_result, _err, id) => [{ type: "Candidate", id }],
    }),

    createCandidate: builder.mutation<Candidate, FormData>({
      query: (body) => ({ url: "/candidates", method: "POST", body }),
      invalidatesTags: ["Candidates", "Dashboard"],
    }),

    deleteCandidate: builder.mutation<void, string>({
      query: (id) => ({ url: `/candidates/${id}`, method: "DELETE" }),
      invalidatesTags: ["Candidates", "Pipeline", "Dashboard"],
    }),

    parseResume: builder.mutation<Partial<Candidate> & ParsedResumeData, FormData>({
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
      invalidatesTags: ["Candidates", "Pipeline", "Dashboard"],
    }),

    searchCandidates: builder.query<SearchResponse, SearchParams>({
      query: (params) => {
        const qs = buildSearchQueryString(params);
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
  useGetCandidateByIdQuery,
  useGetCandidateTimelineQuery,
  useCreateCandidateMutation,
  useDeleteCandidateMutation,
  useParseResumeMutation,
  useAddCandidateToJobMutation,
  useSearchCandidatesQuery,
  useLazySearchCandidatesQuery,
} = candidateApi;
