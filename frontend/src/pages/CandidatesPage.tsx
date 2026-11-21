import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { takeDroppedResumes } from "../lib/droppedResumes";
import {
  Search,
  Mail,
  Phone,
  Plus,
  Upload,
  UserCheck,
  UserX,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  ExternalLink,
  Users,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  X,
} from "lucide-react";
import { Candidate } from "../types";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import {
  useGetCandidatesQuery,
  useCreateCandidateMutation,
  useDeleteCandidateMutation,
  useParseResumeMutation,
  useAddCandidateToJobMutation,
} from "../store/api/candidateApi";
import { useGetJobsQuery } from "../store/api/jobApi";
import CandidateModal from "../components/candidates/CandidateModal";
import ComposeEmailModal from "../components/candidates/ComposeEmailModal";
import { isLowConfidence } from "../lib/confidenceIndicator";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import BulkResumeUploadModal from "../components/bulk/BulkResumeUploadModal";
import AddToPipelineModal from "../components/resume-search/AddToPipelineModal";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  StatCard,
  TableSkeleton,
  useConfirm,
} from "../components/ui";
import { Avatar } from "../components/jobs/jobBadges";

// ─── Constants ────────────────────────────────────────────────────────────────

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn", indeed: "Indeed", naukri: "Naukri", monster: "Monster",
  vendor: "Vendor", referral: "Referral", direct: "Direct", other: "Other",
};

