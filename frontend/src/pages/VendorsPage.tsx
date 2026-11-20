import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload, Search, Mail, Users, Award, Gauge, XCircle, Trash2, ClipboardList, Trophy } from "lucide-react";
import BulkVendorUploadModal from "../components/bulk/BulkVendorUploadModal";
import { Vendor } from "../types";
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";
import { useAppSelector } from "../hooks/useAppSelector";
import { useNotify } from "../hooks/useNotify";
import { selectCurrentUser } from "../store/slices/authSlice";
import { useGetVendorsQuery, useDeleteVendorMutation } from "../store/api/vendorApi";
import { Button, PageHeader, StatCard, EmptyState, ErrorState, TableSkeleton, useConfirm } from "../components/ui";
import { ScoreBar, TierBadge, VendorAvatar, qualityColor, slaColor } from "../components/vendors/vendorUi";
import AssignJdModal from "../components/vendors/AssignJdModal";
import VendorDetailModal from "../components/vendors/VendorDetailModal";
import EditVendorModal from "../components/vendors/EditVendorModal";
import AddVendorModal from "../components/vendors/AddVendorModal";

const TIER_FILTERS = ["all", "preferred", "standard", "blocked"] as const;

export default function VendorsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const notify = useNotify();
  const user = useAppSelector(selectCurrentUser);
  const userRole: string = user?.role ?? "";
  const { sendEmail, sending: emailSending, emailToast } = useSendEmail();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [vendorToEdit, setVendorToEdit] = useState<Vendor | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showBulkVendorUpload, setShowBulkVendorUpload] = useState(false);
  const [showAssignJd, setShowAssignJd] = useState(false);

  // RTK Query
  const { data: vendors = [], isLoading: loading, isError, error, refetch, isFetching } = useGetVendorsQuery();
  const [deleteVendor] = useDeleteVendorMutation();

  const handleDeleteVendor = async (id: string) => {
    if (
      !(await confirm({
        title: "Delete this vendor?",
        message: "This cannot be undone.",
        danger: true,
        confirmText: "Delete vendor",
      }))
    )
      return;
    try {
      await deleteVendor(id).unwrap();
      if (selectedVendor?.id === id) setSelectedVendor(null);
    } catch {
      notify.error("Failed to delete vendor");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = vendors.filter((vendor) => {
    const q = search.toLowerCase();
    const matchSearch =
      vendor.company_name.toLowerCase().includes(q) ||
      vendor.primary_contact_name.toLowerCase().includes(q) ||
      vendor.industry_specializations.some((s) => s.toLowerCase().includes(q));
    const matchTier = tierFilter === "all" || vendor.tier === tierFilter;
    return matchSearch && matchTier;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((v) => v.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !(await confirm({
        title: `Permanently delete ${count} vendor${count > 1 ? "s" : ""}?`,
        message: "This cannot be undone.",
        danger: true,
        confirmText: "Delete",
      }))
    )
      return;

    setDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => deleteVendor(id).unwrap()));
    setSelectedIds(new Set());
    setDeleting(false);

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      notify.error(`${failed} vendor${failed > 1 ? "s" : ""} could not be deleted.`);
    }
  };

  const activeVendors = vendors.filter((v) => v.is_active);
  const stats = {
    total: vendors.length,
    preferred: vendors.filter((v) => v.tier === "preferred").length,
    blocked: vendors.filter((v) => v.tier === "blocked").length,
    avgQuality:
      vendors.length > 0
        ? Math.round(
            activeVendors.reduce((sum, v) => sum + (Number(v.quality_score) || 0), 0) / Math.max(1, activeVendors.length),
          )
        : 0,
  };

  const allChecked = selectedIds.size === filtered.length && filtered.length > 0;
  const someChecked = selectedIds.size > 0 && selectedIds.size < filtered.length;

  return (
    <>
      <PageHeader
        title="Vendor management"
        subtitle="Manage staffing partners and track performance"
        actions={
          <>
            <Button variant="secondary" icon={<Trophy size={16} />} onClick={() => navigate("/vendors/leaderboard")}>
              Leaderboard
            </Button>
            <Button variant="secondary" icon={<ClipboardList size={16} />} onClick={() => setShowAssignJd(true)}>
              Assign JD
            </Button>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setShowBulkVendorUpload(true)}>
              Bulk import
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setShowAddVendor(true)}>
              Add vendor
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Total vendors" value={stats.total} icon={<Users size={18} />} loading={loading} />
          <StatCard label="Preferred" value={stats.preferred} icon={<Award size={18} />} tone="success" loading={loading} />
          <StatCard label="Avg quality" value={`${stats.avgQuality}%`} icon={<Gauge size={18} />} tone="brand" loading={loading} />
          <StatCard label="Blocked" value={stats.blocked} icon={<XCircle size={18} />} tone="danger" loading={loading} />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search vendors"
              placeholder="Search by name, contact or specialization…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="zh-input pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface-sunken p-1" role="group" aria-label="Filter by tier">
            {TIER_FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tierFilter === t}
                onClick={() => setTierFilter(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tierFilter === t ? "bg-white text-navy-700 shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Select all vendors"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleSelectAll}
                className="h-4 w-4 cursor-pointer rounded border-line-strong accent-navy-600"
              />
              <span className="text-sm font-semibold text-navy-700">
                {selectedIds.size} vendor{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <Button variant="link" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} />}
              loading={deleting}
              loadingText="Deleting…"
              onClick={handleDeleteSelected}
            >
              {`Delete ${selectedIds.size > 1 ? `${selectedIds.size} vendors` : "vendor"}`}
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <TableSkeleton columns={6} />
        ) : isError && vendors.length === 0 ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="zh-card">
            {vendors.length === 0 ? (
              <EmptyState
                icon={<Users size={22} aria-hidden="true" />}
                title="No vendors yet"
                description="Add your staffing partners to assign JDs and track their performance."
                action={
                  <Button icon={<Plus size={16} />} onClick={() => setShowAddVendor(true)}>
                    Add vendor
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Search size={22} aria-hidden="true" />}
                title="No vendors found"
                description="Try a different search or tier filter."
              />
            )}
          </div>
        ) : (
          <div className="zh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <caption className="sr-only">Vendors</caption>
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className="w-10 border-b border-line px-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Select all vendors"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-line-strong accent-navy-600"
                      />
                    </th>
                    {["Vendor", "Tier", "Contact", "Submissions", "Shortlist", "Fill rate", "Quality score", "SLA"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="whitespace-nowrap border-b border-line px-4 py-2.5 text-xs font-medium text-muted"
                      >
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="border-b border-line px-4 py-2.5 text-right text-xs font-medium text-muted">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className={`cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface ${
                        !vendor.is_active ? "opacity-60" : ""
                      } ${selectedIds.has(vendor.id) ? "bg-navy-50/60" : ""}`}
                      onClick={() => setSelectedVendor(vendor)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${vendor.company_name}`}
                          checked={selectedIds.has(vendor.id)}
                          onChange={() => toggleSelect(vendor.id)}
                          className="h-4 w-4 cursor-pointer rounded border-line-strong accent-navy-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <VendorAvatar name={vendor.company_name} size="sm" />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVendor(vendor);
                              }}
                              className="block max-w-[180px] truncate text-left font-medium text-ink hover:text-navy-600 hover:underline"
                            >
                              {vendor.company_name}
                            </button>
                            <p className="text-xs text-muted">{vendor.is_active ? "Active" : "Inactive"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TierBadge tier={vendor.tier} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-ink">{vendor.primary_contact_name}</p>
                        <p className="max-w-[180px] truncate text-xs text-muted">{vendor.primary_contact_email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">{vendor.submission_count}</td>
                      <td className="px-4 py-3 text-ink-soft">{vendor.shortlist_rate}%</td>
                      <td className="px-4 py-3 text-ink-soft">{vendor.fill_rate}%</td>
                      <td className="min-w-[130px] px-4 py-3">
                        <ScoreBar value={vendor.quality_score} color={qualityColor(vendor.quality_score)} />
                      </td>
                      <td className="min-w-[130px] px-4 py-3">
                        <ScoreBar value={vendor.sla_adherence} color={slaColor(vendor.sla_adherence)} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => sendEmail(vendor.primary_contact_email, { subject: "Job Opportunity from ZorHire" })}
                            disabled={emailSending}
                            title="Send email"
                            aria-label={`Email ${vendor.company_name}`}
                            className="rounded-lg p-2 text-muted transition-colors hover:bg-navy-50 hover:text-navy-600 disabled:opacity-40"
                          >
                            <Mail size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVendor(vendor.id)}
                            title="Delete vendor"
                            aria-label={`Delete ${vendor.company_name}`}
                            className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {emailToast && <EmailToast {...emailToast} />}

      {showBulkVendorUpload && <BulkVendorUploadModal onClose={() => setShowBulkVendorUpload(false)} onSuccess={() => {}} />}

      {showAssignJd && <AssignJdModal vendors={vendors} userRole={userRole} onClose={() => setShowAssignJd(false)} />}

      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onSendEmail={(email) => sendEmail(email, { subject: "Job Opportunity from ZorHire" })}
          emailSending={emailSending}
          onEdit={(v) => {
            setSelectedVendor(null);
            setVendorToEdit(v);
          }}
        />
      )}

      {vendorToEdit && <EditVendorModal vendor={vendorToEdit} onClose={() => setVendorToEdit(null)} />}

      {showAddVendor && <AddVendorModal onClose={() => setShowAddVendor(false)} />}
    </>
  );
}
