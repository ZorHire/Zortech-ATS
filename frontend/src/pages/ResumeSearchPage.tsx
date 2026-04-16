import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Sparkles,
  MapPin,
  Building2,
  Clock,
  UserCheck,
  Star,
  BookmarkPlus,
  ChevronDown,
  Mail,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  TrendingUp,
  Users,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useResumeSearchStore } from "../store/resumeSearchStore";
import { resumeSearchService } from "../services/resumeSearch.service";
import { Candidate, Job, PipelineStage } from "../types";
import { useSendEmail } from "../hooks/useSendEmail";
import EmailToast from "../components/ui/EmailToast";

// ─── constants ───────────────────────────────────────────────────────────────

const sourceBadgeColors: Record<string, string> = {
  linkedin: "bg-blue-50 text-blue-700",
  indeed: "bg-blue-50 text-blue-600",
  naukri: "bg-orange-50 text-orange-700",
  vendor: "bg-teal-50 text-teal-700",
  referral: "bg-green-50 text-green-700",
  direct: "bg-gray-100 text-gray-600",
  other: "bg-gray-100 text-gray-600",
  monster: "bg-purple-50 text-purple-700",
};

const savedSearches = [
  {
    label: "React + TypeScript, 4+ yrs, Bangalore",
    query: "React TypeScript Node.js",
  },
  {
    label: "Python ML Engineers, Remote OK",
    query: "Python TensorFlow PyTorch",
  },
  {
    label: "Senior Java Backend, Mumbai/Pune",
    query: "Java Spring Boot Microservices",
  },
];

// ─── useDebounce ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Pipeline stages ─────────────────────────────────────────────────────────

const PIPELINE_STAGES: { key: PipelineStage; label: string; color: string }[] =
  [
    { key: "new", label: "New", color: "bg-gray-100 text-gray-700" },
    { key: "sourced", label: "Sourced", color: "bg-blue-50 text-blue-700" },
    { key: "screened", label: "Screened", color: "bg-cyan-50 text-cyan-700" },
    {
      key: "shortlisted",
      label: "Shortlisted",
      color: "bg-violet-50 text-violet-700",
    },
    {
      key: "submitted_to_client",
      label: "Submitted to Client",
      color: "bg-amber-50 text-amber-700",
    },
    {
      key: "client_interview_scheduled",
      label: "Interview Scheduled",
      color: "bg-orange-50 text-orange-700",
    },
    {
      key: "interview_completed",
      label: "Interview Completed",
      color: "bg-purple-50 text-purple-700",
    },
    {
      key: "selected",
      label: "Selected",
      color: "bg-green-50 text-green-700",
    },
    {
      key: "offer_extended",
      label: "Offer Extended",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "offer_accepted",
      label: "Offer Accepted",
      color: "bg-teal-50 text-teal-700",
    },
    { key: "joined", label: "Joined", color: "bg-lime-50 text-lime-700" },
    {
      key: "disqualified",
      label: "Disqualified",
      color: "bg-red-50 text-red-700",
    },
  ];

// ─── AddToPipelineWizard ──────────────────────────────────────────────────────

