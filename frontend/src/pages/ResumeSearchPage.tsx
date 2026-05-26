import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  MapPin,
  Building2,
  Clock,
  Star,
  BookmarkPlus,
  Mail,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  ArrowLeft,
  CheckCircle2,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Users,
  Tag,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useResumeSearchStore } from "../store/resumeSearchStore";
import { resumeSearchService } from "../services/resumeSearch.service";
import { Candidate, Job, PipelineStage } from "../types";
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";

// ─── constants ───────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, string> = {
  linkedin: "bg-blue-50 text-blue-700",
  indeed: "bg-blue-50 text-blue-600",
  naukri: "bg-orange-50 text-orange-700",
  vendor: "bg-teal-50 text-teal-700",
  referral: "bg-green-50 text-green-700",
  direct: "bg-gray-100 text-gray-600",
  other: "bg-gray-100 text-gray-600",
  monster: "bg-purple-50 text-purple-700",
};

const LOCATION_OPTIONS = ["All", "Bangalore", "Mumbai", "Hyderabad", "Delhi", "Pune", "Chennai", "Noida", "Gurugram"];
const EXPERIENCE_OPTIONS = ["All", "0-2 Years", "2-4 Years", "4-8 Years", "8-12 Years", "12+ Years"];
const NOTICE_OPTIONS = ["Any", "Immediate", "< 15 days", "< 30 days", "30-60 days", "60+ days"];
const SOURCE_OPTIONS = ["All", "LinkedIn", "Naukri", "Indeed", "Monster", "Referral", "Direct", "Vendor"];
const AVAILABILITY_OPTIONS = ["All", "Available", "Open to Offers", "Not Looking"];
const ROLE_OPTIONS = [
  "", "Platform Engineer", "DevOps Engineer", "Software Engineer", "Data Scientist",
  "Product Manager", "Full Stack Developer", "Frontend Developer", "Backend Developer",
  "Cloud Architect", "QA Engineer", "ML Engineer", "Security Engineer",
];

const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "sourced", label: "Sourced" },
  { key: "screened", label: "Screened" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "submitted_to_client", label: "Submitted to Client" },
  { key: "client_interview_scheduled", label: "Interview Scheduled" },
  { key: "interview_completed", label: "Interview Completed" },
  { key: "selected", label: "Selected" },
  { key: "offer_extended", label: "Offer Extended" },
  { key: "offer_accepted", label: "Offer Accepted" },
  { key: "joined", label: "Joined" },
  { key: "disqualified", label: "Disqualified" },
];

