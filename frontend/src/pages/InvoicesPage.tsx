import { useState } from "react";
import {
  FileText,
  Search,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  Building,
  User,
  Plus,
} from "lucide-react";
import Header from "../components/layout/Header";
import {
  useGetInvoicesQuery,
  useUpdateInvoiceMutation,
  useCreateInvoiceMutation,
  type Invoice,
} from "../store/api/invoicesApi";
import { useGetClientsQuery } from "../store/api/jobApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";

const STATUS_OPTIONS = ["all", "draft", "sent", "paid", "cancelled"] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-100",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-500 border-red-100",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Clock size={11} />,
  sent: <AlertCircle size={11} />,
  paid: <CheckCircle2 size={11} />,
  cancelled: <XCircle size={11} />,
};

const NEXT_STATUS: Record<string, Invoice["status"]> = {
  draft: "sent",
  sent: "paid",
};

const NEXT_LABEL: Record<string, string> = {
  draft: "Mark as Sent",
  sent: "Mark as Paid",
};

function fmt(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NewInvoiceModal({ onClose }: { onClose: () => void }) {
  const { data: clients = [] } = useGetClientsQuery();
  const [createInvoice, { isLoading }] = useCreateInvoiceMutation();
  const [form, setForm] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    notes: "",
    currency: "INR",
  });
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!form.client_id) { setError("Please select a client."); return; }
    try {
      await createInvoice({
        client_id: form.client_id,
        amount: form.amount ? Number(form.amount) : undefined,
        due_date: form.due_date || undefined,
        notes: form.notes || undefined,
        currency: form.currency,
      }).unwrap();
      onClose();
    } catch {
      setError("Failed to create invoice. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-in fade-in zoom-in duration-150">
        <h3 className="text-base font-black text-[#111111] mb-1">New Invoice</h3>
        <p className="text-xs text-gray-400 mb-6">Create a draft invoice for a client placement.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Client *</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Amount</label>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Payment terms, bank details..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-50 text-[#111111] font-bold text-sm rounded-xl border border-gray-100 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-[#111111] text-white font-bold text-sm rounded-xl hover:bg-[#333] transition-all disabled:opacity-60"
          >
            {isLoading ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditInvoiceModal({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(invoice.amount?.toString() ?? "");
  const [dueDate, setDueDate] = useState(
    invoice.due_date ? invoice.due_date.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [updateInvoice, { isLoading }] = useUpdateInvoiceMutation();
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    try {
      await updateInvoice({
        id: invoice.id,
        body: {
          amount: amount ? Number(amount) : undefined,
          due_date: dueDate || undefined,
          notes: notes || undefined,
        },
      }).unwrap();
      onClose();
    } catch {
      setError("Failed to update invoice. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-in fade-in zoom-in duration-150">
        <h3 className="text-base font-black text-[#111111] mb-1">
          Edit Invoice
        </h3>
        <p className="text-xs text-gray-400 mb-6">{invoice.invoice_number}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              Amount (INR)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment terms, bank details..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-50 text-[#111111] font-bold text-sm rounded-xl border border-gray-100 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 py-2.5 bg-[#111111] text-white font-bold text-sm rounded-xl hover:bg-[#333] transition-all disabled:opacity-60"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  const user = useAppSelector(selectCurrentUser);
  const canManage =
    user?.role === "super_admin" || user?.role === "accounts_manager";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const { data: invoices = [], isLoading, isError, refetch } = useGetInvoicesQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const [updateInvoice] = useUpdateInvoiceMutation();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (inv.invoice_number || "").toLowerCase().includes(q) ||
      (inv.client_name || "").toLowerCase().includes(q) ||
      (inv.candidate_name || "").toLowerCase().includes(q) ||
      (inv.job_title || "").toLowerCase().includes(q)
    );
  });

  const stats = {
    total: invoices.length,
    draft: invoices.filter((i) => i.status === "draft").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    paid: invoices.filter((i) => i.status === "paid").length,
    totalPaid: invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + (i.amount || 0), 0),
  };

  const handleAdvanceStatus = async (inv: Invoice) => {
    const next = NEXT_STATUS[inv.status];
    if (!next) return;
    try {
      await updateInvoice({ id: inv.id, body: { status: next } }).unwrap();
      showToast(`Invoice marked as ${next}`);
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  const handleCancel = async (inv: Invoice) => {
    try {
      await updateInvoice({ id: inv.id, body: { status: "cancelled" } }).unwrap();
      showToast("Invoice cancelled");
    } catch {
      showToast("Failed to cancel invoice", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f2]">
      <Header title="Invoices" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Invoices",
              value: stats.total,
              icon: FileText,
              color: "text-blue-600 bg-blue-50",
            },
            {
              label: "Draft",
              value: stats.draft,
              icon: Clock,
              color: "text-gray-600 bg-gray-100",
            },
            {
              label: "Sent",
              value: stats.sent,
              icon: AlertCircle,
              color: "text-amber-600 bg-amber-50",
            },
            {
              label: "Amount Collected",
              value: fmt(stats.totalPaid, "INR"),
              icon: DollarSign,
              color: "text-emerald-600 bg-emerald-50",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
              >
                <Icon size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-2xl font-black text-[#111111]">{value}</p>
                <p className="text-xs text-gray-400 font-semibold">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {canManage && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#333] transition-all shadow-sm flex-shrink-0"
            >
              <Plus size={15} />
              New Invoice
            </button>
          )}
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by invoice #, client, candidate..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all capitalize ${
                    statusFilter === s
                      ? "bg-[#111111] text-white border-[#111111]"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-gray-300" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <AlertCircle size={32} />
            <p className="text-sm font-medium">Failed to load invoices</p>
            <button
              onClick={() => refetch()}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
            <FileText size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {invoices.length === 0
                ? "No invoices yet — they are auto-created when a candidate joins"
                : "No invoices match your search"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    {canManage && (
                      <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span className="font-black text-[#111111] text-xs">
                          {inv.invoice_number}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {fmtDate(inv.created_at)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Building size={13} className="text-gray-300 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700">
                            {inv.client_name || "—"}
                          </span>
                        </div>
                        {inv.job_title && (
                          <p className="text-[10px] text-gray-400 mt-0.5 pl-5">
                            {inv.job_title}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-gray-300 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700">
                            {inv.candidate_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-black text-[#111111]">
                          {fmt(inv.amount, inv.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {fmtDate(inv.due_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-bold capitalize ${
                            STATUS_STYLES[inv.status] ?? ""
                          }`}
                        >
                          {STATUS_ICONS[inv.status]}
                          {inv.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingInvoice(inv)}
                              className="text-xs font-bold text-gray-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-all"
                            >
                              Edit
                            </button>
                            {NEXT_STATUS[inv.status] && (
                              <button
                                onClick={() => handleAdvanceStatus(inv)}
                                className="text-xs font-bold text-[#111111] bg-[#111111]/5 hover:bg-[#111111] hover:text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                              >
                                <ChevronDown size={11} />
                                {NEXT_LABEL[inv.status]}
                              </button>
                            )}
                            {inv.status !== "cancelled" &&
                              inv.status !== "paid" && (
                                <button
                                  onClick={() => handleCancel(inv)}
                                  className="text-xs font-bold text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-all"
                                >
                                  Cancel
                                </button>
                              )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showNewModal && (
        <NewInvoiceModal onClose={() => setShowNewModal(false)} />
      )}

      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl text-sm font-bold shadow-xl transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === "error" ? "bg-red-500 text-white" : "bg-[#111111] text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
