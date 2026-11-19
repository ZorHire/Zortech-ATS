import { useState } from "react";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import {
  Plus, Search, MapPin, Users, ChevronDown, Briefcase,
  Building2, Upload, TrendingUp, MoreHorizontal, Trash2, Eye,
  ChevronLeft, ChevronRight, Layers, Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Job } from "../types";
import {
  useGetJobsQuery,
  useGetClientsQuery,
  useCreateJobMutation,
  useUpdateJobMutation,
  useDeleteJobMutation,
  useParseJdMutation,
  useDeleteClientMutation,
} from "../store/api/jobApi";
import PipelineJobSelector from "../components/pipeline/PipelineJobSelector";
import ClientInfoModal from "../components/clients/ClientInfoModal";
import ClientDetailModal from "../components/clients/ClientDetailModal";
import { isLowConfidence, confidenceInputClass, ConfidenceBadge } from "../lib/confidenceIndicator";
import BulkJdUploadModal from "../components/bulk/BulkJdUploadModal";
import { useGetPendingApprovalsQuery } from "../store/api/jdLifecycleApi";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import {
  Badge, Button, EmptyState, ErrorState, Modal, PageHeader, StatCard, TableSkeleton, useConfirm,
} from "../components/ui";
import { JobStatusBadge, PriorityBadge, jobStatusLabel } from "../components/jobs/jobBadges";

/** Statuses that end hiring on a job — changing to these needs confirmation. */
const CLOSING_STATUSES = new Set(["closed_filled", "closed_cancelled"]);

/** Returns an inline validation message for the experience range, or null when valid. */
function experienceRangeError(min: number | "", max: number | ""): string | null {
  if (min === "" || max === "") return "Enter both minimum and maximum experience.";
  if (min < 0 || max < 0) return "Experience cannot be negative.";
  if (min > max) return "Minimum experience cannot be greater than maximum.";
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "closed_filled", label: "Closed - Filled" },
  { value: "closed_cancelled", label: "Closed - Cancelled" },
  { value: "expired", label: "Expired" },
];

const workModeLabel: Record<string, string> = {
  remote: "Remote", hybrid: "Hybrid", onsite: "Onsite",
};

const PAGE_SIZE = 12;

const TH = "border-b border-line px-4 py-2.5 text-left text-xs font-medium text-muted whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-ink";

