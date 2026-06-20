import { useState } from "react";
import {
  Search,
  Building2,
  Clock,
  Mail,
  Phone,
  Plus,
  Upload,
  UserCheck,
  ChevronDown,
  X,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
} from "lucide-react";
import Header from "../components/layout/Header";
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
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";
import BulkResumeUploadModal from "../components/bulk/BulkResumeUploadModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn", indeed: "Indeed", naukri: "Naukri", monster: "Monster",
  vendor: "Vendor", referral: "Referral", direct: "Direct", other: "Other",
};

const sourceBadgeColors: Record<string, string> = {
  linkedin: "bg-blue-50 text-blue-700", indeed: "bg-blue-50 text-blue-600",
  naukri: "bg-orange-50 text-orange-700", monster: "bg-purple-50 text-purple-700",
  vendor: "bg-teal-50 text-teal-700", referral: "bg-green-50 text-green-700",
  direct: "bg-gray-100 text-gray-600", other: "bg-gray-100 text-gray-600",
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive
    </span>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({
  onView, onEmail, onDelete,
}: {
  onView: () => void; onEmail: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center gap-1 justify-end">
      <button onClick={onView} title="View profile" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
        <Eye size={14} />
      </button>
      <button onClick={onEmail} title="Send email" className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
        <Mail size={14} />
      </button>
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <MoreHorizontal size={14} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1">
              <button onClick={() => { setOpen(false); onView(); }} className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Eye size={12} /> View Profile
              </button>
              <button onClick={() => { setOpen(false); onEmail(); }} className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Mail size={12} /> Send Email
              </button>
              <hr className="border-gray-100 my-0.5" />
              <button onClick={() => { setOpen(false); onDelete(); }} className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, bg, trend }: {
  icon: React.ComponentType<any>; label: string; value: number | string;
  color: string; bg: string; trend?: number;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
          <Icon size={16} className={color} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function CandidatesPage() {
  const profile = useAppSelector(selectCurrentUser);
  const isVendor = profile?.role === "vendor_user" || profile?.role === "vendor_manager";
  const isRecruiter = profile?.role === "recruiter";

  const { data: candidates = [], isLoading: loading, refetch } = useGetCandidatesQuery();
  const { data: assignedJobs = [] } = useGetJobsQuery(undefined, { skip: !(isVendor || isRecruiter) });
  const [parseResume, { isLoading: resumeParsing }] = useParseResumeMutation();
  const [addCandidateToJob] = useAddCandidateToJobMutation();
  const [createCandidate] = useCreateCandidateMutation();
  const [deleteCandidate] = useDeleteCandidateMutation();

  const { emailToast } = useSendEmail();
  const [composeTarget, setComposeTarget] = useState<Candidate | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expFilter, setExpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedJobId, setSelectedJobId] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    current_title: "", current_company: "", experience_years: 0,
    current_location: "", skills: "", source: "direct",
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");

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
      }));
      setResumeParseMessage("Resume parsed successfully. Review and edit as needed.");
    } catch {
      setResumeParseError("Could not extract data, please fill manually.");
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      alert("Please provide at least an email or phone number.");
      return;
    }
    if ((isVendor || isRecruiter) && !selectedJobId) {
      alert("Please select a job to add this candidate to.");
      return;
    }
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
      setFormData({ first_name: "", last_name: "", email: "", phone: "", current_title: "", current_company: "", experience_years: 0, current_location: "", skills: "", source: "direct" });
      setResumeFile(null);
      setResumeParseMessage(""); setResumeParseError("");
    } catch (error: any) {
      alert(error?.data?.message || error?.message || "Failed to add candidate");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this candidate?")) return;
    try {
      await deleteCandidate(id).unwrap();
      if (viewingCandidate?.id === id) setViewingCandidate(null);
    } catch { alert("Failed to delete candidate"); }
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

  const toggleSelect = (id: string) => setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds((p) => p.size === paginated.length ? new Set() : new Set(paginated.map((c) => c.id)));

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["First Name", "Last Name", "Email", "Phone", "Title", "Company", "Experience", "Location", "Skills", "Source"];
    const rows = filtered.map((c) => [
      c.first_name, c.last_name, c.email, c.phone || "",
      `"${c.current_title || ""}"`, `"${c.current_company || ""}"`,
      c.experience_years, `"${c.current_location || ""}"`,
      `"${c.skills.join(", ")}"`, c.source,
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `candidates_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const activeCount = candidates.filter((c) => c.is_active).length;
  const inactiveCount = candidates.length - activeCount;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Candidates"
        subtitle={`${candidates.length} total candidates · ${selectedIds.size > 0 ? `${selectedIds.size} selected` : "0 selected"}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkUploadOpen(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all shadow-sm"
            >
              <Upload size={15} /> Bulk Upload
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-sm"
            >
              <Plus size={15} /> Add Candidate
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <StatCard icon={Users} label="Total Candidates" value={candidates.length} color="text-blue-600" bg="bg-blue-50" trend={12} />
          <StatCard icon={UserCheck} label="Active" value={activeCount} color="text-emerald-600" bg="bg-emerald-50" trend={8} />
          <StatCard icon={Clock} label="In Process" value={Math.floor(activeCount * 0.4)} color="text-amber-600" bg="bg-amber-50" trend={15} />
          <StatCard icon={Building2} label="Hired" value={Math.floor(candidates.length * 0.05)} color="text-violet-600" bg="bg-violet-50" trend={20} />
          <StatCard icon={X} label="Rejected" value={inactiveCount} color="text-red-500" bg="bg-red-50" trend={-5} />
        </div>

        {/* ── Search + Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, skills, company, title…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            {[
              { value: sourceFilter, set: setSourceFilter, options: [["all", "All Sources"], ...Object.entries(sourceLabels)] },
              { value: expFilter, set: setExpFilter, options: [["all", "All Experience"], ["0-3", "0–3 yrs"], ["3-7", "3–7 yrs"], ["7+", "7+ yrs"]] },
              { value: statusFilter, set: setStatusFilter, options: [["all", "All Status"], ["active", "Active"], ["inactive", "Inactive"]] },
            ].map((f, i) => (
              <div key={i} className="relative">
                <select
                  value={f.value}
                  onChange={(e) => { (f.set as any)(e.target.value); setCurrentPage(1); }}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            ))}
            <button className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              <Filter size={13} /> Filters
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === paginated.length && paginated.length > 0}
              ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < paginated.length; }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700">Select All</span>
            <span className="text-sm text-gray-400">
              Showing <strong className="text-gray-900">{filtered.length}</strong> candidates
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
            >
              <Download size={13} /> Export CSV
            </button>
            <button className="flex items-center gap-1.5 text-xs px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 font-medium">
              <Sparkles size={13} /> AI Match to Job
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <UserCheck size={32} className="text-gray-200" />
              <p className="text-sm text-gray-500 font-medium">No candidates found</p>
              <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginated.length && paginated.length > 0}
                        ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < paginated.length; }}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                    </th>
                    {["CANDIDATE", "EXPERIENCE", "CURRENT ROLE", "SKILLS", "SOURCE", "STATUS", "ADDED ON", "ACTIONS"].map((h) => (
                      <th key={h} className="px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((candidate) => {
                    const color = avatarColor(candidate.first_name + candidate.last_name);
                    const isSelected = selectedIds.has(candidate.id);
                    const dateStr = new Date(candidate.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    return (
                      <tr
                        key={candidate.id}
                        className={`transition-colors hover:bg-gray-50/60 cursor-pointer ${isSelected ? "bg-blue-50/40" : ""}`}
                        onClick={() => setViewingCandidate(candidate)}
                      >
                        <td className="px-4 py-3.5 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(candidate.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 min-w-[200px]">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-xs font-bold text-white">
                                {candidate.first_name.charAt(0)}{candidate.last_name.charAt(0)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {candidate.first_name} {candidate.last_name}
                              </p>
                              <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                <Mail size={9} />{candidate.email}
                                {candidate.phone && <><span className="mx-1">·</span><Phone size={9} />{candidate.phone}</>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                          {candidate.experience_years ? `${candidate.experience_years} Years` : "—"}
                        </td>
                        <td className="px-4 py-3.5 min-w-[160px]">
                          <p className="text-sm text-gray-700 font-medium truncate">{candidate.current_title || "—"}</p>
                          {candidate.current_company && (
                            <p className="text-xs text-gray-400 truncate">{candidate.current_company}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 min-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 3).map((s) => (
                              <span key={s} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{s}</span>
                            ))}
                            {candidate.skills.length > 3 && (
                              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">+{candidate.skills.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${sourceBadgeColors[candidate.source] || "bg-gray-100 text-gray-600"}`}>
                            {sourceLabels[candidate.source] || candidate.source}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge active={candidate.is_active} />
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">{dateStr}</td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            onView={() => setViewingCandidate(candidate)}
                            onEmail={() => setComposeTarget(candidate)}
                            onDelete={() => handleDelete(candidate.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50">
              <p className="text-xs text-gray-500">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} candidates
              </p>
              <div className="flex items-center gap-1.5">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setCurrentPage(p)} className={`w-7 h-7 text-xs font-medium rounded-lg ${p === currentPage ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                    {p}
                  </button>
                ))}
                {totalPages > 5 && <span className="text-xs text-gray-400">…{totalPages}</span>}
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Candidate Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Add New Candidate</h2>
              <button onClick={() => { setIsAddModalOpen(false); setSelectedJobId(""); }} className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCandidate} className="p-7 overflow-y-auto space-y-5">
              {(isVendor || isRecruiter) && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Add to Job *</label>
                  {assignedJobs.length === 0 ? (
                    <p className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                      No jobs are assigned to you yet.
                    </p>
                  ) : (
                    <div className="relative">
                      <select required value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}
                        className="w-full px-4 py-3 pr-10 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                        <option value="">Select a job…</option>
                        {assignedJobs.map((j) => <option key={j.id} value={j.id}>{j.title}{j.client?.name ? ` — ${j.client.name}` : ""}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  ["First Name", "first_name", "text", "e.g. John", true],
                  ["Last Name", "last_name", "text", "e.g. Doe", true],
                  ["Email Address", "email", "email", "john@example.com", false],
                  ["Phone Number", "phone", "text", "+91 XXXXX XXXXX", false],
                  ["Current Title", "current_title", "text", "e.g. Senior Engineer", false],
                  ["Current Company", "current_company", "text", "e.g. Google", false],
                ].map(([label, field, type, placeholder, required]) => (
                  <div key={field as string}>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label as string}</label>
                    <input
                      required={required as boolean}
                      type={type as string}
                      value={(formData as any)[field as string]}
                      onChange={(e) => setFormData((f) => ({ ...f, [field as string]: e.target.value }))}
                      placeholder={placeholder as string}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Skills (comma separated)</label>
                  <input type="text" value={formData.skills} onChange={(e) => setFormData((f) => ({ ...f, skills: e.target.value }))}
                    placeholder="React, Node.js, TypeScript" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Source</label>
                  <div className="relative">
                    <select value={formData.source} onChange={(e) => setFormData((f) => ({ ...f, source: e.target.value }))}
                      className="w-full px-4 py-2.5 pr-10 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      {Object.entries(sourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Upload Resume (PDF/DOC/DOCX)</label>
                <input type="file" accept=".pdf,.doc,.docx"
                  onChange={(e) => { if (e.target.files?.[0]) { const f = e.target.files[0]; setResumeFile(f); parseResumeFile(f); } }}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {resumeFile && <p className="text-xs text-gray-500 mt-1">Selected: {resumeFile.name}</p>}
                {resumeParsing && <p className="text-xs text-blue-600 mt-1">Parsing resume…</p>}
                {resumeParseMessage && <p className="text-xs text-emerald-700 mt-1">{resumeParseMessage}</p>}
                {resumeParseError && <p className="text-xs text-red-600 mt-1">{resumeParseError}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-100">Cancel</button>
                <button type="submit" disabled={resumeParsing || ((isVendor || isRecruiter) && assignedJobs.length === 0)}
                  className="flex-1 py-3 bg-gray-900 text-white font-semibold text-sm rounded-xl hover:bg-gray-800 disabled:opacity-50">
                  {resumeParsing ? "Parsing…" : "Create Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          onClose={() => setIsBulkUploadOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {emailToast && <EmailToast {...emailToast} />}
      {composeTarget && (
        <ComposeEmailModal
          to={composeTarget.email}
          toName={`${composeTarget.first_name} ${composeTarget.last_name}`}
          positionHint={composeTarget.current_title || "the position"}
          onClose={() => setComposeTarget(null)}
        />
      )}
    </div>
  );
}
