import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Search, X, Loader2, Users, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppSelector } from "../hooks/useAppSelector";
import { useNotify } from "../hooks/useNotify";
import { selectCurrentUser } from "../store/slices/authSlice";
import { useGetJobsQuery, useUpdateJobMutation } from "../store/api/jobApi";
import { useGetUsersQuery } from "../store/api/adminApi";
import { useGetVendorsQuery } from "../store/api/vendorApi";
import { getErrorMessage } from "../lib/format";
import { PageHeader, StatCard, DataTable, EmptyState, Button, buttonClasses } from "../components/ui";
import type { Column } from "../components/ui";
import { JobStatusBadge } from "../components/jobs/jobBadges";

interface AssignedJob {
  id: string;
  title: string;
  status: string;
  assigned_recruiter_ids: string[];
  assigned_vendor_ids: string[];
}

interface RecruiterInfo { id: string; full_name: string; email: string; }
interface VendorInfo { id: string; company_name: string; }

const PAGE_SIZE = 15;

function AssignmentChip({
  icon,
  label,
  removing,
  onRemove,
}: {
  icon: ReactNode;
  label: string;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pl-2.5 pr-1 text-xs font-medium text-ink-soft">
      {icon}
      {label}
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${label}`}
        className="ml-0.5 rounded-full p-0.5 text-muted transition-colors hover:bg-surface-sunken hover:text-danger-600 disabled:opacity-40"
      >
        {removing ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
      </button>
    </span>
  );
}

export default function AssignedJDsPage() {
  const profile = useAppSelector(selectCurrentUser);
  const notify = useNotify();
  const [removing, setRemoving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const canManageRecruiters = profile?.role === "super_admin" || profile?.role === "accounts_manager";
  const canManageVendors = profile?.role === "super_admin" || profile?.role === "vendor_manager" || profile?.role === "accounts_manager";

  const { data: rawJobs = [], isLoading, isError, error, refetch } = useGetJobsQuery();
  const { data: usersData = [] } = useGetUsersQuery(undefined, { skip: !canManageRecruiters });
  const { data: vendorsData = [] } = useGetVendorsQuery(undefined, { skip: !canManageVendors });
  const [updateJob] = useUpdateJobMutation();

  const jobs = rawJobs as unknown as AssignedJob[];
  const recruiters: RecruiterInfo[] = usersData
    .filter((u) => u.role === "recruiter")
    .map((u) => ({ id: u.id, full_name: u.full_name || u.email, email: u.email }));
  const vendors: VendorInfo[] = (vendorsData as { id: string; company_name: string }[]).map((v) => ({
    id: v.id,
    company_name: v.company_name,
  }));

  const removeRecruiter = async (jobId: string, recruiterId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const key = `${jobId}-r-${recruiterId}`;
    setRemoving(key);
    try {
      const newIds = (job.assigned_recruiter_ids ?? []).filter((id) => id !== recruiterId);
      await updateJob({ id: jobId, body: { assigned_recruiter_ids: newIds } }).unwrap();
    } catch (err) {
      console.error("Failed to remove recruiter assignment:", err);
      notify.error(getErrorMessage(err, "Couldn't remove the recruiter assignment."));
    } finally {
      setRemoving(null);
    }
  };

  const removeVendor = async (jobId: string, vendorId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    const key = `${jobId}-v-${vendorId}`;
    setRemoving(key);
    try {
      const newIds = (job.assigned_vendor_ids ?? []).filter((id) => id !== vendorId);
      await updateJob({ id: jobId, body: { assigned_vendor_ids: newIds } }).unwrap();
    } catch (err) {
      console.error("Failed to remove vendor assignment:", err);
      notify.error(getErrorMessage(err, "Couldn't remove the vendor assignment."));
    } finally {
      setRemoving(null);
    }
  };

  const getRecruiterLabel = (id: string) => {
    const r = recruiters.find((r) => r.id === id);
    return r ? r.full_name || r.email : id.slice(0, 8) + "…";
  };

  const getVendorLabel = (id: string) => {
    const v = vendors.find((v) => v.id === id);
    return v ? v.company_name : id.slice(0, 8) + "…";
  };

  const filtered = jobs.filter((j) => {
    const hasAssignment = (j.assigned_recruiter_ids?.length ?? 0) > 0 || (j.assigned_vendor_ids?.length ?? 0) > 0;
    if (!hasAssignment) return false;
    if (!search) return true;
    return j.title.toLowerCase().includes(search.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAssigned = filtered.length;
  const totalRecruiterLinks = filtered.reduce((s, j) => s + (j.assigned_recruiter_ids?.length ?? 0), 0);
  const totalVendorLinks = filtered.reduce((s, j) => s + (j.assigned_vendor_ids?.length ?? 0), 0);

  const columns: Column<AssignedJob>[] = [
    {
      key: "title",
      header: "Job title",
      cell: (job) => {
        const count = (job.assigned_recruiter_ids?.length ?? 0) + (job.assigned_vendor_ids?.length ?? 0);
        return (
          <>
            <Link to={`/jobs/${job.id}`} className="block max-w-[240px] truncate font-medium text-ink hover:text-navy-600 hover:underline">
              {job.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted">
              {count} assignment{count !== 1 ? "s" : ""}
            </p>
          </>
        );
      },
      className: "align-top",
    },
    { key: "status", header: "Status", cell: (job) => <JobStatusBadge status={job.status} />, className: "align-top" },
  ];
  if (canManageRecruiters) {
    columns.push({
      key: "recruiters",
      header: "Assigned recruiters",
      className: "align-top",
      cell: (job) =>
        (job.assigned_recruiter_ids?.length ?? 0) === 0 ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {job.assigned_recruiter_ids.map((rid) => (
              <AssignmentChip
                key={rid}
                icon={<Users size={11} className="text-navy-500" aria-hidden="true" />}
                label={getRecruiterLabel(rid)}
                removing={removing === `${job.id}-r-${rid}`}
                onRemove={() => removeRecruiter(job.id, rid)}
              />
            ))}
          </div>
        ),
    });
  }
  if (canManageVendors) {
    columns.push({
      key: "vendors",
      header: "Assigned vendors",
      className: "align-top",
      cell: (job) =>
        (job.assigned_vendor_ids?.length ?? 0) === 0 ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {job.assigned_vendor_ids.map((vid) => (
              <AssignmentChip
                key={vid}
                icon={<Building2 size={11} className="text-brand-600" aria-hidden="true" />}
                label={getVendorLabel(vid)}
                removing={removing === `${job.id}-v-${vid}`}
                onRemove={() => removeVendor(job.id, vid)}
              />
            ))}
          </div>
        ),
    });
  }

  return (
    <>
      <PageHeader
        title="JD assignments"
        subtitle="Track which jobs are assigned to recruiters and vendors"
        actions={
          canManageVendors ? (
            <Link to="/vendors" className={buttonClasses("secondary")}>
              Assign from vendors
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Assigned JDs"
            value={totalAssigned}
            hint="with active assignments"
            loading={isLoading}
            icon={<ClipboardList size={18} aria-hidden="true" />}
          />
          <StatCard
            label="Recruiter links"
            value={totalRecruiterLinks}
            hint="across all jobs"
            loading={isLoading}
            icon={<Users size={18} aria-hidden="true" />}
          />
          <StatCard
            label="Vendor links"
            value={totalVendorLinks}
            hint="across all jobs"
            loading={isLoading}
            tone="brand"
            icon={<Building2 size={18} aria-hidden="true" />}
          />
        </div>

        <div className="relative max-w-md">
          <label htmlFor="assigned-jd-search" className="sr-only">
            Search by job title
          </label>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="assigned-jd-search"
            type="search"
            placeholder="Search by job title…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="zh-input pl-9"
          />
        </div>

        <div className="space-y-3">
          <DataTable
            caption="Job assignments"
            columns={columns}
            rows={isError ? undefined : paginated}
            rowKey={(j) => j.id}
            loading={isLoading}
            error={isError ? error : undefined}
            onRetry={refetch}
            empty={
              search ? (
                <EmptyState
                  compact
                  icon={<Search size={22} aria-hidden="true" />}
                  title="No matching assignments"
                  description={`No assigned job matches "${search}".`}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  compact
                  icon={<ClipboardList size={22} aria-hidden="true" />}
                  title="No assigned JDs yet"
                  description="Use the Assign JD button on the Vendors page to make assignments."
                  action={
                    canManageVendors ? (
                      <Link to="/vendors" className={buttonClasses("secondary", "sm")}>
                        Go to vendors
                      </Link>
                    ) : undefined
                  }
                />
              )
            }
          />

          {!isLoading && !isError && totalPages > 1 && (
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Previous page"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  icon={<ChevronLeft size={15} />}
                />
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={page === p ? "primary" : "ghost"}
                    size="sm"
                    aria-current={page === p ? "page" : undefined}
                    onClick={() => setPage(p)}
                    className="w-8 px-0"
                  >
                    {p}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Next page"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  icon={<ChevronRight size={15} />}
                />
              </div>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
