import { useState, useEffect } from "react";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  CreditCard,
  Globe,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Trash2,
} from "lucide-react";
import Header from "../components/layout/Header";
import api from "../lib/api";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_platform_owner: boolean;
  company_email: string | null;
  company_phone: string | null;
  country: string | null;
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
  subscription_status: string | null;
  plan_type: string | null;
  subscription_end_date: string | null;
}

const SUB_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  cancelled: { label: "Cancelled", cls: "bg-red-50 text-red-600 border-red-100" },
  expired:   { label: "Expired",   cls: "bg-gray-100 text-gray-500 border-gray-200" },
};

function subBadge(status: string | null) {
  if (!status) return { label: "No Plan", cls: "bg-amber-50 text-amber-700 border-amber-100" };
  return SUB_BADGE[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
}

export default function CompaniesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Form state
  const [form, setForm] = useState({
    company_name: "",
    admin_full_name: "",
    admin_email: "",
    admin_password: "",
    company_email: "",
    company_phone: "",
    company_address: "",
    gst_number: "",
    country: "India",
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((t) => t.id))
    );
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!window.confirm(
      `Permanently delete ${ids.length} compan${ids.length === 1 ? "y" : "ies"}?\n\nThis removes all their users, jobs, candidates, and data. This cannot be undone.`
    )) return;

    setDeleteLoading(true);
    try {
      await api.post("/tenants/bulk-delete", { ids });
      setSelected(new Set());
      await fetchTenants();
      showToast(`${ids.length} compan${ids.length === 1 ? "y" : "ies"} deleted`, true);
    } catch (err: any) {
      showToast(err.message || "Failed to delete companies", false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await api.get("/tenants");
      setTenants(data.filter((t: Tenant) => !t.is_platform_owner));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await api.post("/tenants/onboard", form);
      setShowModal(false);
      setForm({
        company_name: "", admin_full_name: "", admin_email: "",
        admin_password: "", company_email: "", company_phone: "",
        company_address: "", gst_number: "", country: "India",
      });
      fetchTenants();
      showToast(`${form.company_name} onboarded — welcome email sent`, true);
    } catch (err: any) {
      setFormError(err.message || "Failed to onboard company");
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStatus = async (tenant: Tenant) => {
    if (!window.confirm(
      `${tenant.is_active ? "Deactivate" : "Activate"} "${tenant.name}"?\n\n` +
      (tenant.is_active
        ? "Their users will lose access immediately."
        : "Their users will regain access if they have an active subscription.")
    )) return;

    setActionLoading(tenant.id);
    try {
      await api.patch(`/tenants/${tenant.id}/status`, { is_active: !tenant.is_active });
      setTenants((prev) =>
        prev.map((t) => t.id === tenant.id ? { ...t, is_active: !t.is_active } : t)
      );
      showToast(`${tenant.name} ${!tenant.is_active ? "activated" : "deactivated"}`, true);
    } catch (err: any) {
      showToast(err.message || "Failed to update status", false);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = tenants.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.company_email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const active   = tenants.filter((t) => t.is_active).length;
  const withPlan = tenants.filter((t) => t.subscription_status === "active").length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50/50">
      <Header
        title="Company Management"
        subtitle="Onboard and manage all client companies on ZorHire"
        actions={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-60"
              >
                {deleteLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Trash2 size={16} />}
                Delete {selected.size} Selected
              </button>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus size={18} />
              Onboard Company
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Companies</p>
            <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{active}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Inactive</p>
            <p className="text-2xl font-bold text-red-500">{tenants.length - active}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Subscribed</p>
            <p className="text-2xl font-bold text-blue-600">{withPlan}</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <Search size={20} className="text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search by name, slug, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-4 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Subscription</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Onboarded</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 font-medium">
                      {tenants.length === 0 ? "No companies onboarded yet" : "No results found"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => {
                    const badge = subBadge(t.subscription_status);
                    const isSelected = selected.has(t.id);
                    return (
                      <tr key={t.id} className={`transition-colors group ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50/50"}`}>
                        <td className="px-4 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(t.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{t.name}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Globe size={10} /> {t.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            {t.company_email && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail size={10} /> {t.company_email}
                              </p>
                            )}
                            {t.company_phone && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone size={10} /> {t.company_phone}
                              </p>
                            )}
                            {t.country && (
                              <p className="text-xs text-gray-400">{t.country}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.cls}`}>
                              <CreditCard size={10} /> {badge.label}
                            </span>
                            {t.plan_type && (
                              <p className="text-[10px] text-gray-400 ml-1">{t.plan_type}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {t.is_active ? (
                            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                              <CheckCircle2 size={14} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                              <XCircle size={14} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {t.onboarded_at
                              ? new Date(t.onboarded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                              : "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => toggleStatus(t)}
                            disabled={actionLoading === t.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                              t.is_active
                                ? "text-red-600 bg-red-50 hover:bg-red-100"
                                : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                            }`}
                          >
                            {actionLoading === t.id ? "…" : t.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold text-white ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Onboard Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/30 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Onboard New Company</h2>
                  <p className="text-xs text-gray-500 font-medium">A welcome email will be sent to the admin</p>
                </div>
              </div>
              <button
                onClick={() => { setShowModal(false); setFormError(""); }}
                className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleOnboard} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex gap-2 items-start">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}

              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Company Details</p>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Company Name *</label>
                <input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Staffing Pvt Ltd"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Company Email</label>
                  <input
                    type="email"
                    value={form.company_email}
                    onChange={(e) => setForm((f) => ({ ...f, company_email: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="hr@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Phone</label>
                  <input
                    value={form.company_phone}
                    onChange={(e) => setForm((f) => ({ ...f, company_phone: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Country</label>
                  <input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="India"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">GST Number</label>
                  <input
                    value={form.gst_number}
                    onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Address</label>
                <input
                  value={form.company_address}
                  onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 MG Road, Bangalore"
                />
              </div>

              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider pt-2">Admin Account</p>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Admin Full Name *</label>
                <input
                  required
                  value={form.admin_full_name}
                  onChange={(e) => setForm((f) => ({ ...f, admin_full_name: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Priya Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Admin Email *</label>
                <input
                  required
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="priya@acme.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Temporary Password *</label>
                <input
                  required
                  type="text"
                  value={form.admin_password}
                  onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="They'll be forced to change this on first login"
                />
                <p className="mt-1 ml-1 text-[10px] text-gray-400">The admin will be prompted to set a new password immediately after logging in.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(""); }}
                  className="flex-1 py-3 bg-gray-50 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Building2 size={16} /> Onboard Company</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
