import { baseApi } from "./baseApi";

export interface OfferRecord {
  application_id: string;
  stage: "offer_extended" | "offer_accepted" | "offer_rejected";
  stage_updated_at: string;
  applied_at: string;
  notes: string | null;
  candidate_id: string;
  first_name: string;
  last_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  current_title: string | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  job_id: string;
  job_title: string;
  job_location: string | null;
  employment_type: string;
  client_id: string | null;
  client_name: string | null;
}

export interface PlacementRecord {
  application_id: string;
  stage: "offer_accepted" | "joined";
  placement_date: string;
  applied_at: string;
  candidate_id: string;
  first_name: string;
  last_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  current_title: string | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  job_id: string;
  job_title: string;
  job_location: string | null;
  employment_type: string;
  client_id: string | null;
  client_name: string | null;
}

export interface OfferStats {
  pending: number;
  accepted: number;
  declined: number;
  placements: number;
}

export interface OfferFilters {
  stage?: string;
  job_id?: string;
  from?: string;
  to?: string;
}

export const offersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOfferStats: builder.query<OfferStats, void>({
      query: () => "/offers/stats",
      providesTags: ["Offers"],
    }),
    getOffers: builder.query<OfferRecord[], OfferFilters | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters?.stage) params.set("stage", filters.stage);
        if (filters?.job_id) params.set("job_id", filters.job_id);
        if (filters?.from) params.set("from", filters.from);
        if (filters?.to) params.set("to", filters.to);
        const qs = params.toString();
        return `/offers${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Offers"],
    }),
    getPlacements: builder.query<PlacementRecord[], { job_id?: string; from?: string; to?: string } | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters?.job_id) params.set("job_id", filters.job_id);
        if (filters?.from) params.set("from", filters.from);
        if (filters?.to) params.set("to", filters.to);
        const qs = params.toString();
        return `/offers/placements${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Offers"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOfferStatsQuery,
  useGetOffersQuery,
  useGetPlacementsQuery,
} = offersApi;
