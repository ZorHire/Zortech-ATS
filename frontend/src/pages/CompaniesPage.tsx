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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Power,
} from "lucide-react";
import {
  useGetTenantsQuery,
  useBulkDeleteTenantsMutation,
  useToggleTenantStatusMutation,
  useOnboardTenantMutation,
  type Tenant,
} from "../store/api/adminApi";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Skeleton,
  StatCard,
  useConfirm,
} from "../components/ui";
import type { BadgeTone } from "../components/ui";
import { useNotify } from "../hooks/useNotify";

// ─── Badge helpers ────────────────────────────────────────────────────────────

function SubBadge({ status, planType }: { status: string | null; planType: string | null }) {
  if (!status || status === "cancelled" || status === "expired") {
    return <Badge tone="warning">No plan</Badge>;
  }
  const label = planType
    ? planType.charAt(0).toUpperCase() + planType.slice(1) + " plan"
    : "Active plan";
  const toneMap: Record<string, BadgeTone> = {
    growth: "success",
    starter: "navy",
    enterprise: "brand",
  };
  return (
    <Badge tone={toneMap[planType?.toLowerCase() ?? ""] ?? "neutral"} icon={<Crown size={10} aria-hidden="true" />}>
      {label}
    </Badge>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" icon={<CheckCircle2 size={12} aria-hidden="true" />}>Active</Badge>
  ) : (
    <Badge tone="danger" icon={<XCircle size={12} aria-hidden="true" />}>Inactive</Badge>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct > 80 ? "bg-danger-600" : pct > 60 ? "bg-brand-500" : "bg-navy-500";
  return (
    <div>
      <p className="mb-1 whitespace-nowrap text-xs text-ink-soft">Users {used} / {limit || 20}</p>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  company_name: "", admin_full_name: "", admin_email: "", admin_password: "",
  company_email: "", company_phone: "", company_address: "", gst_number: "", country: "India",
};

type OnboardForm = typeof EMPTY_FORM;

function FormField({
  label, field, form, setForm, required, type = "text", placeholder,
}: {
  label: string;
  field: keyof OnboardForm;
  form: OnboardForm;
  setForm: React.Dispatch<React.SetStateAction<OnboardForm>>;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = `onboard-${field}`;
  return (
    <div>
      <label htmlFor={id} className="zh-label">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </label>
      <input
        id={id}
        required={required}
        type={type}
        value={form[field]}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        className="zh-input"
        placeholder={placeholder}
      />
    </div>
  );
}

export default function CompaniesPage() {
  const { data: allTenants = [], isLoading: loading, isError, error, isFetching, refetch } = useGetTenantsQuery();
  const [bulkDeleteTenants] = useBulkDeleteTenantsMutation();
  const [toggleTenantStatus] = useToggleTenantStatusMutation();
  const [onboardTenant] = useOnboardTenantMutation();
  const notify = useNotify();
  const confirm = useConfirm();

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

  const [form, setForm] = useState<OnboardForm>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

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
  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelected((p) => p.size === paginated.length ? new Set() : new Set(paginated.map((t) => t.id)));

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const ok = await confirm({
      title: `Permanently delete ${ids.length} compan${ids.length === 1 ? "y" : "ies"}?`,
      message: "This cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeleteLoading(true);
    try {
      await bulkDeleteTenants(ids).unwrap();
      setSelected(new Set());
      notify.success(`${ids.length} compan${ids.length === 1 ? "y" : "ies"} deleted`);
    } catch (err: any) {
      notify.error(err?.data?.message || "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSingleDelete = async (t: Tenant) => {
    const ok = await confirm({
      title: `Permanently delete "${t.name}"?`,
      message: "This removes ALL their data and cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setActionLoading(t.id);
    try {
      await bulkDeleteTenants([t.id]).unwrap();
      notify.success(`"${t.name}" deleted`);
    } catch (err: any) {
      notify.error(err?.data?.message || "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = async (t: Tenant) => {
    const ok = await confirm({
      title: `${t.is_active ? "Deactivate" : "Activate"} "${t.name}"?`,
      confirmText: t.is_active ? "Deactivate" : "Activate",
      danger: t.is_active,
    });
    if (!ok) return;
    setActionLoading(t.id);
    try {
      await toggleTenantStatus({ id: t.id, is_active: !t.is_active }).unwrap();
      notify.success(`${t.name} ${!t.is_active ? "activated" : "deactivated"}`);
    } catch (err: any) {
      notify.error(err?.data?.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormError("");
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      await onboardTenant(form).unwrap();
      setShowModal(false);
      setForm(EMPTY_FORM);
      notify.success(`${form.company_name} onboarded — welcome email sent`);
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

  const selectCls = "zh-input appearance-none pr-8 sm:w-auto";
  const HEADERS = ["Company", "Contact", "Subscription", "Status", "Onboarded", "Usage", "Actions"];

  return (
    <>
      <PageHeader
        title="Company management"
        subtitle="Onboard and manage all client companies on ZorHire"
        actions={
          <>
            {selected.size > 0 && (
              <Button variant="danger" icon={<Trash2 size={15} />} loading={deleteLoading} onClick={handleBulkDelete}>
                Delete {selected.size}
              </Button>
            )}
            <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>
              Onboard company
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Total companies" value={tenants.length} hint="All onboarded companies" icon={<Building2 size={18} />} loading={loading} />
          <StatCard label="Active" value={activeCount} hint="Currently active" icon={<CheckCircle2 size={18} />} tone="success" loading={loading} />
          <StatCard label="Inactive" value={inactiveCount} hint="Not active" icon={<XCircle size={18} />} tone="danger" loading={loading} />
          <StatCard label="Subscribed" value={subscribedCount} hint="With an active plan" icon={<Crown size={18} />} tone="brand" loading={loading} />
        </div>

        {/* ── Search + Filters ── */}
        <div className="zh-card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
          <div className="relative min-w-0 sm:min-w-[220px] sm:flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search companies"
              placeholder="Search by name, slug, or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="zh-input pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {[
              { label: "Filter by status", value: statusFilter, set: setStatusFilter, options: ["All Status", "Active", "Inactive"] },
              { label: "Filter by subscription", value: subFilter, set: setSubFilter, options: ["All Subscription", "With Plan", "No Plan"] },
            ].map((f) => (
              <div key={f.label} className="relative">
                <select
                  aria-label={f.label}
                  value={f.value}
                  onChange={(e) => { f.set(e.target.value); setCurrentPage(1); }}
                  className={selectCls}
                >
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              </div>
            ))}
            <div className="relative col-span-2 sm:col-span-1">
              <select
                aria-label="Sort companies"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={selectCls}
              >
                {["Onboarded: Newest", "Onboarded: Oldest", "Name A-Z", "Name Z-A"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        {isError && !allTenants.length ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : (
          <div className="zh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <caption className="sr-only">Companies</caption>
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="w-10 border-b border-line px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all companies on this page"
                        checked={paginated.length > 0 && selected.size === paginated.length}
                        ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < paginated.length; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded accent-navy-600"
                      />
                    </th>
                    {HEADERS.map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap border-b border-line px-4 py-2.5 text-xs font-medium text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="w-10 px-4 py-4"><Skeleton className="h-4 w-4" /></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-lg" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-16" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4"><Skeleton className="h-3 w-24" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-5 w-16" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-3 w-14" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-3 w-20" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-3 w-16" /></td>
                        <td className="px-4 py-4"><Skeleton className="h-6 w-16" /></td>
                      </tr>
                    ))
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState
                          compact
                          icon={<Building2 size={22} aria-hidden="true" />}
                          title={tenants.length === 0 ? "No companies onboarded yet" : "No results match your filters"}
                          description={tenants.length === 0 ? "Onboard a company to give its team access to ZorHire." : "Try a different search or clear the filters."}
                        />
                      </td>
                    </tr>
                  ) : (
                    paginated.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-line transition-colors last:border-0 ${selected.has(t.id) ? "bg-navy-50/60" : "hover:bg-surface"}`}
                      >
                        <td className="w-10 px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            aria-label={`Select ${t.name}`}
                            checked={selected.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            className="h-4 w-4 cursor-pointer rounded accent-navy-600"
                          />
                        </td>

                        {/* Company */}
                        <td className="min-w-[200px] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden="true"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-600 text-sm font-semibold text-white"
                            >
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{t.name}</p>
                              <p className="flex items-center gap-1 text-xs text-muted">
                                <Globe size={11} aria-hidden="true" />{t.slug}
                              </p>
                              {t.industry && <Badge className="mt-1">{t.industry}</Badge>}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="min-w-[180px] px-4 py-4">
                          <div className="space-y-0.5">
                            {t.company_email && (
                              <p className="flex items-center gap-1 text-xs text-ink-soft">
                                <Mail size={11} className="shrink-0 text-muted" aria-hidden="true" />
                                <span className="max-w-[160px] truncate">{t.company_email}</span>
                              </p>
                            )}
                            {t.company_phone && (
                              <p className="flex items-center gap-1 text-xs text-ink-soft">
                                <Phone size={11} className="shrink-0 text-muted" aria-hidden="true" />{t.company_phone}
                              </p>
                            )}
                            {t.country && <p className="text-xs text-muted">{t.country}</p>}
                          </div>
                        </td>

                        {/* Subscription */}
                        <td className="min-w-[140px] px-4 py-4">
                          <SubBadge status={t.subscription_status} planType={t.plan_type} />
                          {t.subscription_end_date && t.subscription_status === "active" && (
                            <p className="mt-1 text-xs text-muted">Renews on {fmtDate(t.subscription_end_date)}</p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <StatusBadge active={t.is_active} />
                        </td>

                        {/* Onboarded */}
                        <td className="min-w-[160px] px-4 py-4">
                          <p className="flex items-center gap-1 text-xs text-ink">
                            <Calendar size={11} className="text-muted" aria-hidden="true" />
                            {fmtDateTime(t.onboarded_at)}
                          </p>
                          {t.onboarded_by && <p className="mt-0.5 text-xs text-muted">by {t.onboarded_by}</p>}
                        </td>

                        {/* Usage */}
                        <td className="min-w-[110px] px-4 py-4">
                          <UsageBar used={t.user_count ?? 0} limit={t.user_limit ?? 20} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Power size={13} />}
                              loading={actionLoading === t.id}
                              onClick={() => toggleStatus(t)}
                              className={t.is_active ? "text-danger-600 hover:text-danger-700" : "text-success-700"}
                            >
                              {t.is_active ? "Deactivate" : "Activate"}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleSingleDelete(t)}
                              disabled={actionLoading === t.id}
                              aria-label={`Delete ${t.name}`}
                              title="Delete company"
                              className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)} to{" "}
                  {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} companies
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Previous page"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === currentPage ? "page" : undefined}
                      onClick={() => setCurrentPage(p)}
                      className={`h-7 w-7 rounded-lg text-xs font-medium transition-colors ${p === currentPage ? "bg-navy-600 text-white" : "text-muted hover:bg-surface-sunken"}`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 5 && <span className="text-xs text-muted">…{totalPages}</span>}
                  <button
                    type="button"
                    aria-label="Next page"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Onboard Modal ── */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title="Onboard new company"
        description="A welcome email will be sent to the admin"
        preventClose={formLoading}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" form="onboard-company-form" icon={<Building2 size={15} />} loading={formLoading}>
              Onboard company
            </Button>
          </>
        }
      >
        <form id="onboard-company-form" onSubmit={handleOnboard} className="space-y-4">
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              {formError}
            </div>
          )}

          <h3 className="text-sm font-semibold text-ink">Company details</h3>

          <FormField label="Company name" field="company_name" form={form} setForm={setForm} required placeholder="Acme Staffing Pvt Ltd" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Company email" field="company_email" type="email" form={form} setForm={setForm} placeholder="hr@acme.com" />
            <FormField label="Phone" field="company_phone" form={form} setForm={setForm} placeholder="+91 98765 43210" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Country" field="country" form={form} setForm={setForm} placeholder="India" />
            <FormField label="GST number" field="gst_number" form={form} setForm={setForm} placeholder="29ABCDE1234F1Z5" />
          </div>

          <FormField label="Address" field="company_address" form={form} setForm={setForm} placeholder="123 MG Road, Bangalore" />

          <h3 className="border-t border-line pt-4 text-sm font-semibold text-ink">Admin account</h3>

          <FormField label="Admin full name" field="admin_full_name" form={form} setForm={setForm} required placeholder="Priya Sharma" />
          <FormField label="Admin email" field="admin_email" type="email" form={form} setForm={setForm} required placeholder="priya@acme.com" />
          <FormField
            label="Temporary password"
            field="admin_password"
            form={form}
            setForm={setForm}
            required
            placeholder="Admin will be asked to change this on first login"
          />
        </form>
      </Modal>
    </>
  );
}
