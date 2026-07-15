import { useState } from "react";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import {
  Plus, Search, MapPin, Users, ChevronDown, Briefcase,
  Building2, X, Upload, TrendingUp, MoreHorizontal, Trash2, Eye,
  ChevronLeft, ChevronRight, Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import { jobStatusLabels } from "../lib/mockData";
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

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_review: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-slate-100 text-slate-600",
  closed_filled: "bg-blue-50 text-blue-700",
  closed_cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
};

const priorityConfig: Record<string, { dot: string; label: string; bg: string }> = {
  critical: { dot: "bg-red-500", label: "Critical", bg: "bg-red-50 text-red-700" },
  high: { dot: "bg-orange-500", label: "High", bg: "bg-orange-50 text-orange-700" },
  medium: { dot: "bg-amber-400", label: "Medium", bg: "bg-amber-50 text-amber-700" },
  low: { dot: "bg-green-500", label: "Low", bg: "bg-green-50 text-green-700" },
};

const workModeLabel: Record<string, string> = {
  remote: "Remote", hybrid: "Hybrid", onsite: "Onsite",
};

const PAGE_SIZE = 12;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusSelect({ job, onStatusChange, readOnly }: { job: Job; onStatusChange: (id: string, s: string) => void; readOnly: boolean }) {
  if (readOnly) {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusColors[job.status]}`}>
        {jobStatusLabels[job.status]}
      </span>
    );
  }
  return (
    <div className="relative inline-flex">
      <select
        value={job.status}
        onChange={(e) => { e.stopPropagation(); onStatusChange(job.id, e.target.value); }}
        onClick={(e) => e.stopPropagation()}
        className={`text-[11px] font-semibold pl-2.5 pr-6 py-1 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-blue-400 ${statusColors[job.status]}`}
      >
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
    </div>
  );
}

function RowMenu({ onView, onDelete }: { onView: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-end gap-1">
      <Link to="#" onClick={onView} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
        <Eye size={14} />
      </Link>
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreHorizontal size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1">
              <button onClick={() => { setOpen(false); onDelete(); }}
                className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client, onDelete, onClick }: { client: any; onDelete: () => void; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-violet-200 transition-all text-left group w-full">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {(client.name || "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-violet-700 transition-colors truncate text-sm">{client.name}</h3>
          <p className="text-xs text-gray-400 truncate">{client.industry || "—"}</p>
        </div>
        {client.client_priority && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
            client.client_priority === "High" ? "bg-red-50 text-red-700" :
            client.client_priority === "Medium" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
          }`}>{client.client_priority}</span>
        )}
      </div>
      <div className="space-y-1.5 text-xs text-gray-500">
        {client.primary_contact_name && (
          <span className="flex items-center gap-1.5"><Users size={11} className="text-gray-400" />{client.primary_contact_name}</span>
        )}
        {client.headquarters_location && (
          <span className="flex items-center gap-1.5"><MapPin size={11} className="text-gray-400" />{client.headquarters_location}</span>
        )}
        {client.primary_contact_email && (
          <span className="flex items-center gap-1.5 truncate"><Building2 size={11} className="text-gray-400 flex-shrink-0" />{client.primary_contact_email}</span>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        {client.client_type && (
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold">{client.client_type}</span>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-auto">
          <Trash2 size={12} />
        </button>
      </div>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const profile = useAppSelector(selectCurrentUser);
  const isVendor = profile?.role === "vendor_user" || profile?.role === "vendor_manager";
  const isRecruiter = profile?.role === "recruiter";
  const canManage = !isVendor && !isRecruiter;

  const isApprover = profile?.role === "super_admin" || profile?.role === "accounts_manager";

  const { data: jobs = [], isLoading } = useGetJobsQuery();
  const { data: clients = [], refetch: refetchClients } = useGetClientsQuery();
  const { data: pendingApprovals = [] } = useGetPendingApprovalsQuery(undefined, { skip: !isApprover });
  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();
  const [deleteJob] = useDeleteJobMutation();
  const [parseJd] = useParseJdMutation();
  const [deleteClient] = useDeleteClientMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tab, setTab] = useState<"jobs" | "clients">("jobs");
  const [page, setPage] = useState(1);

  const [isPipelineSelectorOpen, setIsPipelineSelectorOpen] = useState(false);
  const [isClientInfoOpen, setIsClientInfoOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState<any | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkJdUploadOpen, setIsBulkJdUploadOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "", client_id: "", department: "", location: "",
    work_mode: "onsite" as const, employment_type: "full_time",
    experience_min: 0, experience_max: 5, salary_min: 0, salary_max: 0,
    headcount: 1, priority: "medium" as const, description: "", mandatory_skills: "",
    preferred_skills: "",
  });
  const [jobLowConfidenceFields, setJobLowConfidenceFields] = useState<string[]>([]);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [jobParsing, setJobParsing] = useState(false);
  const [jobParseMessage, setJobParseMessage] = useState("");
  const [jobParseError, setJobParseError] = useState("");

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
    try {
      const payload = {
        ...formData,
        mandatory_skills: formData.mandatory_skills.split(",").map((s) => s.trim()).filter(Boolean),
        preferred_skills: formData.preferred_skills.split(",").map((s) => s.trim()).filter(Boolean),
      };
      await createJob(payload).unwrap();
      setIsAddModalOpen(false);
      setFormData({ title: "", client_id: "", department: "", location: "", work_mode: "onsite", employment_type: "full_time", experience_min: 0, experience_max: 5, salary_min: 0, salary_max: 0, headcount: 1, priority: "medium", description: "", mandatory_skills: "", preferred_skills: "" });
      setJobLowConfidenceFields([]);
      setJobFile(null);
    } catch { alert("Failed to add job description"); }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm("Delete this job opening? This cannot be undone.")) return;
    try { await deleteJob(id).unwrap(); }
    catch { alert("Failed to delete job"); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try { await updateJob({ id, body: { status: newStatus } }).unwrap(); }
    catch { alert("Failed to update status"); }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("Delete this client? This cannot be undone.")) return;
    try { await deleteClient(id).unwrap(); }
    catch { alert("Failed to delete client"); }
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

  const departmentFlagged = isLowConfidence(jobLowConfidenceFields, "department");
  const jdLocationFlagged = isLowConfidence(jobLowConfidenceFields, "location");
  const workModeFlagged = isLowConfidence(jobLowConfidenceFields, "work_mode");
  const mandatorySkillsFlagged = isLowConfidence(jobLowConfidenceFields, "mandatory_skills", "required_skills");
  const preferredSkillsFlagged = isLowConfidence(jobLowConfidenceFields, "preferred_skills");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={isVendor ? "Assigned Jobs" : isRecruiter ? "Your Jobs" : "Jobs & Clients"}
        subtitle={canManage ? `${counts.active} active · ${counts.total_candidates} total candidates` : `${jobs.length} job${jobs.length !== 1 ? "s" : ""}`}
        actions={canManage ? (
          <div className="flex gap-2">
            <button onClick={() => jobs.length > 0 && setIsPipelineSelectorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all">
              <TrendingUp size={15} /> Pipeline
            </button>
            <button onClick={() => setIsClientInfoOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all">
              <Building2 size={15} /> Add Client
            </button>
            <button onClick={() => setIsBulkJdUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all">
              <Upload size={15} /> Bulk Upload
            </button>
            <button onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#111111] text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all">
              <Plus size={15} /> Add JD
            </button>
          </div>
        ) : undefined}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total JDs" value={counts.all} color="text-gray-900" />
          <StatCard label="Active" value={counts.active} sub="currently hiring" color="text-emerald-600" />
          <StatCard label="Pending Review" value={counts.pending} color="text-amber-600" />
          <StatCard label="Total Applicants" value={counts.total_candidates} color="text-blue-600" />
        </div>

        {/* Pending approvals banner — visible to super_admin / accounts_manager only */}
        {isApprover && pendingApprovals.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-sm font-semibold text-amber-800">
                {pendingApprovals.length} JD{pendingApprovals.length !== 1 ? "s" : ""} awaiting your approval
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {pendingApprovals.slice(0, 3).map((a) => (
                <Link
                  key={a.job_id}
                  to={`/jobs/${a.job_id}`}
                  className="text-xs bg-white border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition-colors max-w-[160px] truncate"
                >
                  {a.title}
                </Link>
              ))}
              {pendingApprovals.length > 3 && (
                <span className="text-xs text-amber-600 font-medium">
                  +{pendingApprovals.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        {canManage && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {(["jobs", "clients"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                {t === "jobs" ? `Jobs (${counts.all})` : `Clients (${clients.length})`}
              </button>
            ))}
          </div>
        )}

        {tab === "jobs" ? (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search jobs by title, skill, or client…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: statusFilter, onChange: (v: string) => { setStatusFilter(v); setPage(1); }, opts: [{ value: "all", label: "All Status" }, ...STATUS_OPTIONS] },
                  { value: priorityFilter, onChange: (v: string) => { setPriorityFilter(v); setPage(1); }, opts: [{ value: "all", label: "All Priority" }, { value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }] },
                ].map((sel, i) => (
                  <div key={i} className="relative">
                    <select value={sel.value} onChange={(e) => sel.onChange(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                      {sel.opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick filter pills */}
            <div className="flex gap-2 flex-wrap">
              {["all", "active", "pending_review", "on_hold", "closed_filled"].map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${statusFilter === s ? "bg-[#111111] text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"}`}>
                  {s === "all" ? `All (${counts.all})` : `${jobStatusLabels[s]} (${jobs.filter((j) => j.status === s).length})`}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : paginated.length === 0 ? (
                <div className="text-center py-16">
                  <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-semibold">No jobs found</p>
                  <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Job Title", "Client", "Location / Mode", "Priority", "Status", "Headcount", "Applications", "Actions"].map((h) => (
                          <th key={h} className="px-4 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginated.map((job) => {
                        const pc = priorityConfig[job.priority] || priorityConfig.medium;
                        return (
                          <tr key={job.id} className="hover:bg-gray-50/60 transition-colors group">
                            <td className="px-4 py-3.5">
                              <Link to={`/jobs/${job.id}`} className="font-semibold text-sm text-gray-900 hover:text-blue-600 transition-colors block max-w-[200px] truncate">
                                {job.title}
                              </Link>
                              <p className="text-xs text-gray-400 mt-0.5">{job.department || "—"}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {(job.client?.name || "?").charAt(0)}
                                </div>
                                <span className="text-sm text-gray-700 max-w-[120px] truncate">{job.client?.name || "—"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs text-gray-600 flex items-center gap-1"><MapPin size={11} />{job.location}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{workModeLabel[job.work_mode]}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${pc.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                                {pc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusSelect job={job} onStatusChange={handleStatusChange} readOnly={!canManage} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 text-sm text-gray-700">
                                <Users size={13} className="text-gray-400" />
                                {job.headcount}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{job.experience_min}–{job.experience_max} yrs</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-sm font-bold text-blue-600">{job.application_count || 0}</span>
                              <span className="text-xs text-gray-400 ml-1">candidates</span>
                            </td>
                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              {canManage ? (
                                <RowMenu onView={() => {}} onDelete={() => handleDeleteJob(job.id)} />
                              ) : (
                                <Link to={`/jobs/${job.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} jobs
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400 text-xs">…</span>}
                      <button onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === p ? "bg-[#111111] text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                        {p}
                      </button>
                    </span>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          clients.length === 0 ? (
            <div className="text-center py-20">
              <Layers size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-semibold">No clients yet</p>
              <p className="text-gray-400 text-sm mt-1">Add a client to get started</p>
              <button onClick={() => setIsClientInfoOpen(true)}
                className="mt-4 px-4 py-2 bg-[#111111] text-white rounded-xl text-sm font-bold hover:opacity-90">
                Add Client
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {clients.map((client: any) => (
                <ClientCard key={client.id} client={client}
                  onDelete={() => handleDeleteClient(client.id)}
                  onClick={() => setViewingClient(client)} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {isPipelineSelectorOpen && <PipelineJobSelector jobs={jobs} onClose={() => setIsPipelineSelectorOpen(false)} />}
      {isClientInfoOpen && <ClientInfoModal onClose={() => setIsClientInfoOpen(false)} onSuccess={refetchClients} />}
      {viewingClient && <ClientDetailModal client={viewingClient} onClose={() => setViewingClient(null)} />}
      {isBulkJdUploadOpen && (
        <BulkJdUploadModal
          onClose={() => setIsBulkJdUploadOpen(false)}
          onSuccess={() => {}}
        />
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-black text-[#111111] tracking-tight">Create New Job Description</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-[#111111]">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddJD} className="p-8 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Job Title</label>
                  <input required type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Senior Frontend Engineer" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Client</label>
                  <select required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="">Select Client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Department
                    {departmentFlagged && <span className={ConfidenceBadge}>needs review</span>}
                  </label>
                  <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${confidenceInputClass(departmentFlagged)}`} placeholder="e.g. Engineering" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Location
                    {jdLocationFlagged && <span className={ConfidenceBadge}>needs review</span>}
                  </label>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${confidenceInputClass(jdLocationFlagged)}`} placeholder="e.g. Bangalore, India" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Work Mode
                    {workModeFlagged && <span className={ConfidenceBadge}>needs review</span>}
                  </label>
                  <select value={formData.work_mode} onChange={(e) => setFormData({ ...formData, work_mode: e.target.value as any })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none ${confidenceInputClass(workModeFlagged)}`}>
                    <option value="onsite">Onsite</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Experience (Min–Max yrs)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={formData.experience_min} onChange={(e) => setFormData({ ...formData, experience_min: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-gray-400">—</span>
                    <input type="number" value={formData.experience_max} onChange={(e) => setFormData({ ...formData, experience_max: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Priority</label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Mandatory Skills (comma-separated)
                    {mandatorySkillsFlagged && <span className={ConfidenceBadge}>needs review</span>}
                  </label>
                  <input type="text" value={formData.mandatory_skills} onChange={(e) => setFormData({ ...formData, mandatory_skills: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${confidenceInputClass(mandatorySkillsFlagged)}`} placeholder="React, TypeScript, Node.js" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Preferred Skills (comma-separated)
                    {preferredSkillsFlagged && <span className={ConfidenceBadge}>needs review</span>}
                  </label>
                  <input type="text" value={formData.preferred_skills} onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${confidenceInputClass(preferredSkillsFlagged)}`} placeholder="GraphQL, Kubernetes (good to have)" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Job Description</label>
                  <textarea rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Briefly describe the role and requirements…" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Upload JD File (Auto-fill from PDF/DOC)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => { if (e.target.files?.[0]) { setJobFile(e.target.files[0]); parseJDFile(e.target.files[0]); } }}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none" />
                  {jobFile && <p className="text-xs text-gray-500">{jobFile.name}</p>}
                  {jobParsing && <p className="text-xs text-blue-600">Parsing JD, please wait…</p>}
                  {jobParseMessage && <p className="text-xs text-emerald-700">{jobParseMessage}</p>}
                  {jobParseError && <p className="text-xs text-red-600">{jobParseError}</p>}
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => { setIsAddModalOpen(false); setJobFile(null); }}
                  className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:opacity-90 shadow-xl shadow-gray-200">
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
