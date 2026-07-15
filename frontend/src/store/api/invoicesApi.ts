import { baseApi } from "./baseApi";

export interface Invoice {
  id: string;
  client_id: string | null;
  client_name: string | null;
  job_id: string | null;
  job_title: string | null;
  candidate_id: string | null;
  candidate_name: string | null;
  application_id: string | null;
  invoice_number: string;
  amount: number | null;
  currency: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoices: builder.query<Invoice[], { status?: string; client_id?: string } | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters?.status) params.set("status", filters.status);
        if (filters?.client_id) params.set("client_id", filters.client_id);
        const qs = params.toString();
        return `/invoices${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Invoices"],
    }),
    getInvoiceById: builder.query<Invoice, string>({
      query: (id) => `/invoices/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Invoice" as const, id }],
    }),
    updateInvoice: builder.mutation<Invoice, { id: string; body: Partial<Pick<Invoice, "status" | "amount" | "due_date" | "notes">> }>({
      query: ({ id, body }) => ({ url: `/invoices/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => ["Invoices", { type: "Invoice" as const, id }],
    }),
    createInvoice: builder.mutation<Invoice, {
      client_id: string;
      job_id?: string;
      candidate_id?: string;
      amount?: number;
      currency?: string;
      due_date?: string;
      notes?: string;
    }>({
      query: (body) => ({ url: "/invoices", method: "POST", body }),
      invalidatesTags: ["Invoices"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetInvoicesQuery,
  useGetInvoiceByIdQuery,
  useUpdateInvoiceMutation,
  useCreateInvoiceMutation,
} = invoicesApi;
