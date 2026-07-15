import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Crown,
  Globe,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  useGetTenantsQuery,
  useBulkDeleteTenantsMutation,
  useToggleTenantStatusMutation,
  useOnboardTenantMutation,
  type Tenant,
} from "../store/api/adminApi";

// ─── Badge helpers ────────────────────────────────────────────────────────────

function SubBadge({ status, planType }: { status: string | null; planType: string | null }) {
  if (!status || status === "cancelled" || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        No Plan
      </span>
    );
  }
  const label = planType
    ? planType.charAt(0).toUpperCase() + planType.slice(1) + " Plan"
    : "Active Plan";
  const colorMap: Record<string, string> = {
    growth: "bg-emerald-50 text-emerald-700 border-emerald-100",
    starter: "bg-blue-50 text-blue-700 border-blue-100",
    enterprise: "bg-violet-50 text-violet-700 border-violet-100",
  };
  const cls = colorMap[planType?.toLowerCase() ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      <Crown size={10} />
      {label}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 size={13} className="text-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
      <XCircle size={13} className="text-red-400" /> Inactive
    </span>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct > 80 ? "bg-red-400" : pct > 60 ? "bg-amber-400" : "bg-blue-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">Users {used} / {limit || 20}</span>
      </div>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({
  tenant,
  loading,
  onToggle,
  onDelete,
}: {
  tenant: Tenant;
  loading: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
            <button
              onClick={() => { setOpen(false); onToggle(); }}
              disabled={loading}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-gray-50 ${tenant.is_active ? "text-red-600" : "text-emerald-700"}`}
            >
              {loading ? "…" : tenant.is_active ? "Deactivate Company" : "Activate Company"}
            </button>
            <hr className="border-gray-100 my-0.5" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              disabled={loading}
              className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash2 size={12} /> Delete Company
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${ok ? "bg-emerald-600" : "bg-red-600"}`}>
      {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function CompaniesPage() {
  const { data: allTenants = [], isLoading: loading } = useGetTenantsQuery();
  const [bulkDeleteTenants] = useBulkDeleteTenantsMutation();
  const [toggleTenantStatus] = useToggleTenantStatusMutation();
  const [onboardTenant] = useOnboardTenantMutation();

  const tenants = allTenants.filter((t) => !t.is_platform_owner);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [subFilter, setSubFilter] = useState("All Subscription");
  const [sortBy, setSortBy] = useState("Onboarded: Newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    company_name: "", admin_full_name: "", admin_email: "", admin_password: "",
    company_email: "", company_phone: "", company_address: "", gst_number: "", country: "India",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Filtering + sorting ──
  const filtered = tenants
    .filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        (t.company_email ?? "").toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Active" && t.is_active) ||
        (statusFilter === "Inactive" && !t.is_active);
      const matchesSub =
        subFilter === "All Subscription" ||
        (subFilter === "With Plan" && t.subscription_status === "active") ||
        (subFilter === "No Plan" && t.subscription_status !== "active");
      return matchesSearch && matchesStatus && matchesSub;
    })
    .sort((a, b) => {
      if (sortBy === "Onboarded: Newest") {
        return new Date(b.onboarded_at ?? b.created_at).getTime() - new Date(a.onboarded_at ?? a.created_at).getTime();
      }
      if (sortBy === "Onboarded: Oldest") {
        return new Date(a.onboarded_at ?? a.created_at).getTime() - new Date(b.onboarded_at ?? b.created_at).getTime();
      }
      if (sortBy === "Name A-Z") return a.name.localeCompare(b.name);
      if (sortBy === "Name Z-A") return b.name.localeCompare(a.name);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Stats ──
  const activeCount = tenants.filter((t) => t.is_active).length;
  const inactiveCount = tenants.length - activeCount;
  const subscribedCount = tenants.filter((t) => t.subscription_status === "active").length;

  // ── Selection ──
  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelected((p) => p.size === paginated.length ? new Set() : new Set(paginated.map((t) => t.id)));

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!window.confirm(`Permanently delete ${ids.length} compan${ids.length === 1 ? "y" : "ies"}?\n\nThis cannot be undone.`)) return;
    setDeleteLoading(true);
    try {
      await bulkDeleteTenants(ids).unwrap();
      setSelected(new Set());
      showToast(`${ids.length} compan${ids.length === 1 ? "y" : "ies"} deleted`, true);
    } catch (err: any) {
      showToast(err?.data?.message || "Failed to delete", false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSingleDelete = async (t: Tenant) => {
    if (!window.confirm(`Permanently delete "${t.name}"?\n\nThis removes ALL their data and cannot be undone.`)) return;
    setActionLoading(t.id);
    try {
      await bulkDeleteTenants([t.id]).unwrap();
      showToast(`"${t.name}" deleted`, true);
    } catch (err: any) {
      showToast(err?.data?.message || "Failed to delete", false);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (t: Tenant) => {
    if (!window.confirm(`${t.is_active ? "Deactivate" : "Activate"} "${t.name}"?`)) return;
    setActionLoading(t.id);
    try {
      await toggleTenantStatus({ id: t.id, is_active: !t.is_active }).unwrap();
      showToast(`${t.name} ${!t.is_active ? "activated" : "deactivated"}`, true);
    } catch (err: any) {
      showToast(err?.data?.message || "Failed to update status", false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await onboardTenant(form).unwrap();
      setShowModal(false);
      setForm({ company_name: "", admin_full_name: "", admin_email: "", admin_password: "", company_email: "", company_phone: "", company_address: "", gst_number: "", country: "India" });
      showToast(`${form.company_name} onboarded — welcome email sent`, true);
    } catch (err: any) {
      setFormError(err?.data?.message || "Failed to onboard company");
    } finally {
      setFormLoading(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  const fmtDateTime = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-black text-gray-900">Company Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">Onboard and manage all client companies on ZorHire</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={deleteLoading}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-60"
            >
              {deleteLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={15} />}
              Delete {selected.size}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#111111] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition-all"
          >
            <Plus size={16} /> Onboard Company
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total Companies", value: tenants.length, icon: Building2, color: "text-blue-600", bg: "bg-blue-50", sub: "All onboarded companies" },
            { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", sub: "Currently active companies" },
            { label: "Inactive", value: inactiveCount, icon: XCircle, color: "text-red-500", bg: "bg-red-50", sub: "Companies not active" },
            { label: "Subscribed", value: subscribedCount, icon: Crown, color: "text-violet-600", bg: "bg-violet-50", sub: "Companies with active plans" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon size={17} className={s.color} />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900">{loading ? "—" : s.value}</p>
              <p className="text-sm font-medium text-gray-700 mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Search + Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, slug, or email…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            {[
              { value: statusFilter, set: setStatusFilter, options: ["All Status", "Active", "Inactive"] },
              { value: subFilter, set: setSubFilter, options: ["All Subscription", "With Plan", "No Plan"] },
            ].map((f, i) => (
              <div key={i} className="relative">
                <select
                  value={f.value}
                  onChange={(e) => { f.set(e.target.value); setCurrentPage(1); }}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </div>
            ))}
            <div className="relative ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {["Onboarded: Newest", "Onboarded: Oldest", "Name A-Z", "Name Z-A"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && selected.size === paginated.length}
                      ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < paginated.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  {["COMPANY", "CONTACT", "SUBSCRIPTION", "STATUS", "ONBOARDED", "USAGE", "ACTIONS"].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4 w-10"><div className="w-4 h-4 bg-gray-200 rounded" /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-200 rounded-xl" />
                          <div>
                            <div className="h-3 bg-gray-200 rounded w-28 mb-1.5" />
                            <div className="h-2.5 bg-gray-200 rounded w-16" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4"><div className="h-3 bg-gray-200 rounded w-24" /></td>
                      <td className="px-4 py-4"><div className="h-5 bg-gray-200 rounded w-16" /></td>
                      <td className="px-4 py-4"><div className="h-3 bg-gray-200 rounded w-14" /></td>
                      <td className="px-4 py-4"><div className="h-3 bg-gray-200 rounded w-20" /></td>
                      <td className="px-4 py-4"><div className="h-3 bg-gray-200 rounded w-16" /></td>
                      <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded w-8" /></td>
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Building2 size={32} className="text-gray-200" />
                        <p className="text-sm text-gray-400 font-medium">
                          {tenants.length === 0 ? "No companies onboarded yet" : "No results match your filters"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((t) => (
                    <tr
                      key={t.id}
                      className={`transition-colors group ${selected.has(t.id) ? "bg-blue-50/40" : "hover:bg-gray-50/40"}`}
                    >
                      <td className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                        />
                      </td>

                      {/* Company */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Globe size={9} />{t.slug}
                            </p>
                            {t.industry && (
                              <span className="mt-0.5 inline-block text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                {t.industry}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="space-y-0.5">
                          {t.company_email && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Mail size={10} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">{t.company_email}</span>
                            </p>
                          )}
                          {t.company_phone && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone size={10} className="text-gray-400 flex-shrink-0" />{t.company_phone}
                            </p>
                          )}
                          {t.country && <p className="text-[11px] text-gray-400">{t.country}</p>}
                        </div>
                      </td>

                      {/* Subscription */}
                      <td className="px-4 py-4 min-w-[140px]">
                        <SubBadge status={t.subscription_status} planType={t.plan_type} />
                        {t.subscription_end_date && t.subscription_status === "active" && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Renews on {fmtDate(t.subscription_end_date)}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge active={t.is_active} />
                      </td>

                      {/* Onboarded */}
                      <td className="px-4 py-4 min-w-[150px]">
                        <div>
                          <p className="text-xs text-gray-700 font-medium flex items-center gap-1">
                            <Calendar size={10} className="text-gray-400" />
                            {fmtDateTime(t.onboarded_at)}
                          </p>
                          {t.onboarded_by && (
                            <p className="text-[11px] text-gray-400 mt-0.5">by {t.onboarded_by}</p>
                          )}
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="px-4 py-4 min-w-[100px]">
                        <UsageBar
                          used={t.user_count ?? 0}
                          limit={t.user_limit ?? 20}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <RowMenu
                          tenant={t}
                          loading={actionLoading === t.id}
                          onToggle={() => toggleStatus(t)}
                          onDelete={() => handleSingleDelete(t)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50">
              <p className="text-xs text-gray-500">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} companies
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${p === currentPage ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-xs text-gray-400">…{totalPages}</span>}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* ── Onboard Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-blue-50/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Onboard New Company</h2>
                  <p className="text-xs text-gray-500">A welcome email will be sent to the admin</p>
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setFormError(""); }} className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-600">
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleOnboard} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex gap-2 items-start">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />{formError}
                </div>
              )}

              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Company Details</p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company Name *</label>
                <input required value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Acme Staffing Pvt Ltd" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Company Email</label>
                  <input type="email" value={form.company_email} onChange={(e) => setForm((f) => ({ ...f, company_email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="hr@acme.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
                  <input value={form.company_phone} onChange={(e) => setForm((f) => ({ ...f, company_phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Country</label>
                  <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="India" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">GST Number</label>
                  <input value={form.gst_number} onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="29ABCDE1234F1Z5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Address</label>
                <input value={form.company_address} onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123 MG Road, Bangalore" />
              </div>

              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-1">Admin Account</p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Admin Full Name *</label>
                <input required value={form.admin_full_name} onChange={(e) => setForm((f) => ({ ...f, admin_full_name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Priya Sharma" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Admin Email *</label>
                <input required type="email" value={form.admin_email} onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="priya@acme.com" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Temporary Password *</label>
                <input required type="text" value={form.admin_password} onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Admin will be asked to change this on first login" />
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); setFormError(""); }}
                  className="flex-1 py-3 bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={formLoading}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-60">
                  {formLoading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Building2 size={15} /> Onboard Company</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