function AddToPipelineWizard({
  candidates,
  onClose,
}: {
  candidates: Candidate[];
  onClose: () => void;
}) {
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
    resumeSearchService
      .fetchJobs()
      .then((data) => setJobs(data as Job[]))
      .finally(() => setFetching(false));
  }, []);

  const filteredJobs = jobs.filter((j) => {
    const q = jobSearch.toLowerCase();
    const clientName = j.client?.name?.toLowerCase() ?? "";
    const skills = [
      ...(j.mandatory_skills ?? []),
      ...(j.preferred_skills ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return (
      !q ||
      j.title.toLowerCase().includes(q) ||
      clientName.includes(q) ||
      skills.includes(q)
    );
  });

  const handleAdd = async () => {
    if (!selectedJob) return;
    setLoading(true);
    setError("");
    try {
      await Promise.all(
        candidates.map((c) =>
          resumeSearchService.addToPipelineWithStage(
            c.id,
            selectedJob.id,
            selectedStage,
          ),
        ),
      );
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to add to pipeline");
    } finally {
      setLoading(false);
    }
  };

  const statusDotColor = (status: string) => {
    if (status === "active") return "bg-orange-400";
    if (status === "on_hold") return "bg-yellow-400";
    return "bg-red-400";
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step === "stage" && (
              <button
                onClick={() => setStep("job")}
                className="text-gray-400 hover:text-gray-600 -ml-1"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {step === "job" ? "Select a Job" : "Select Pipeline Stage"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === "job"
                  ? "Choose which job's pipeline to view"
                  : `Adding ${candidates.length > 1 ? `${candidates.length} candidates` : `${candidates[0].first_name} ${candidates[0].last_name}`} to ${selectedJob?.title}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-2"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {done ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="font-semibold text-gray-900">Added to pipeline!</p>
              <p className="text-sm text-gray-500 text-center">
                {candidates.length > 1
                  ? `${candidates.length} candidates added to`
                  : `${candidates[0].first_name} ${candidates[0].last_name} added to`}{" "}
                <span className="font-medium text-gray-700">
                  {selectedJob?.title}
                </span>{" "}
                —{" "}
                <span className="font-medium text-gray-700">
                  {PIPELINE_STAGES.find((s) => s.key === selectedStage)?.label}
                </span>{" "}
                stage
              </p>
              <button
                onClick={onClose}
                className="mt-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : step === "job" ? (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search by title, client or skill..."
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-emerald-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                />
              </div>

              {/* Job list */}
              {fetching ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={22} className="animate-spin text-gray-300" />
                </div>
              ) : filteredJobs.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  No jobs found
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredJobs.map((job) => {
                    const isSelected = selectedJob?.id === job.id;
                    const skills = [
                      ...(job.mandatory_skills ?? []),
                      ...(job.preferred_skills ?? []),
                    ].slice(0, 4);
                    return (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                            : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotColor(job.status)}`}
                            />
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {job.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {job.status === "active" && (
                              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                            <TrendingUp
                              size={14}
                              className="text-gray-300 flex-shrink-0"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                          {job.client?.name && (
                            <span className="flex items-center gap-1">
                              <Building2 size={11} />
                              {job.client.name}
                            </span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={11} />
                              {job.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {job.application_count ?? 0} candidates
                          </span>
                        </div>
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Step 2: Stage selection */
            <div className="space-y-2">
              {PIPELINE_STAGES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelectedStage(s.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${
                    selectedStage === s.key
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400"
                      : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium text-gray-800">{s.label}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!done && (
          <div className="px-6 py-4 border-t border-gray-100">
            {error && (
              <p className="text-xs text-red-500 mb-3 text-center">{error}</p>
            )}
            {step === "job" ? (
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {filteredJobs.length} of {jobs.length} jobs shown
                </p>
                <button
                  onClick={() => setStep("stage")}
                  disabled={!selectedJob}
                  className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  Next
                  <ArrowLeft size={14} className="rotate-180" />
                </button>
              </div>
            ) : (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep("job")}
                  className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleAdd}
                  disabled={loading}
                  className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {loading && <Loader2 size={13} className="animate-spin" />}
                  Add
                  {candidates.length > 1
                    ? ` ${candidates.length} Candidates`
                    : ""}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="flex gap-2 mt-2">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
          <div className="flex gap-1.5 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 bg-gray-200 rounded w-14" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  candidate,
  score,
  isSelected,
  onToggle,
  onAddToPipeline,
  onSendEmail,
  emailSending,
}: {
  candidate: Candidate;
  score: number;
  isSelected: boolean;
  onToggle: () => void;
  onAddToPipeline: (candidate: Candidate) => void;
  onSendEmail: (candidate: Candidate) => void;
  emailSending: boolean;
}) {

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
        <div className="flex items-start gap-4">
          <div
            onClick={onToggle}
            className="mt-1 flex-shrink-0 cursor-pointer"
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: "2px solid #d1d5db",
              background: isSelected ? "#2563eb" : "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isSelected && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">
              {candidate.first_name.charAt(0)}
              {candidate.last_name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {candidate.first_name} {candidate.last_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {candidate.current_title} at {candidate.current_company}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                    score >= 85
                      ? "bg-emerald-100 text-emerald-700"
                      : score >= 70
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-600"
                  }`}
                >
                  <Star size={13} className="fill-current" />
                  {score}% match
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-2">
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {candidate.current_location}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {candidate.experience_years} yrs
              </span>
              <span className="flex items-center gap-1">
                <UserCheck size={12} />
                {candidate.notice_period_days}d notice
              </span>
              {candidate.expected_ctc && (
                <span className="flex items-center gap-1">
                  <Building2 size={12} />₹
                  {(Number(candidate.expected_ctc) / 100000).toFixed(0)}L
                  expected
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {candidate.skills.map((skill) => (
                <span
                  key={skill}
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md"
                >
                  {skill}
                </span>
              ))}
            </div>

            {candidate.summary && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                {candidate.summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              sourceBadgeColors[candidate.source] || "bg-gray-100 text-gray-600"
            }`}
          >
            {candidate.source.charAt(0).toUpperCase() +
              candidate.source.slice(1)}
          </span>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
              <BookmarkPlus size={12} />
              Save
            </button>
            <button
              onClick={() => onSendEmail(candidate)}
              disabled={emailSending}
              title="Send email"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Mail size={12} />
              {emailSending ? "Sending…" : "Email"}
            </button>
            <button
              onClick={() => onAddToPipeline(candidate)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <BookmarkPlus size={12} />
              Add to Pipeline
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ResumeSearchPage() {
  const {
    query,
    searchMode,
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
    setSearchMode,
    setFilter,
    search,
    loadMore,
  } = useResumeSearchStore();

  const debouncedQuery = useDebounce(query, 400);
  const isFirstRender = useRef(true);

  // Auto-search on debounced query change (skip mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debouncedQuery.trim()) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Re-search when filters change (only after first search)
  useEffect(() => {
    if (searched) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Infinite scroll sentinel
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wizardCandidates, setWizardCandidates] = useState<Candidate[] | null>(
    null,
  );
  const { sendEmail, sending: emailSending, emailToast } = useSendEmail();

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.candidate.id)));
    }
  };

  const handleBulkEmail = async () => {
    const selected = results
      .filter((r) => selectedIds.has(r.candidate.id))
      .map((r) => r.candidate);
    await Promise.all(
      selected.map((c) => sendEmail(c.email, { firstName: c.first_name })),
    );
  };

  const handleBulkPipeline = () => {
    const selected = results
      .filter((r) => selectedIds.has(r.candidate.id))
      .map((r) => r.candidate);
    if (selected.length > 0) setWizardCandidates(selected);
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingMore && page < totalPages) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadingMore, page, totalPages, loadMore]);

  const handleExport = useCallback(async () => {
    try {
      await resumeSearchService.exportCsv(filters);
    } catch {
      alert("Export failed. Please try again.");
    }
  }, [filters]);

  const runSavedSearch = (savedQuery: string) => {
    setQuery(savedQuery);
    // debounce effect will fire search
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Resume Search"
        subtitle="Search across your entire candidate database"
        actions={
          selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkEmail}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 transition-all font-medium"
              >
                <Mail size={13} />
                <span className="hidden sm:inline">Email</span>
              </button>
              <button
                onClick={handleBulkPipeline}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <BookmarkPlus size={13} />
                <span className="hidden sm:inline">Add to Pipeline</span>
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── search box ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchMode("boolean")}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-all ${
                searchMode === "boolean"
                  ? "bg-slate-100 text-gray-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Boolean Search
            </button>
            <button
              onClick={() => setSearchMode("ai")}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all ${
                searchMode === "ai"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Sparkles size={14} />
              AI Semantic Search
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder={
                  searchMode === "ai"
                    ? 'e.g. "Experienced Java developer with fintech background and strong leadership..."'
                    : "e.g. (React OR Vue) AND TypeScript AND NOT Angular"
                }
                className="w-full pl-9 pr-4 py-3 border border-gray-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => search()}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : searchMode === "ai" ? (
                <>
                  <Sparkles size={16} />
                  Search
                </>
              ) : (
                <>
                  <Search size={16} />
                  Search
                </>
              )}
            </button>
          </div>

          {/* ── filters ── */}
          <div className="flex flex-wrap gap-3 mt-4">
            {(
              [
                {
                  key: "location" as const,
                  label: "Location",
                  options: [
                    "All",
                    "Bangalore",
                    "Mumbai",
                    "Hyderabad",
                    "Delhi",
                    "Pune",
                  ],
                },
                {
                  key: "experience" as const,
                  label: "Experience",
                  options: ["All", "0-3 yrs", "3-7 yrs", "7+ yrs"],
                },
                {
                  key: "noticePeriod" as const,
                  label: "Notice Period",
                  options: ["Any", "< 30 days", "30-60 days", "60+ days"],
                },
              ] as const
            ).map((f) => (
              <div key={f.key} className="relative">
                <select
                  value={filters[f.key]}
                  onChange={(e) => setFilter(f.key, e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {f.label}: {o}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── saved searches (only before first search) ── */}
        {!searched && !loading && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Saved Searches
            </h3>
            <div className="space-y-2">
              {savedSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => runSavedSearch(s.query)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{s.label}</span>
                  <span className="ml-auto text-xs text-blue-600">
                    Run Search
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── skeleton loaders ── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <ResultCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── error state ── */}
        {!loading && error && (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">Search failed</p>
              <p className="text-xs text-gray-500 mt-1">{error}</p>
            </div>
            <button
              onClick={() => search()}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* ── results ── */}
        {!loading && searched && !error && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {total} result{total !== 1 ? "s" : ""} for &ldquo;{query}
                  &rdquo;
                </h3>
                <p className="text-xs text-gray-500">
                  Ranked by{" "}
                  {searchMode === "ai"
                    ? "AI semantic relevance"
                    : "keyword match"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Export
                </button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg mb-2">
                <div
                  onClick={toggleSelectAll}
                  className="cursor-pointer"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: "2px solid #93c5fd",
                    background:
                      selectedIds.size === results.length && results.length > 0
                        ? "#2563eb"
                        : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {selectedIds.size === results.length &&
                    results.length > 0 && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                </div>
                <span className="text-xs text-blue-700 font-medium">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : "Select all"}
                </span>
                {selectedIds.size > 0 && (
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="ml-auto text-xs text-blue-500 hover:text-blue-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* ── empty state ── */}
            {results.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">
                  No results found
                </p>
                <p className="text-xs text-gray-400">
                  Try different keywords or adjust filters
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map(({ candidate, score }) => (
                  <ResultCard
                    key={candidate.id}
                    candidate={candidate}
                    score={score}
                    isSelected={selectedIds.has(candidate.id)}
                    onToggle={() => toggleSelect(candidate.id)}
                    onAddToPipeline={(c) => setWizardCandidates([c])}
                    onSendEmail={(c) =>
                      sendEmail(c.email, { firstName: c.first_name })
                    }
                    emailSending={emailSending}
                  />
                ))}

                {/* infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                  </div>
                )}

                {page >= totalPages && results.length > 0 && (
                  <p className="text-center text-xs text-gray-400 py-2">
                    All {total} results loaded
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add to Pipeline wizard ── */}
      {wizardCandidates && (
        <AddToPipelineWizard
          candidates={wizardCandidates}
          onClose={() => setWizardCandidates(null)}
        />
      )}

      {emailToast && <EmailToast {...emailToast} />}
    </div>
  );
}