function matchColor(score: number) {
  if (score >= 88) return { ring: "ring-emerald-500", bg: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 text-emerald-700" };
  if (score >= 75) return { ring: "ring-blue-500", bg: "bg-blue-500", text: "text-blue-700", badge: "bg-blue-50 text-blue-700" };
  if (score >= 60) return { ring: "ring-amber-500", bg: "bg-amber-500", text: "text-amber-700", badge: "bg-amber-50 text-amber-700" };
  return { ring: "ring-red-400", bg: "bg-red-400", text: "text-red-600", badge: "bg-red-50 text-red-600" };
}

function initials(c: Candidate) {
  return `${c.first_name.charAt(0)}${c.last_name.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Add to Pipeline wizard ──────────────────────────────────────────────────

function AddToPipelineWizard({ candidates, onClose }: { candidates: Candidate[]; onClose: () => void }) {
  const [step, setStep] = useState<"job" | "stage">("job");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedStage, setSelectedStage] = useState<PipelineStage>("new");
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    resumeSearchService.fetchJobs()
      .then((d) => setJobs(d as Job[]))
      .finally(() => setFetching(false));
  }, []);

  const filteredJobs = jobs.filter((j) => {
    const q = jobSearch.toLowerCase();
    return !q || j.title.toLowerCase().includes(q) || (j.client?.name ?? "").toLowerCase().includes(q);
  });

  const handleAdd = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all(
        candidates.map((c) => resumeSearchService.addToPipelineWithStage(c.id, selectedJob.id, selectedStage))
      );
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to add to pipeline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step === "stage" && (
              <button onClick={() => setStep("job")} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">
                {step === "job" ? "Select a Job" : "Select Pipeline Stage"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === "job"
                  ? "Choose which job to add candidates to"
                  : `Adding ${candidates.length} candidate${candidates.length > 1 ? "s" : ""} to ${selectedJob?.title}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {done ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="font-semibold text-gray-900">Added to pipeline!</p>
              <p className="text-sm text-gray-500 text-center">
                {candidates.length > 1 ? `${candidates.length} candidates` : `${candidates[0].first_name} ${candidates[0].last_name}`}
                {" "}added to{" "}
                <span className="font-medium text-gray-700">{selectedJob?.title}</span>
                {" — "}
                <span className="font-medium text-gray-700">
                  {PIPELINE_STAGES.find((s) => s.key === selectedStage)?.label}
                </span>
              </p>
              <button onClick={onClose} className="mt-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
            </div>
          ) : step === "job" ? (
            <>
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs…"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {fetching ? (
                <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No jobs found</p>
              ) : (
                <div className="space-y-2">
                  {filteredJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${selectedJob?.id === job.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === "active" ? "bg-emerald-400" : "bg-gray-300"}`} />
                        <span className="font-medium text-sm text-gray-900 truncate">{job.title}</span>
                      </div>
                      {job.client?.name && (
                        <p className="text-xs text-gray-500 mt-1 ml-4">
                          <Building2 size={10} className="inline mr-1" />{job.client.name}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {PIPELINE_STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelectedStage(s.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${selectedStage === s.key ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-gray-200 hover:border-blue-200"}`}
                >
                  <span className="font-medium text-gray-800">{s.label}</span>
                  {selectedStage === s.key && <CheckCircle2 size={15} className="text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {!done && (
          <div className="px-6 py-4 border-t border-gray-100">
            {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}
            {step === "job" ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{filteredJobs.length} jobs</p>
                <button
                  onClick={() => setStep("stage")}
                  disabled={!selectedJob}
                  className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium"
                >
                  Next <ArrowLeft size={14} className="rotate-180" />
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button onClick={() => setStep("job")} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Back</button>
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  Add {candidates.length > 1 ? `${candidates.length} Candidates` : "Candidate"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top Match Card ───────────────────────────────────────────────────────────

function TopMatchCard({
  candidate,
  score,
  onAddToPipeline,
}: {
  candidate: Candidate;
  score: number;
  onAddToPipeline: (c: Candidate) => void;
}) {
  const mc = matchColor(score);
  const color = avatarColor(candidate.first_name + candidate.last_name);

  return (
    <div className="flex-shrink-0 w-56 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
          <span className="text-xs font-bold text-white">{initials(candidate)}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${mc.badge}`}>{score}% Match</span>
      </div>
      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
        {candidate.first_name} {candidate.last_name}
      </p>
      <p className="text-xs text-gray-500 truncate mt-0.5">{candidate.current_title}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-0.5"><Clock size={10} />{candidate.experience_years} Yrs</span>
        {candidate.current_location && (
          <span className="flex items-center gap-0.5"><MapPin size={10} />{candidate.current_location}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {candidate.skills.slice(0, 3).map((s) => (
          <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s}</span>
        ))}
        {candidate.skills.length > 3 && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">+{candidate.skills.length - 3}</span>
        )}
      </div>
      <button
        onClick={() => onAddToPipeline(candidate)}
        className="w-full mt-3 text-xs py-1.5 bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-medium hover:bg-blue-700"
      >
        Add to Pipeline
      </button>
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-gray-50">
      <td className="px-4 py-3.5 w-10"><div className="w-4 h-4 bg-gray-200 rounded" /></td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div>
            <div className="h-3.5 bg-gray-200 rounded w-28 mb-1.5" />
            <div className="h-2.5 bg-gray-200 rounded w-20" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5"><div className="h-3 bg-gray-200 rounded w-14" /></td>
      <td className="px-4 py-3.5"><div className="h-3 bg-gray-200 rounded w-28" /></td>
      <td className="px-4 py-3.5">
        <div className="flex gap-1">
          <div className="h-5 bg-gray-200 rounded w-12" />
          <div className="h-5 bg-gray-200 rounded w-16" />
        </div>
      </td>
      <td className="px-4 py-3.5"><div className="h-3 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3.5"><div className="h-5 bg-gray-200 rounded w-12" /></td>
      <td className="px-4 py-3.5"><div className="h-3 bg-gray-200 rounded w-16" /></td>
      <td className="px-4 py-3.5 w-20"><div className="h-6 bg-gray-200 rounded w-16" /></td>
    </tr>
  );
}

// ─── Candidate Table Row ──────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  score,
  isSelected,
  onToggle,
  onAddToPipeline,
  onSendEmail,
  emailSending,
  updatedAt,
}: {
  candidate: Candidate;
  score: number;
  isSelected: boolean;
  onToggle: () => void;
  onAddToPipeline: (c: Candidate) => void;
  onSendEmail: (c: Candidate) => void;
  emailSending: boolean;
  updatedAt?: string;
}) {
  const mc = matchColor(score);
  const color = avatarColor(candidate.first_name + candidate.last_name);
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <tr className={`border-b border-gray-50 transition-colors hover:bg-gray-50/60 ${isSelected ? "bg-blue-50/40" : ""}`}>
      <td className="px-4 py-3.5 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
        />
      </td>

      {/* Candidate */}
      <td className="px-4 py-3.5 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
            <span className="text-xs font-bold text-white">{initials(candidate)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {candidate.first_name} {candidate.last_name}
            </p>
            <p className="text-xs text-gray-400 truncate">{candidate.email}</p>
          </div>
        </div>
      </td>

      {/* Experience */}
      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
        {candidate.experience_years ? `${candidate.experience_years} Years` : "—"}
      </td>

      {/* Current Role */}
      <td className="px-4 py-3.5 min-w-[160px]">
        <p className="text-sm text-gray-700 font-medium truncate">{candidate.current_title || "—"}</p>
        {candidate.current_company && (
          <p className="text-xs text-gray-400 truncate">{candidate.current_company}</p>
        )}
      </td>

      {/* Skills */}
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

      {/* Location */}
      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {candidate.current_location || "—"}
      </td>

      {/* Source */}
      <td className="px-4 py-3.5">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${SOURCE_BADGE[candidate.source] || "bg-gray-100 text-gray-600"}`}>
          {candidate.source ? candidate.source.charAt(0).toUpperCase() + candidate.source.slice(1) : "—"}
        </span>
      </td>

      {/* Match */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <div className="relative w-8 h-8">
            <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
              <circle cx="16" cy="16" r="13" fill="none" stroke="#f3f4f6" strokeWidth="3" />
              <circle
                cx="16" cy="16" r="13" fill="none"
                stroke={score >= 88 ? "#10b981" : score >= 75 ? "#3b82f6" : score >= 60 ? "#f59e0b" : "#ef4444"}
                strokeWidth="3"
                strokeDasharray={`${(score / 100) * 82} 82`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${mc.text}`}>
              {score}%
            </span>
          </div>
        </div>
      </td>

      {/* Updated On */}
      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">{dateStr}</td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onSendEmail(candidate)}
            disabled={emailSending}
            title="Send email"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Mail size={14} />
          </button>
          <button
            onClick={() => onAddToPipeline(candidate)}
            title="Add to Pipeline"
            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            <BookmarkPlus size={14} />
          </button>
          <button title="More" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── SelectDropdown ───────────────────────────────────────────────────────────

function SelectDropdown({
  value,
  options,
  onChange,
  placeholder,
  clearable,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const hasValue = value && value !== "All" && value !== "Any" && value !== "";
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors ${hasValue ? "border-blue-300 text-blue-700 bg-blue-50" : "border-gray-200 text-gray-700"}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      {clearable && hasValue && (
        <button
          onClick={() => onChange(options[0])}
          className="absolute right-7 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ─── SkillsTagInput ───────────────────────────────────────────────────────────

function SkillsTagInput({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (s: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (s && !skills.includes(s)) onChange([...skills, s]);
    setInput("");
  };
  return (
    <div className="flex items-center gap-1.5 flex-wrap border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white min-w-[180px] focus-within:ring-2 focus-within:ring-blue-500">
      {skills.map((s) => (
        <span key={s} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
          {s}
          <button onClick={() => onChange(skills.filter((x) => x !== s))} className="hover:text-blue-900"><X size={10} /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(input); }
          if (e.key === "Backspace" && !input && skills.length > 0) onChange(skills.slice(0, -1));
        }}
        placeholder={skills.length === 0 ? "Add skills…" : ""}
        className="text-sm flex-1 min-w-[80px] outline-none bg-transparent placeholder-gray-400"
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResumeSearchPage() {
  const {
    query,
    filters,
    results,
    total,
    page,
    totalPages,
    loading,
    loadingMore,
    error,
    searched,
    setQuery,
    setFilter,
    search,
    loadMore,
  } = useResumeSearchStore();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wizardCandidates, setWizardCandidates] = useState<Candidate[] | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { sendEmail, sending: emailSending, emailToast } = useSendEmail();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // client-side filtered results (skills + source + availability client-side)
  const displayResults = results.filter((r) => {
    const c = r.candidate;
    if (filters.skills.length > 0) {
      const cSkills = c.skills.map((s) => s.toLowerCase());
      const hasAll = filters.skills.every((s) => cSkills.some((cs) => cs.includes(s.toLowerCase())));
      if (!hasAll) return false;
    }
    if (filters.currentRole && c.current_title) {
      if (!c.current_title.toLowerCase().includes(filters.currentRole.toLowerCase())) return false;
    }
    if (filters.source !== "All" && filters.source) {
      if (c.source.toLowerCase() !== filters.source.toLowerCase()) return false;
    }
    return true;
  });

  const topMatches = displayResults.filter((r) => r.score >= 75).slice(0, 8);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayResults.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayResults.map((r) => r.candidate.id)));
  };

  const handleBulkPipeline = () => {
    const selected = displayResults.filter((r) => selectedIds.has(r.candidate.id)).map((r) => r.candidate);
    if (selected.length > 0) setWizardCandidates(selected);
  };

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loadingMore && page < totalPages) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore, page, totalPages, loadMore]);

  const handleExport = useCallback(async () => {
    try {
      await resumeSearchService.exportCsv(filters);
    } catch { alert("Export failed."); }
  }, [filters]);

  const handleClearAll = () => {
    setFilter("location", "All");
    setFilter("experience", "All");
    setFilter("noticePeriod", "Any");
    setFilter("skills", []);
    setFilter("currentRole", "");
    setFilter("source", "All");
    setFilter("availability", "All");
    setQuery("");
  };

  const hasActiveFilters =
    filters.location !== "All" ||
    filters.experience !== "All" ||
    filters.noticePeriod !== "Any" ||
    filters.skills.length > 0 ||
    filters.currentRole !== "" ||
    filters.source !== "All";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Resume Search"
        subtitle="Search across your entire candidate database"
        actions={
          selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
              <button
                onClick={() => Promise.all(
                  displayResults.filter((r) => selectedIds.has(r.candidate.id))
                    .map((r) => sendEmail(r.candidate.email, { firstName: r.candidate.first_name }))
                )}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 font-medium"
              >
                <Mail size={13} /> Email
              </button>
              <button
                onClick={handleBulkPipeline}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <BookmarkPlus size={13} /> Add to Pipeline
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Search Panel ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Search size={16} className="text-blue-600" />
            Search Candidates
          </p>

          {/* Row 1: Keywords, Skills, Current Role, Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            {/* Keywords */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Keywords</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="React OR Vue AND TypeScript"
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Skills */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                <span className="flex items-center gap-1"><Tag size={11} />Skills</span>
              </label>
              <SkillsTagInput
                skills={filters.skills}
                onChange={(s) => setFilter("skills", s)}
              />
            </div>

            {/* Current Role */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Role</label>
              <div className="relative">
                <select
                  value={filters.currentRole}
                  onChange={(e) => setFilter("currentRole", e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                >
                  <option value="">Select role</option>
                  {ROLE_OPTIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Experience</label>
              <SelectDropdown
                value={filters.experience}
                options={EXPERIENCE_OPTIONS}
                onChange={(v) => setFilter("experience", v)}
              />
            </div>
          </div>

          {/* Row 2: Location, Notice Period, Source, Availability */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
              <SelectDropdown
                value={filters.location}
                options={LOCATION_OPTIONS}
                onChange={(v) => setFilter("location", v)}
                clearable
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Notice Period</label>
              <SelectDropdown
                value={filters.noticePeriod}
                options={NOTICE_OPTIONS}
                onChange={(v) => setFilter("noticePeriod", v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Source</label>
              <SelectDropdown
                value={filters.source}
                options={SOURCE_OPTIONS}
                onChange={(v) => setFilter("source", v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Availability</label>
              <SelectDropdown
                value={filters.availability}
                options={AVAILABILITY_OPTIONS}
                onChange={(v) => setFilter("availability", v)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex items-center gap-2 text-sm px-3 py-2 border rounded-lg font-medium transition-colors ${showAdvanced ? "border-blue-300 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              <SlidersHorizontal size={14} />
              Advanced Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleClearAll}
                className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear All
              </button>
              <button
                onClick={() => search()}
                disabled={loading || (!query.trim() && !hasActiveFilters)}
                className="flex items-center gap-2 bg-[#2a1f14] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-[#3d2e1e] transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Search Candidates
              </button>
            </div>
          </div>

          {/* Advanced filters panel */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Min Experience (yrs)</label>
                  <input type="number" min={0} max={30} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 3" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Max CTC (LPA)</label>
                  <input type="number" min={0} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 25" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Work Mode</label>
                  <select className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">Any</option>
                    <option>Remote</option>
                    <option>Hybrid</option>
                    <option>Onsite</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Skeleton ── */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>{[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">Search failed</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
            <button onClick={() => search()} className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* ── Empty pre-search state ── */}
        {!loading && !searched && !error && (
          <div className="flex flex-col items-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
              <Search size={28} className="text-blue-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-700">Search your candidate database</p>
              <p className="text-sm text-gray-400 mt-1">Use keywords, skills, role, or location filters to find the best matches</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["React TypeScript Node.js", "Python Machine Learning", "Java Spring Boot", "DevOps Kubernetes AWS"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); search(); }}
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-full hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && searched && !error && (
          <>
            {/* Result header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                    <Star size={12} className="text-amber-600 fill-amber-600" />
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {total.toLocaleString("en-IN")} Candidates Found
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 ml-8">Showing results for your search</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">
                  <BookmarkPlus size={13} /> Save Search
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                >
                  <Download size={13} /> Export CSV
                </button>
                <div className="relative">
                  <select className="appearance-none text-xs pl-2 pr-7 py-2 border border-gray-200 rounded-lg text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                    <option>Sort by: Relevance</option>
                    <option>Sort by: Experience</option>
                    <option>Sort by: Last Updated</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Top Matches horizontal scroll */}
            {topMatches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Star size={14} className="text-amber-500 fill-amber-500" />
                      Top Matches
                    </p>
                    <p className="text-xs text-gray-400">Best matched candidates based on your search criteria</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline font-medium">View all →</button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                  {topMatches.map(({ candidate, score }) => (
                    <TopMatchCard
                      key={candidate.id}
                      candidate={candidate}
                      score={score}
                      onAddToPipeline={(c) => setWizardCandidates([c])}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All Candidates table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">All Candidates</p>
                {selectedIds.size > 0 && (
                  <p className="text-xs text-blue-600 font-medium">{selectedIds.size} selected</p>
                )}
              </div>

              {displayResults.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users size={24} className="text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">No results found</p>
                  <p className="text-xs text-gray-400">Try different keywords or adjust filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === displayResults.length && displayResults.length > 0}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < displayResults.length;
                            }}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          />
                        </th>
                        {["CANDIDATE", "EXPERIENCE", "CURRENT ROLE", "SKILLS", "LOCATION", "SOURCE", "MATCH", "UPDATED ON", "ACTIONS"].map((h) => (
                          <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayResults.map(({ candidate, score }) => (
                        <CandidateRow
                          key={candidate.id}
                          candidate={candidate}
                          score={score}
                          isSelected={selectedIds.has(candidate.id)}
                          onToggle={() => toggleSelect(candidate.id)}
                          onAddToPipeline={(c) => setWizardCandidates([c])}
                          onSendEmail={(c) => sendEmail(c.email, { firstName: c.first_name })}
                          emailSending={emailSending}
                          updatedAt={(candidate as any).updated_at}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Infinite scroll sentinel + pagination footer */}
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              )}
              {displayResults.length > 0 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Showing 1 to {displayResults.length} of {total.toLocaleString("en-IN")} candidates
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={page <= 1}
                      className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${p === page ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                      >
                        {p}
                      </button>
                    ))}
                    {totalPages > 5 && <span className="text-xs text-gray-400">…</span>}
                    <button
                      disabled={page >= totalPages}
                      onClick={loadMore}
                      className="p-1.5 border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40 hover:bg-gray-50"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <select className="appearance-none text-xs pl-2 pr-6 py-1.5 border border-gray-200 rounded-lg text-gray-500 bg-white ml-1">
                      <option>10 / page</option>
                      <option>20 / page</option>
                      <option>50 / page</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {wizardCandidates && (
        <AddToPipelineWizard candidates={wizardCandidates} onClose={() => setWizardCandidates(null)} />
      )}
      {emailToast && <EmailToast {...emailToast} />}
    </div>
  );
}
