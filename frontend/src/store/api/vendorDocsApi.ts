import { baseApi } from "./baseApi";
import type { VendorDocsStatus } from "./vendorApi";

export type VendorDocumentType = "nda" | "service_agreement" | "insurance" | "other";
export type VendorDocumentStatus = "active" | "expired" | "revoked";

/** Labels for the document types the backend accepts (vendor-docs.controller.ts). */
export const VENDOR_DOC_TYPE_LABELS: Record<VendorDocumentType, string> = {
  nda: "NDA",
  service_agreement: "Service agreement",
  insurance: "Insurance",
  other: "Other",
};

/** Documents a vendor needs (active, not expired) before they count as onboarded. */
export const REQUIRED_VENDOR_DOC_TYPES: VendorDocumentType[] = ["nda", "service_agreement"];

/** Backend multer limits (vendors.routes.ts). */
export const VENDOR_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const VENDOR_DOC_EXTENSIONS = ["pdf", "doc", "docx", "png", "jpg", "jpeg"];

export interface VendorDocument {
  id: string;
  vendor_id: string;
  document_type: VendorDocumentType;
  file_name: string;
  file_path: string;
  expiry_date: string | null;
  days_until_expiry: number | null;
  status: VendorDocumentStatus;
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
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }, "Vendors"],
    }),
    deleteVendorDocument: builder.mutation<{ message: string }, { vendorId: string; docId: string }>({
      query: ({ vendorId, docId }) => ({
        url: `/vendors/${vendorId}/documents/${docId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }, "Vendors"],
    }),
    updateVendorDocStatus: builder.mutation<VendorDocument, { vendorId: string; docId: string; status: VendorDocumentStatus }>({
      query: ({ vendorId, docId, status }) => ({
        url: `/vendors/${vendorId}/documents/${docId}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: (_r, _e, { vendorId }) => [{ type: "VendorDocuments" as const, id: vendorId }, "Vendors"],
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

/**
 * Fetches a document file with the user's token and opens it in a new tab.
 * The file endpoint needs the Authorization header, so a plain link can't be used.
 */
export async function openVendorDocument(vendorId: string, docId: string, token: string | null): Promise<void> {
  const base = import.meta.env.VITE_API_URL || "http://localhost:5000/v1";
  const auth = token ?? localStorage.getItem("jwt");
  const resp = await fetch(`${base}/vendors/${vendorId}/documents/${docId}/file`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
  if (!resp.ok) {
    let message = "Could not open this document.";
    try {
      const body = (await resp.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Same rule as the vendor list's docs_status (vendors.controller.ts getVendors):
 * every required type needs an active, unexpired copy; "expired" when a required
 * type only has expired copies.
 */
export function computeDocsStatus(docs: VendorDocument[]): { status: VendorDocsStatus; missing: VendorDocumentType[] } {
  const missing: VendorDocumentType[] = [];
  let anyExpired = false;
  for (const type of REQUIRED_VENDOR_DOC_TYPES) {
    const ofType = docs.filter((d) => d.document_type === type);
    const lapsed = (d: VendorDocument) => d.days_until_expiry !== null && Number(d.days_until_expiry) < 0;
    const valid = ofType.some((d) => d.status === "active" && !lapsed(d));
    if (!valid) {
      missing.push(type);
      if (ofType.some((d) => d.status === "expired" || (d.status === "active" && lapsed(d)))) anyExpired = true;
    }
  }
  return { status: missing.length === 0 ? "onboarded" : anyExpired ? "expired" : "pending", missing };
}
