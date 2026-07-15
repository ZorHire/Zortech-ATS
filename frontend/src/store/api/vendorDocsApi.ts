import { baseApi } from "./baseApi";

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: "nda" | "service_agreement" | "insurance" | "other";
  file_name: string;
  file_path: string;
  expiry_date: string | null;
  days_until_expiry: number | null;
  status: "active" | "expired" | "revoked";
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

export const vendorDocsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendorDocuments: builder.query<VendorDocument[], string>({
      query: (vendorId) => `/vendors/${vendorId}/documents`,
      providesTags: (_r, _e, vendorId) => [{ type: "VendorDocuments" as const, id: vendorId }],
    }),
    uploadVendorDocument: builder.mutation<VendorDocument, { vendorId: string; formData: FormData }>({
      query: ({ vendorId, formData }) => ({
        url: `/vendors/${vendorId}/documents`,
        method: "POST",
        body: formData,
      }),
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }],
    }),
    deleteVendorDocument: builder.mutation<{ message: string }, { vendorId: string; docId: string }>({
      query: ({ vendorId, docId }) => ({
        url: `/vendors/${vendorId}/documents/${docId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }],
    }),
    updateVendorDocStatus: builder.mutation<VendorDocument, { vendorId: string; docId: string; status: string }>({
      query: ({ vendorId, docId, status }) => ({
        url: `/vendors/${vendorId}/documents/${docId}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetVendorDocumentsQuery,
  useUploadVendorDocumentMutation,
  useDeleteVendorDocumentMutation,
  useUpdateVendorDocStatusMutation,
} = vendorDocsApi;
