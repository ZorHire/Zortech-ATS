import { baseApi } from "./baseApi";
import type { Vendor } from "../../types";

export const vendorApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendors: builder.query<Vendor[], void>({
      query: () => "/vendors",
      providesTags: ["Vendors"],
    }),

    createVendor: builder.mutation<Vendor, Record<string, unknown>>({
      query: (body) => ({ url: "/vendors", method: "POST", body }),
      invalidatesTags: ["Vendors"],
    }),

    deleteVendor: builder.mutation<void, string>({
      query: (id) => ({ url: `/vendors/${id}`, method: "DELETE" }),
      invalidatesTags: ["Vendors"],
    }),

    parseVendor: builder.mutation<Record<string, unknown>, FormData>({
      query: (body) => ({ url: "/parse/vendor", method: "POST", body }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetVendorsQuery,
  useCreateVendorMutation,
  useDeleteVendorMutation,
  useParseVendorMutation,
} = vendorApi;