/** Only add the low-confidence highlight; zh-input supplies the normal border. */
const flagClass = (flagged: boolean) => (flagged ? confidenceInputClass(true) : "");

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusSelect({ job, onStatusChange, readOnly }: { job: Job; onStatusChange: (id: string, s: string) => void; readOnly: boolean }) {
  if (readOnly) return <JobStatusBadge status={job.status} />;
  return (
    <div className="relative inline-flex">
      <select
        value={job.status}
        aria-label={`Status for ${job.title}`}
        onChange={(e) => { e.stopPropagation(); onStatusChange(job.id, e.target.value); }}
        onClick={(e) => e.stopPropagation()}
        className="cursor-pointer appearance-none rounded-lg border border-line bg-white py-1 pl-2.5 pr-7 text-xs font-medium text-ink hover:border-line-strong"
      >
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

function RowMenu({ viewTo, onDelete }: { viewTo: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-end gap-1">
      <Link to={viewTo} title="View job" aria-label="View job" className="rounded-lg p-1.5 text-muted transition-colors hover:bg-navy-50 hover:text-navy-600">
        <Eye size={15} />
      </Link>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More actions"
          aria-expanded={open}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <MoreHorizontal size={15} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-line bg-white py-1 shadow-pop">
              <button
                type="button"
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CLIENT_PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = { High: "danger", Medium: "warning", Low: "neutral" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ClientCard({ client, onDelete, onClick }: { client: any; onDelete: () => void; onClick: () => void }) {
  return (
    <div className="zh-card group relative flex flex-col p-5 transition hover:border-line-strong hover:shadow-md">
      <button type="button" onClick={onClick} className="text-left">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-600 text-base font-semibold text-white">
            {(client.name || "?").charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-ink group-hover:text-navy-600">{client.name}</h3>
            <p className="truncate text-xs text-muted">{client.industry || "—"}</p>
          </div>
          {client.client_priority && (
            <Badge tone={CLIENT_PRIORITY_TONE[client.client_priority] ?? "neutral"}>{client.client_priority}</Badge>
          )}
        </div>
        <div className="space-y-1.5 text-xs text-muted">
          {client.primary_contact_name && (
            <span className="flex items-center gap-1.5"><Users size={12} />{client.primary_contact_name}</span>
          )}
          {client.headquarters_location && (
            <span className="flex items-center gap-1.5"><MapPin size={12} />{client.headquarters_location}</span>
          )}
          {client.primary_contact_email && (
            <span className="flex items-center gap-1.5 truncate"><Building2 size={12} className="shrink-0" />{client.primary_contact_email}</span>
          )}
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        {client.client_type && <Badge tone="navy">{client.client_type}</Badge>}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${client.name}`}
          className="ml-auto rounded-lg p-1.5 text-muted transition hover:bg-danger-50 hover:text-danger-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "", client_id: "", department: "", location: "",
  work_mode: "onsite" as string, employment_type: "full_time",
  experience_min: 0 as number | "", experience_max: 5 as number | "", salary_min: 0, salary_max: 0,
  headcount: 1, priority: "medium" as const, description: "", mandatory_skills: "",
  preferred_skills: "",
};

export default function JobsPage() {
  const profile = useAppSelector(selectCurrentUser);
  const isVendor = profile?.role === "vendor_user" || profile?.role === "vendor_manager";
  const isRecruiter = profile?.role === "recruiter";
  const canManage = !isVendor && !isRecruiter;

  const isApprover = profile?.role === "super_admin" || profile?.role === "accounts_manager";

  const { data: jobs = [], isLoading, isError, error, isFetching, refetch: refetchJobs } = useGetJobsQuery();
  const { data: clients = [], refetch: refetchClients } = useGetClientsQuery();
  const { data: pendingApprovals = [] } = useGetPendingApprovalsQuery(undefined, { skip: !isApprover });
  const [createJob, { isLoading: creatingJob }] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [parseJd] = useParseJdMutation();
  const [deleteClient] = useDeleteClientMutation();
  const notify = useNotify();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tab, setTab] = useState<"jobs" | "clients">("jobs");
  const [page, setPage] = useState(1);

  const [isPipelineSelectorOpen, setIsPipelineSelectorOpen] = useState(false);
  const [isClientInfoOpen, setIsClientInfoOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewingClient, setViewingClient] = useState<any | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkJdUploadOpen, setIsBulkJdUploadOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [jobLowConfidenceFields, setJobLowConfidenceFields] = useState<string[]>([]);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobParsing, setJobParsing] = useState(false);
  const [jobParseMessage, setJobParseMessage] = useState("");
  const [jobParseError, setJobParseError] = useState("");

  const expError = experienceRangeError(formData.experience_min, formData.experience_max);
  const closeAddModal = () => { setIsAddModalOpen(false); setJobFile(null); };

  const parseJDFile = async (file: File) => {
    setJobParsing(true); setJobParseMessage(""); setJobParseError("");
    try {
      const body = new FormData(); body.append("file", file);
      const parsed = await parseJd(body).unwrap();
      setFormData((cur) => ({
        ...cur,
        title: (parsed.title as string) || cur.title,
        location: (parsed.location as string) || cur.location,
        description: (parsed.description as string) || cur.description,
        department: parsed.department || cur.department,
        work_mode: parsed.work_mode || cur.work_mode,
        experience_min: parsed.experience_min !== undefined ? (parsed.experience_min as number) : cur.experience_min,
        experience_max: parsed.experience_max !== undefined ? (parsed.experience_max as number) : cur.experience_max,
        salary_min: parsed.salary_min !== undefined ? (parsed.salary_min as number) : cur.salary_min,
        salary_max: parsed.salary_max !== undefined ? (parsed.salary_max as number) : cur.salary_max,
        mandatory_skills: Array.isArray(parsed.mandatory_skills) && (parsed.mandatory_skills as string[]).length > 0
          ? (parsed.mandatory_skills as string[]).join(", ")
          : Array.isArray(parsed.required_skills) && (parsed.required_skills as string[]).length > 0
          ? (parsed.required_skills as string[]).join(", ") : cur.mandatory_skills,
        preferred_skills: Array.isArray(parsed.preferred_skills) && (parsed.preferred_skills as string[]).length > 0
          ? (parsed.preferred_skills as string[]).join(", ") : cur.preferred_skills,
      }));
      setJobLowConfidenceFields(parsed.low_confidence_fields || []);
      setJobParseMessage("JD parsed successfully. Review and edit the auto-filled details.");
    } catch { setJobParseError("Could not extract data, please fill manually."); }
    finally { setJobParsing(false); }
  };

  const handleAddJD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingJob) return;
    if (expError) { notify.warning(expError); return; }
    try {
      const payload = {
        ...formData,
        experience_min: Number(formData.experience_min),
        experience_max: Number(formData.experience_max),
        mandatory_skills: formData.mandatory_skills.split(",").map((s) => s.trim()).filter(Boolean),
        preferred_skills: formData.preferred_skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      await createJob(payload).unwrap();
      setIsAddModalOpen(false);
      setFormData(EMPTY_FORM);
      setJobLowConfidenceFields([]);
      setJobFile(null);
      notify.success("Job created");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to add job description"));
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!(await confirm({ title: "Delete this job opening?", message: "This cannot be undone.", danger: true, confirmText: "Delete" }))) return;
    try {
      await deleteJob(id).unwrap();
      notify.success("Job deleted");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to delete job"));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (CLOSING_STATUSES.has(newStatus)) {
      const job = jobs.find((j) => j.id === id);
      const label = STATUS_OPTIONS.find((o) => o.value === newStatus)?.label ?? newStatus;
      const ok = await confirm({
        title: `Change "${job?.title ?? "this job"}" to ${label}?`,
        message: "This stops hiring on the job.",
        confirmText: "Change status",
      });
      if (!ok) return;
    }
    try {
      await updateJob({ id, body: { status: newStatus } }).unwrap();
      notify.success("Job status updated");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update status"));
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!(await confirm({ title: "Delete this client?", message: "This cannot be undone.", danger: true, confirmText: "Delete" }))) return;
    try {
      await deleteClient(id).unwrap();
      notify.success("Client deleted");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to delete client"));
    }
  };

  const filtered = jobs.filter((job) => {
    const q = search.toLowerCase();
    const matchSearch = job.title.toLowerCase().includes(q) ||
      job.mandatory_skills.some((s) => s.toLowerCase().includes(q)) ||
      (job.client?.name || "").toLowerCase().includes(q);
    return matchSearch && (statusFilter === "all" || job.status === statusFilter) && (priorityFilter === "all" || job.priority === priorityFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    all: jobs.length,
    active: jobs.filter((j) => j.status === "active").length,
    pending: jobs.filter((j) => j.status === "pending_review").length,
    on_hold: jobs.filter((j) => j.status === "on_hold").length,
    total_candidates: jobs.reduce((s, j) => s + (j.application_count || 0), 0),
  };

  const hasFilters = !!search || statusFilter !== "all" || priorityFilter !== "all";
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setPage(1); };

  const departmentFlagged = isLowConfidence(jobLowConfidenceFields, "department");
  const jdLocationFlagged = isLowConfidence(jobLowConfidenceFields, "location");
  const workModeFlagged = isLowConfidence(jobLowConfidenceFields, "work_mode");
  const mandatorySkillsFlagged = isLowConfidence(jobLowConfidenceFields, "mandatory_skills", "required_skills");
  const preferredSkillsFlagged = isLowConfidence(jobLowConfidenceFields, "preferred_skills");

  const needsReview = <span className={ConfidenceBadge}>needs review</span>;

  return (
    <>
      <PageHeader
        title={isVendor ? "Assigned Jobs" : isRecruiter ? "Your Jobs" : "Jobs & Clients"}
        subtitle={canManage ? `${counts.active} active · ${counts.total_candidates} total candidates` : `${jobs.length} job${jobs.length !== 1 ? "s" : ""}`}
        actions={canManage ? (
          <>
            <Button
              variant="ghost"
              icon={<TrendingUp size={16} />}
              onClick={() => setIsPipelineSelectorOpen(true)}
              disabled={jobs.length === 0}
              title={jobs.length === 0 ? "Create a job first to open its pipeline" : undefined}
            >
              Pipeline
            </Button>
            <Button variant="secondary" icon={<Building2 size={16} />} onClick={() => setIsClientInfoOpen(true)}>
              Add client
            </Button>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setIsBulkJdUploadOpen(true)}>
              Bulk upload
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => setIsAddModalOpen(true)}>
              Create job
            </Button>
          </>
        ) : undefined}
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total JDs" value={counts.all} icon={<Briefcase size={18} />} loading={isLoading} />
          <StatCard label="Active" value={counts.active} hint="Currently hiring" icon={<TrendingUp size={18} />} tone="success" loading={isLoading} />
          <StatCard label="Pending review" value={counts.pending} icon={<Clock size={18} />} tone="brand" loading={isLoading} />
          <StatCard label="Total applicants" value={counts.total_candidates} icon={<Users size={18} />} tone="neutral" loading={isLoading} />
        </div>

        {/* Pending approvals banner — visible to super_admin / accounts_manager only */}
        {isApprover && pendingApprovals.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-warning-50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-warning-700">
                {pendingApprovals.length} JD{pendingApprovals.length !== 1 ? "s" : ""} awaiting your approval
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pendingApprovals.slice(0, 3).map((a) => (
                <Link
                  key={a.job_id}
                  to={`/jobs/${a.job_id}`}
                  className="max-w-[160px] truncate rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-warning-700 transition-colors hover:bg-brand-50"
                >
                  {a.title}
                </Link>
              ))}
              {pendingApprovals.length > 3 && (
                <span className="text-xs font-medium text-warning-700">+{pendingApprovals.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        {canManage && (
          <div role="tablist" className="flex w-fit gap-1 rounded-lg bg-surface-sunken p-1">
            {(["jobs", "clients"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === t ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {t === "jobs" ? `Jobs (${counts.all})` : `Clients (${clients.length})`}
              </button>
            ))}
          </div>
        )}

        {tab === "jobs" ? (
          <>
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  aria-label="Search jobs"
                  placeholder="Search jobs by title, skill, or client…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="zh-input pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Filter by status", value: statusFilter, onChange: (v: string) => { setStatusFilter(v); setPage(1); }, opts: [{ value: "all", label: "All status" }, ...STATUS_OPTIONS] },
                  { label: "Filter by priority", value: priorityFilter, onChange: (v: string) => { setPriorityFilter(v); setPage(1); }, opts: [{ value: "all", label: "All priority" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }] },
                ].map((sel) => (
                  <div key={sel.label} className="relative">
                    <select
                      aria-label={sel.label}
                      value={sel.value}
                      onChange={(e) => sel.onChange(e.target.value)}
                      className="zh-input cursor-pointer appearance-none pr-8"
                    >
                      {sel.opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex flex-wrap gap-2">
              {["all", "active", "pending_review", "on_hold", "closed_filled"].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={statusFilter === s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? "bg-navy-600 text-white" : "border border-line bg-white text-ink-soft hover:border-line-strong"}`}
                >
                  {s === "all" ? `All (${counts.all})` : `${jobStatusLabel(s)} (${jobs.filter((j) => j.status === s).length})`}
                </button>
              ))}
            </div>

            {/* Table */}
            {isLoading ? (
              <TableSkeleton columns={6} />
            ) : isError ? (
              <div className="zh-card">
                <ErrorState error={error} onRetry={refetchJobs} retrying={isFetching} />
              </div>
            ) : paginated.length === 0 ? (
              <div className="zh-card">
                {jobs.length === 0 ? (
                  <EmptyState
                    icon={<Briefcase size={22} />}
                    title="No jobs yet"
                    description={canManage ? "Create a job description to start sourcing candidates." : "Jobs assigned to you will show up here."}
                    action={canManage ? <Button icon={<Plus size={16} />} onClick={() => setIsAddModalOpen(true)}>Create job</Button> : undefined}
                  />
                ) : (
                  <EmptyState
                    icon={<Search size={22} />}
                    title="No jobs match your filters"
                    description="Try a different search or clear the filters."
                    action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
                  />
                )}
              </div>
            ) : (
              <div className="zh-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <caption className="sr-only">Jobs</caption>
                    <thead className="bg-surface">
                      <tr>
                        {["Job title", "Client", "Location / mode", "Priority", "Status", "Headcount", "Applications"].map((h) => (
                          <th key={h} scope="col" className={TH}>{h}</th>
                        ))}
                        <th scope="col" className={`${TH} text-right`}><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((job) => (
                        <tr key={job.id} className="border-b border-line last:border-0 hover:bg-surface">
                          <td className={TD}>
                            <Link to={`/jobs/${job.id}`} className="block max-w-[220px] truncate font-medium text-ink hover:text-navy-600">
                              {job.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">{job.department || "—"}</p>
                          </td>
                          <td className={TD}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-navy-50 text-xs font-semibold text-navy-700">
                                {(job.client?.name || "?").charAt(0)}
                              </div>
                              <span className="max-w-[140px] truncate">{job.client?.name || "—"}</span>
                            </div>
                          </td>
                          <td className={TD}>
                            <div className="flex items-center gap-1 text-xs text-ink-soft"><MapPin size={12} className="text-muted" />{job.location || "—"}</div>
                            <div className="mt-0.5 text-xs text-muted">{workModeLabel[job.work_mode]}</div>
                          </td>
                          <td className={TD}>
                            <PriorityBadge priority={job.priority} />
                          </td>
                          <td className={TD}>
                            <StatusSelect job={job} onStatusChange={handleStatusChange} readOnly={!canManage} />
                          </td>
                          <td className={TD}>
                            <div className="flex items-center gap-1"><Users size={13} className="text-muted" />{job.headcount}</div>
                            <div className="mt-0.5 text-xs text-muted">{job.experience_min}–{job.experience_max} yrs</div>
                          </td>
                          <td className={TD}>
                            <span className="font-semibold text-navy-600">{job.application_count || 0}</span>
                            <span className="ml-1 text-xs text-muted">candidates</span>
                          </td>
                          <td className={`${TD} text-right`}>
                            {canManage ? (
                              <RowMenu viewTo={`/jobs/${job.id}`} onDelete={() => handleDeleteJob(job.id)} />
                            ) : (
                              <Link to={`/jobs/${job.id}`} className="text-sm font-medium text-navy-600 hover:underline">View</Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} jobs
                </p>
                <nav aria-label="Pagination" className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous page"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-xs text-muted">…</span>}
                      <button
                        type="button"
                        aria-current={page === p ? "page" : undefined}
                        onClick={() => setPage(p)}
                        className={`h-8 w-8 rounded-lg text-xs font-medium transition ${page === p ? "bg-navy-600 text-white" : "text-ink-soft hover:bg-surface-sunken"}`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    aria-label="Next page"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </nav>
              </div>
            )}
          </>
        ) : clients.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Layers size={22} />}
              title="No clients yet"
              description="Add a client to start creating jobs for them."
              action={<Button icon={<Building2 size={16} />} onClick={() => setIsClientInfoOpen(true)}>Add client</Button>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {clients.map((client: any) => (
              <ClientCard
                key={client.id}
                client={client}
                onDelete={() => handleDeleteClient(client.id)}
                onClick={() => setViewingClient(client)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {isPipelineSelectorOpen && <PipelineJobSelector jobs={jobs} onClose={() => setIsPipelineSelectorOpen(false)} />}
      {isClientInfoOpen && <ClientInfoModal onClose={() => setIsClientInfoOpen(false)} onSuccess={refetchClients} />}
      {viewingClient && <ClientDetailModal client={viewingClient} onClose={() => setViewingClient(null)} />}
      {isBulkJdUploadOpen && (
        <BulkJdUploadModal
          onClose={() => setIsBulkJdUploadOpen(false)}
          onSuccess={() => refetchJobs()}
        />
      )}

      <Modal
        open={isAddModalOpen}
        onClose={closeAddModal}
        preventClose={creatingJob}
        size="lg"
        title="Create job description"
        description="Upload a JD to auto-fill, or enter the details yourself."
        footer={
          <>
            <Button variant="secondary" onClick={closeAddModal} disabled={creatingJob}>Cancel</Button>
            <Button type="submit" form="create-job-form" loading={creatingJob} loadingText="Saving…" disabled={jobParsing || !!expError}>
              Post job
            </Button>
          </>
        }
      >
        <form id="create-job-form" onSubmit={handleAddJD}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="job-file" className="zh-label">Auto-fill from JD file (PDF/DOC)</label>
              <input
                id="job-file"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => { if (e.target.files?.[0]) { setJobFile(e.target.files[0]); parseJDFile(e.target.files[0]); } }}
                className="zh-input file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-navy-700"
              />
              {jobFile && <p className="mt-1 text-xs text-muted">{jobFile.name}</p>}
              {jobParsing && <p className="mt-1 text-xs text-navy-600">Parsing JD, please wait…</p>}
              {jobParseMessage && <p className="mt-1 text-xs text-success-700">{jobParseMessage}</p>}
              {jobParseError && <p className="mt-1 text-xs text-danger-600">{jobParseError}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="job-title" className="zh-label">Job title</label>
              <input id="job-title" required type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="zh-input" placeholder="e.g. Senior Frontend Engineer" />
            </div>
            <div>
              <label htmlFor="job-client" className="zh-label">Client</label>
              <select id="job-client" required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="zh-input">
                <option value="">Select client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="job-department" className="zh-label">Department{departmentFlagged && needsReview}</label>
              <input id="job-department" type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className={`zh-input ${flagClass(departmentFlagged)}`} placeholder="e.g. Engineering" />
            </div>
            <div>
              <label htmlFor="job-location" className="zh-label">Location{jdLocationFlagged && needsReview}</label>
              <input id="job-location" type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className={`zh-input ${flagClass(jdLocationFlagged)}`} placeholder="e.g. Bangalore, India" />
            </div>
            <div>
              <label htmlFor="job-work-mode" className="zh-label">Work mode{workModeFlagged && needsReview}</label>
              <select id="job-work-mode" value={formData.work_mode} onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })}
                className={`zh-input ${flagClass(workModeFlagged)}`}>
                <option value="onsite">Onsite</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option>
              </select>
            </div>
            <fieldset>
              <legend className="zh-label">Experience (min–max years)</legend>
              <div className="flex items-center gap-2">
                <input type="number" min={0} aria-label="Minimum experience" value={formData.experience_min}
                  onChange={(e) => setFormData({ ...formData, experience_min: e.target.value === "" ? "" : Number(e.target.value) })}
                  aria-invalid={!!expError} aria-describedby={expError ? "job-exp-error" : undefined}
                  className="zh-input" />
                <span className="text-muted">–</span>
                <input type="number" min={0} aria-label="Maximum experience" value={formData.experience_max}
                  onChange={(e) => setFormData({ ...formData, experience_max: e.target.value === "" ? "" : Number(e.target.value) })}
                  aria-invalid={!!expError} aria-describedby={expError ? "job-exp-error" : undefined}
                  className="zh-input" />
              </div>
              {expError && <p id="job-exp-error" className="mt-1 text-xs text-danger-600">{expError}</p>}
            </fieldset>
            <div>
              <label htmlFor="job-priority" className="zh-label">Priority</label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <select id="job-priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="zh-input">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="job-mandatory" className="zh-label">Mandatory skills (comma-separated){mandatorySkillsFlagged && needsReview}</label>
              <input id="job-mandatory" type="text" value={formData.mandatory_skills} onChange={(e) => setFormData({ ...formData, mandatory_skills: e.target.value })}
                className={`zh-input ${flagClass(mandatorySkillsFlagged)}`} placeholder="React, TypeScript, Node.js" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="job-preferred" className="zh-label">Preferred skills (comma-separated){preferredSkillsFlagged && needsReview}</label>
              <input id="job-preferred" type="text" value={formData.preferred_skills} onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                className={`zh-input ${flagClass(preferredSkillsFlagged)}`} placeholder="GraphQL, Kubernetes (good to have)" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="job-description" className="zh-label">Job description</label>
              <textarea id="job-description" rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="zh-input" placeholder="Briefly describe the role and requirements…" />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
