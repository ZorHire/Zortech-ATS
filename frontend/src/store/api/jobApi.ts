import { baseApi } from "./baseApi";
import type { Job, Client, ParsedJobData } from "../../types";

export const jobApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getJobs: builder.query<Job[], void>({
      query: () => "/jobs",
      providesTags: ["Jobs"],
    }),

    getJob: builder.query<Job, string>({
      query: (id) => `/jobs/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Job", id }],
    }),

    createJob: builder.mutation<Job, Record<string, unknown>>({
      query: (body) => ({ url: "/jobs", method: "POST", body }),
      invalidatesTags: ["Jobs"],
    }),

    updateJob: builder.mutation<Job, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/jobs/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => ["Jobs", { type: "Job", id }],
    }),

    deleteJob: builder.mutation<void, string>({
      query: (id) => ({ url: `/jobs/${id}`, method: "DELETE" }),
      invalidatesTags: ["Jobs"],
    }),

    parseJd: builder.mutation<ParsedJobData, FormData>({
      query: (body) => ({ url: "/parse/jd", method: "POST", body }),
    }),

    getClients: builder.query<Client[], void>({
      query: () => "/clients",
      providesTags: ["Clients"],
    }),

    createClient: builder.mutation<Client, Record<string, unknown>>({
      query: (body) => ({ url: "/clients", method: "POST", body }),
      invalidatesTags: ["Clients"],
    }),

    updateClient: builder.mutation<Client, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/clients/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => ["Clients", { type: "Client" as const, id }],
    }),

    deleteClient: builder.mutation<void, string>({
      query: (id) => ({ url: `/clients/${id}`, method: "DELETE" }),
      invalidatesTags: ["Clients"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetJobsQuery,
  useGetJobQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useParseJdMutation,
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} = jobApi;