/** Quote every field so commas, quotes and newlines survive. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCandidatesCsv(rows: Candidate[], suffix = "") {
  const headers = ["First Name", "Last Name", "Email", "Phone", "Title", "Company", "Experience", "Location", "Skills", "Source"];
  const lines = rows.map((c) =>
    [
      c.first_name, c.last_name, c.email, c.phone || "",
      c.current_title || "", c.current_company || "",
      c.experience_years, c.current_location || "",
      (c.skills ?? []).join(", "), c.source,
    ].map(csvCell).join(","),
  );
  const csv = [headers.map(csvCell).join(","), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `candidates${suffix}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const TH = "border-b border-line px-4 py-2.5 text-left text-xs font-medium text-muted whitespace-nowrap";
const TD = "px-4 py-3 align-middle text-ink";

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({
  name, onView, onEmail, onDelete, onViewFull,
}: {
  name: string; onView: () => void; onEmail: () => void; onDelete: () => void; onViewFull?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const iconBtn = "rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-sunken hover:text-ink";
  const item = "flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink hover:bg-surface";
  return (
    <div className="relative flex items-center justify-end gap-1">
      <button type="button" onClick={onView} title="View profile" aria-label={`View ${name}`} className={iconBtn}>
        <Eye size={15} />
      </button>
      <button type="button" onClick={onEmail} title="Send email" aria-label={`Email ${name}`} className={iconBtn}>
        <Mail size={15} />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`More actions for ${name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className={iconBtn}
        >
          <MoreHorizontal size={15} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-white py-1 shadow-pop">
              <button role="menuitem" onClick={() => { setOpen(false); onView(); }} className={item}>
                <Eye size={14} /> View profile
              </button>
              {onViewFull && (
                <button role="menuitem" onClick={() => { setOpen(false); onViewFull(); }} className={item}>
                  <ExternalLink size={14} /> Full profile
                </button>
              )}
              <button role="menuitem" onClick={() => { setOpen(false); onEmail(); }} className={item}>
                <Mail size={14} /> Send email
              </button>
              <hr className="my-1 border-line" />
              <button
                role="menuitem"
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function CandidatesPage() {
  const navigate = useNavigate();
  const profile = useAppSelector(selectCurrentUser);
  const isVendor = profile?.role === "vendor_user" || profile?.role === "vendor_manager";
  const isRecruiter = profile?.role === "recruiter";

  const { data: candidates = [], isLoading: loading, isFetching, isError, error, refetch } = useGetCandidatesQuery();
  const { data: assignedJobs = [] } = useGetJobsQuery(undefined, { skip: !(isVendor || isRecruiter) });
  const [parseResume, { isLoading: resumeParsing }] = useParseResumeMutation();
  const [addCandidateToJob, { isLoading: addingToJob }] = useAddCandidateToJobMutation();
  const [createCandidate, { isLoading: creating }] = useCreateCandidateMutation();
  const [deleteCandidate] = useDeleteCandidateMutation();
  const savingCandidate = addingToJob || creating;
  const notify = useNotify();
  const confirm = useConfirm();

  const [composeTarget, setComposeTarget] = useState<Candidate | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expFilter, setExpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  // Resumes dropped anywhere in ZorHire arrive here (see ResumeDropZone).
  const [searchParams, setSearchParams] = useSearchParams();
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>();
  useEffect(() => {
    if (searchParams.get("upload") !== "dropped") return;
    const files = takeDroppedResumes();
    if (files.length) { setDroppedFiles(files); setIsBulkUploadOpen(true); }
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [formData, setFormData] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    current_title: "", current_company: "", experience_years: 0,
    current_location: "", skills: "", source: "direct",
    preferred_location: "", notice_period_days: 30, current_ctc: "", expected_ctc: "",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);

  const closeAddModal = () => { setIsAddModalOpen(false); setSelectedJobId(""); };

  const parseResumeFile = async (file: File) => {
    setResumeParseMessage(""); setResumeParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseResume(body).unwrap();
      const p = parsed as any;
      if (!p || (!p.name && !p.email && !p.phone && (!p.skills || p.skills.length === 0))) {
        setResumeParseError("Could not auto-fill from this resume. Please fill in the fields manually.");
        return;
      }
      setFormData((current) => ({
        ...current,
        first_name: p.name?.split(" ")[0] || current.first_name,
        last_name: p.name?.split(" ").slice(1).join(" ") || current.last_name,
        email: p.email || current.email,
        phone: p.phone || current.phone,
        current_title: p.current_title || current.current_title,
        current_company: p.current_company || current.current_company,
        current_location: p.current_location || current.current_location,
        experience_years: p.experience_years !== undefined ? p.experience_years : current.experience_years,
        skills: p.skills?.length > 0 ? p.skills.join(", ") : current.skills,
        preferred_location: p.preferred_location || current.preferred_location,
        notice_period_days: p.notice_period_days !== undefined ? p.notice_period_days : current.notice_period_days,
        current_ctc: p.current_ctc !== undefined ? String(p.current_ctc) : current.current_ctc,
        expected_ctc: p.expected_ctc !== undefined ? String(p.expected_ctc) : current.expected_ctc,
      }));
      setLowConfidenceFields(parsed.low_confidence_fields || []);
      setResumeParseMessage("Resume parsed successfully. Review and edit as needed.");
    } catch {
      setResumeParseError("Could not extract data, please fill manually.");
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      notify.warning("Please provide at least an email or phone number.");
      return;
    }
    if ((isVendor || isRecruiter) && !selectedJobId) {
      notify.warning("Please select a job to add this candidate to.");
      return;
    }
    if (savingCandidate) return;
    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (k === "skills") {
          fd.append(k, JSON.stringify(String(v).split(",").map((s) => s.trim()).filter(Boolean)));
        } else {
          fd.append(k, String(v));
        }
      });
      if (resumeFile) fd.append("resume", resumeFile);

      if (selectedJobId) {
        await addCandidateToJob({ jobId: selectedJobId, body: fd }).unwrap();
      } else {
        await createCandidate(fd).unwrap();
      }

      setIsAddModalOpen(false);
      setSelectedJobId("");
      setFormData({ first_name: "", last_name: "", email: "", phone: "", current_title: "", current_company: "", experience_years: 0, current_location: "", skills: "", source: "direct", preferred_location: "", notice_period_days: 30, current_ctc: "", expected_ctc: "" });
      setLowConfidenceFields([]);
      setResumeFile(null);
      setResumeParseMessage(""); setResumeParseError("");
      notify.success("Candidate added");
    } catch (error: any) {
      notify.error(error?.data?.message || error?.message || "Failed to add candidate");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Delete this candidate?", message: "Their profile and applications will be removed.", danger: true, confirmText: "Delete" }))) return;
    try {
      await deleteCandidate(id).unwrap();
      if (viewingCandidate?.id === id) setViewingCandidate(null);
      notify.success("Candidate deleted");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to delete candidate"));
    }
  };

  // ── Filtering ──
  const filtered = candidates.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.first_name, c.last_name, c.current_title || "", c.current_company || "", ...c.skills].some((v) => v.toLowerCase().includes(q));
    const matchSource = sourceFilter === "all" || c.source === sourceFilter;
    const matchExp = expFilter === "all"
      || (expFilter === "0-3" && c.experience_years <= 3)
      || (expFilter === "3-7" && c.experience_years > 3 && c.experience_years <= 7)
      || (expFilter === "7+" && c.experience_years > 7);
    const matchStatus = statusFilter === "all"
      || (statusFilter === "active" && c.is_active)
      || (statusFilter === "inactive" && !c.is_active);
    return matchSearch && matchSource && matchExp && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds((p) => p.size === paginated.length ? new Set() : new Set(paginated.map((c) => c.id)));

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    downloadCandidatesCsv(filtered);
  };

  // Selection can span pages and filters; resolve it against the full list.
  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
  const clearSelection = () => setSelectedIds(new Set());

  const handleExportSelected = () => {
    if (selectedCandidates.length === 0) return;
    downloadCandidatesCsv(selectedCandidates, "_selected");
    notify.success(`Exported ${selectedCandidates.length} candidate${selectedCandidates.length !== 1 ? "s" : ""}`);
    clearSelection();
  };

  const activeCount = candidates.filter((c) => c.is_active).length;
  const inactiveCount = candidates.length - activeCount;
  const filtersActive = !!search || sourceFilter !== "all" || expFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setSearch(""); setSourceFilter("all"); setExpFilter("all"); setStatusFilter("all"); setCurrentPage(1);
  };
  const allOnPageSelected = selectedIds.size === paginated.length && paginated.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < paginated.length;
  const noJobsToAddTo = (isVendor || isRecruiter) && assignedJobs.length === 0;

  return (
    <>
      <PageHeader
        title="Candidates"
        subtitle={`${candidates.length} total candidates${selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ""}`}
        actions={
          <>
            <Button variant="secondary" onClick={handleExportCSV} disabled={filtered.length === 0} icon={<Download size={15} />}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)} icon={<Upload size={15} />}>
              Bulk upload
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)} icon={<Plus size={15} />}>
              Add candidate
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">

        {/* ── Stat Cards ── */}
        {/* Only counts we can derive from real data; per-stage counts live on the Pipeline page. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<Users size={18} />} label="Total candidates" value={candidates.length} loading={loading} tone="navy" />
          <StatCard icon={<UserCheck size={18} />} label="Active" value={activeCount} loading={loading} tone="success" />
          <StatCard icon={<UserX size={18} />} label="Inactive" value={inactiveCount} loading={loading} tone="neutral" />
        </div>

        {/* ── Search + Filters ── */}
        <div className="zh-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="cand-search" className="sr-only">Search candidates</label>
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="cand-search"
                type="search"
                placeholder="Search by name, skills, company, title…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="zh-input py-2 pl-9"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
              {[
                { label: "Source", value: sourceFilter, set: setSourceFilter, options: [["all", "All sources"], ...Object.entries(sourceLabels)] },
                { label: "Experience", value: expFilter, set: setExpFilter, options: [["all", "All experience"], ["0-3", "0–3 yrs"], ["3-7", "3–7 yrs"], ["7+", "7+ yrs"]] },
                { label: "Status", value: statusFilter, set: setStatusFilter, options: [["all", "All statuses"], ["active", "Active"], ["inactive", "Inactive"]] },
              ].map((f) => (
                <select
                  key={f.label}
                  aria-label={f.label}
                  value={f.value}
                  onChange={(e) => { (f.set as any)(e.target.value); setCurrentPage(1); }}
                  className="zh-input py-2 lg:w-44"
                >
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <TableSkeleton columns={6} />
        ) : isError && candidates.length === 0 ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : candidates.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Users size={22} aria-hidden="true" />}
              title="No candidates yet"
              description="Add a candidate or upload a batch of resumes to build your talent pool."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={() => setIsBulkUploadOpen(true)} icon={<Upload size={15} />}>Bulk upload</Button>
                  <Button onClick={() => setIsAddModalOpen(true)} icon={<Plus size={15} />}>Add candidate</Button>
                </div>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title="No candidates match"
              description="Try a different search or clear the filters."
              action={filtersActive ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          </div>
        ) : (
          <div className="zh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <caption className="sr-only">Candidates</caption>
                <thead className="bg-surface">
                  <tr>
                    <th scope="col" className={`${TH} w-10`}>
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allOnPageSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer rounded border-line-strong text-navy-600"
                      />
                    </th>
                    {["Candidate", "Experience", "Current role", "Skills", "Source", "Status", "Added on"].map((h) => (
                      <th key={h} scope="col" className={TH}>{h}</th>
                    ))}
                    <th scope="col" className={`${TH} text-right`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((candidate) => {
                    const fullName = `${candidate.first_name} ${candidate.last_name}`;
                    const isSelected = selectedIds.has(candidate.id);
                    const dateStr = new Date(candidate.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <tr
                        key={candidate.id}
                        className={`cursor-pointer border-b border-line last:border-0 hover:bg-surface ${isSelected ? "bg-navy-50/50" : ""}`}
                        onClick={() => setViewingCandidate(candidate)}
                      >
                        <td className={`${TD} w-10`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${fullName}`}
                            checked={isSelected}
                            onChange={() => toggleSelect(candidate.id)}
                            className="h-4 w-4 cursor-pointer rounded border-line-strong text-navy-600"
                          />
                        </td>
                        <td className={`${TD} min-w-[220px]`}>
                          <div className="flex items-center gap-3">
                            <Avatar name={fullName} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{fullName}</p>
                              <p className="flex items-center gap-1 truncate text-xs text-muted">
                                <Mail size={11} aria-hidden="true" />{candidate.email}
                                {candidate.phone && <><span className="mx-1">·</span><Phone size={11} aria-hidden="true" />{candidate.phone}</>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} whitespace-nowrap text-ink-soft`}>
                          {candidate.experience_years ? `${candidate.experience_years} yrs` : "—"}
                        </td>
                        <td className={`${TD} min-w-[160px]`}>
                          <p className="truncate text-ink">{candidate.current_title || "—"}</p>
                          {candidate.current_company && (
                            <p className="truncate text-xs text-muted">{candidate.current_company}</p>
                          )}
                        </td>
                        <td className={`${TD} min-w-[180px]`}>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 3).map((s) => (
                              <Badge key={s}>{s}</Badge>
                            ))}
                            {candidate.skills.length > 3 && (
                              <Badge>+{candidate.skills.length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className={TD}>
                          <Badge tone="navy">{sourceLabels[candidate.source] || candidate.source}</Badge>
                        </td>
                        <td className={TD}>
                          {candidate.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-xs text-muted`}>{dateStr}</td>
                        <td className={TD} onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            name={fullName}
                            onView={() => setViewingCandidate(candidate)}
                            onEmail={() => setComposeTarget(candidate)}
                            onDelete={() => handleDelete(candidate.id)}
                            onViewFull={() => navigate(`/candidates/${candidate.id}`)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} candidates
              </p>
              <nav aria-label="Pagination" className="flex items-center gap-1">
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
                    className={`h-7 w-7 rounded-lg text-xs font-medium ${p === currentPage ? "bg-navy-600 text-white" : "text-muted hover:bg-surface-sunken"}`}
                  >
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="px-1 text-xs text-muted">…{totalPages}</span>}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* ── Bulk actions ── */}
        {selectedCandidates.length > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="sticky bottom-4 z-20 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 shadow-pop"
          >
            <p className="mr-auto text-sm font-medium text-ink" aria-live="polite">
              {selectedCandidates.length} selected
            </p>
            <Button size="sm" icon={<Briefcase size={14} />} onClick={() => setBulkAddOpen(true)}>
              Add to job
            </Button>
            <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={handleExportSelected}>
              Export CSV
            </Button>
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={clearSelection}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {bulkAddOpen && (
        <AddToPipelineModal
          candidates={selectedCandidates}
          onAdded={(outcome) => {
            if (outcome.failed.length === 0) clearSelection();
          }}
          onClose={() => setBulkAddOpen(false)}
        />
      )}

      {/* ── Add Candidate Modal ── */}
      <Modal
        open={isAddModalOpen}
        onClose={closeAddModal}
        size="lg"
        preventClose={savingCandidate}
        title="Add new candidate"
        description="Upload a resume to auto-fill, then review the details."
        footer={
          <>
            <Button variant="secondary" onClick={closeAddModal} disabled={savingCandidate}>Cancel</Button>
            <Button
              type="submit"
              form="add-candidate-form"
              disabled={resumeParsing || noJobsToAddTo}
              loading={savingCandidate}
              loadingText="Saving…"
            >
              {resumeParsing ? "Parsing…" : "Create profile"}
            </Button>
          </>
        }
      >
        <form id="add-candidate-form" onSubmit={handleAddCandidate} className="space-y-5">
          {(isVendor || isRecruiter) && (
            <div>
              <label htmlFor="cand-add-job" className="zh-label">Add to job <span className="text-danger-600">*</span></label>
              {assignedJobs.length === 0 ? (
                <p className="rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
                  No jobs are assigned to you yet.
                </p>
              ) : (
                <select id="cand-add-job" required value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)} className="zh-input">
                  <option value="">Select a job…</option>
                  {assignedJobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.client?.name ? ` — ${j.client.name}` : ""}</option>)}
                </select>
              )}
            </div>
          )}

          <div>
            <label htmlFor="cand-add-resume" className="zh-label">Resume (PDF/DOC/DOCX)</label>
            <input
              id="cand-add-resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => { if (e.target.files?.[0]) { const f = e.target.files[0]; setResumeFile(f); parseResumeFile(f); } }}
              className="zh-input file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-navy-700"
            />
            {resumeFile && <p className="mt-1 text-xs text-muted">Selected: {resumeFile.name}</p>}
            {resumeParsing && <p className="mt-1 text-xs text-navy-600" role="status">Parsing resume…</p>}
            {resumeParseMessage && <p className="mt-1 text-xs text-success-700" role="status">{resumeParseMessage}</p>}
            {resumeParseError && <p className="mt-1 text-xs text-danger-600" role="alert">{resumeParseError}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["First name", "first_name", "text", "e.g. John", true, ["name"]],
              ["Last name", "last_name", "text", "e.g. Doe", true, ["name"]],
              ["Email address", "email", "email", "john@example.com", false, []],
              ["Phone number", "phone", "text", "+91 XXXXX XXXXX", false, []],
              ["Current title", "current_title", "text", "e.g. Senior Engineer", false, []],
              ["Current company", "current_company", "text", "e.g. Google", false, []],
              ["Preferred location", "preferred_location", "text", "e.g. Bangalore or Remote", false, []],
              ["Notice period (days)", "notice_period_days", "number", "e.g. 30", false, []],
              ["Current CTC (annual)", "current_ctc", "number", "e.g. 1200000", false, []],
              ["Expected CTC (annual)", "expected_ctc", "number", "e.g. 1500000", false, []],
            ].map(([label, field, type, placeholder, required, aliases]) => {
              const flagged = isLowConfidence(lowConfidenceFields, field as string, ...((aliases as string[]) || []));
              const id = `cand-add-${field as string}`;
              return (
                <div key={field as string}>
                  <label htmlFor={id} className="zh-label">
                    {label as string}
                    {required && <span className="text-danger-600"> *</span>}
                    {flagged && <Badge tone="warning" className="ml-2">Needs review</Badge>}
                  </label>
                  <input
                    id={id}
                    required={required as boolean}
                    type={type as string}
                    value={(formData as any)[field as string]}
                    onChange={(e) => setFormData((f) => ({ ...f, [field as string]: e.target.value }))}
                    placeholder={placeholder as string}
                    className={`zh-input ${flagged ? "border-warning-600 bg-warning-50" : ""}`}
                  />
                </div>
              );
            })}
            {(() => {
              const skillsFlagged = isLowConfidence(lowConfidenceFields, "skills");
              return (
                <div>
                  <label htmlFor="cand-add-skills" className="zh-label">
                    Skills (comma separated)
                    {skillsFlagged && <Badge tone="warning" className="ml-2">Needs review</Badge>}
                  </label>
                  <input
                    id="cand-add-skills"
                    type="text"
                    value={formData.skills}
                    onChange={(e) => setFormData((f) => ({ ...f, skills: e.target.value }))}
                    placeholder="React, Node.js, TypeScript"
                    className={`zh-input ${skillsFlagged ? "border-warning-600 bg-warning-50" : ""}`}
                  />
                </div>
              );
            })()}
            <div>
              <label htmlFor="cand-add-source" className="zh-label">Source</label>
              <select
                id="cand-add-source"
                value={formData.source}
                onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value }))}
                className="zh-input"
              >
                {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {viewingCandidate && (
        <CandidateModal
          candidate={viewingCandidate}
          onClose={() => setViewingCandidate(null)}
          onUpdate={(updated) => { setViewingCandidate(updated); refetch(); }}
          onDelete={handleDelete}
        />
      )}

      {isBulkUploadOpen && (
        <BulkResumeUploadModal
          initialFiles={droppedFiles}
          onClose={() => { setIsBulkUploadOpen(false); setDroppedFiles(undefined); }}
          onSuccess={() => refetch()}
        />
      )}

      {composeTarget && (
        <ComposeEmailModal
          to={composeTarget.email}
          toName={`${composeTarget.first_name} ${composeTarget.last_name}`}
          positionHint={composeTarget.current_title || "the position"}
          onClose={() => setComposeTarget(null)}
        />
      )}
    </>
  );
}
