import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  MapPin,
  Clock,
  Star,
  BookmarkPlus,
  Mail,
  AlertCircle,
  RefreshCw,
  Loader2,
  X,
  Download,
  ChevronDown,
  Users,
  Tag,
} from "lucide-react";
import { useLazySearchCandidatesQuery, buildSearchQueryString } from "../store/api/candidateApi";
import type { SearchParams, SearchSort } from "../store/api/candidateApi";
import { Candidate } from "../types";
import { useSendEmail } from "../hooks/useSendEmail";
import { useNotify } from "../hooks/useNotify";
import { useAppSelector } from "../hooks/useAppSelector";
import EmailToast from "../components/ui/EmailToast";
import AddToPipelineModal from "../components/resume-search/AddToPipelineModal";
import BulkEmailModal from "../components/resume-search/BulkEmailModal";
import { Badge, Button, EmptyState, ErrorState, PageHeader, TableSkeleton } from "../components/ui";
import type { BadgeTone } from "../components/ui";

// ─── constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/v1";

const SOURCE_TONE: Record<string, BadgeTone> = {
  linkedin: "navy",
  indeed: "navy",
  naukri: "brand",
  vendor: "info",
  referral: "success",
  direct: "neutral",
  other: "neutral",
  monster: "info",
};

// Option labels must match the keys handled by the backend search filters.
const LOCATION_OPTIONS = ["All", "Bangalore", "Mumbai", "Hyderabad", "Delhi", "Pune", "Chennai", "Noida", "Gurugram"];
const EXPERIENCE_OPTIONS = ["All", "0-2 Years", "2-4 Years", "4-8 Years", "8-12 Years", "12+ Years"];
const NOTICE_OPTIONS = ["Any", "Immediate", "< 15 days", "< 30 days", "30-60 days", "60+ days"];
const SOURCE_OPTIONS = ["All", "LinkedIn", "Naukri", "Indeed", "Monster", "Referral", "Direct", "Vendor"];
const ROLE_OPTIONS = [
  "Platform Engineer", "DevOps Engineer", "Software Engineer", "Data Scientist",
  "Product Manager", "Full Stack Developer", "Frontend Developer", "Backend Developer",
  "Cloud Architect", "QA Engineer", "ML Engineer", "Security Engineer",
];
const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Sort by: Relevance" },
  { value: "recent", label: "Sort by: Last Updated" },
  { value: "experience", label: "Sort by: Experience" },
];

function matchTone(score: number): BadgeTone {
  if (score >= 88) return "success";
  if (score >= 75) return "navy";
  if (score >= 60) return "warning";
  return "danger";
}

function initials(c: Candidate) {
  return `${c.first_name.charAt(0)}${c.last_name.charAt(0)}`.toUpperCase();
}

// Brand-palette avatar tints (text colour chosen for contrast on each).
const AVATAR_COLORS = [
  "bg-navy-600 text-white",
  "bg-navy-100 text-navy-800",
  "bg-brand-100 text-brand-800",
  "bg-navy-800 text-white",
  "bg-success-50 text-success-700",
  "bg-brand-500 text-ink",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string }; error?: string; message?: string } | undefined;
  return e?.data?.message ?? e?.error ?? e?.message ?? fallback;
}

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {skills.slice(0, 3).map((s) => (
        <span key={s} className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-ink-soft">
          {s}
        </span>
      ))}
      {skills.length > 3 && (
        <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-muted">+{skills.length - 3}</span>
      )}
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
  const color = avatarColor(candidate.first_name + candidate.last_name);

  return (
    <div className="zh-card group flex w-56 flex-shrink-0 flex-col p-4 transition hover:border-line-strong hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${color}`}>
          <span className="text-xs font-semibold">{initials(candidate)}</span>
        </div>
        <Badge tone={matchTone(score)}>{score}% match</Badge>
      </div>
      <p className="truncate text-sm font-semibold leading-tight text-ink">
        {candidate.first_name} {candidate.last_name}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted">{candidate.current_title}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden="true" />
          {candidate.experience_years} yrs
        </span>
        {candidate.current_location && (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            <span className="truncate">{candidate.current_location}</span>
          </span>
        )}
      </div>
      <div className="mt-2">
        <SkillChips skills={candidate.skills} />
      </div>
      <div className="mt-auto pt-3">
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          className="lg:opacity-0 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          icon={<BookmarkPlus size={14} />}
          onClick={() => onAddToPipeline(candidate)}
        >
          Add to pipeline
        </Button>
      </div>
    </div>
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
  const color = avatarColor(candidate.first_name + candidate.last_name);
  const name = `${candidate.first_name} ${candidate.last_name}`;
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <tr className={`border-b border-line transition-colors last:border-0 hover:bg-surface ${isSelected ? "bg-navy-50/60" : ""}`}>
      <td className="w-10 px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          aria-label={`Select ${name}`}
          className="h-4 w-4 cursor-pointer rounded border-line-strong text-navy-600"
        />
      </td>

      <td className="min-w-[200px] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${color}`}>
            <span className="text-xs font-semibold">{initials(candidate)}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{candidate.email}</p>
          </div>
        </div>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">
        {candidate.experience_years ? `${candidate.experience_years} years` : "—"}
      </td>

      <td className="min-w-[160px] px-4 py-3">
        <p className="truncate text-sm font-medium text-ink">{candidate.current_title || "—"}</p>
        {candidate.current_company && <p className="truncate text-xs text-muted">{candidate.current_company}</p>}
      </td>

      <td className="min-w-[180px] px-4 py-3">
        <SkillChips skills={candidate.skills} />
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">{candidate.current_location || "—"}</td>

      <td className="px-4 py-3">
        {candidate.source ? (
          <Badge tone={SOURCE_TONE[candidate.source] ?? "neutral"}>
            {candidate.source.charAt(0).toUpperCase() + candidate.source.slice(1)}
          </Badge>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <Badge tone={matchTone(score)}>{score}%</Badge>
      </td>

      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{dateStr}</td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onSendEmail(candidate)}
            disabled={emailSending}
            title="Send email"
            aria-label={`Send email to ${name}`}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-navy-50 hover:text-navy-600 disabled:opacity-50"
          >
            <Mail size={16} />
          </button>
          <button
            type="button"
            onClick={() => onAddToPipeline(candidate)}
            title="Add to pipeline"
            aria-label={`Add ${name} to pipeline`}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-navy-50 hover:text-navy-600"
          >
            <BookmarkPlus size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── SelectDropdown ───────────────────────────────────────────────────────────

function SelectDropdown({
  id,
  value,
  options,
  onChange,
  placeholder,
  clearable,
}: {
  id?: string;
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
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`zh-input appearance-none py-2 pr-9 ${hasValue ? "border-navy-300 bg-navy-50 text-navy-700" : ""}`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      {clearable && hasValue && (
        <button
          type="button"
          onClick={() => onChange(options[0])}
          aria-label="Clear"
          className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-navy-400 hover:text-navy-700"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── SkillsTagInput ───────────────────────────────────────────────────────────

function SkillsTagInput({
  id,
  skills,
  onChange,
}: {
  id?: string;
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
    <div className="flex min-h-[2.5rem] w-full flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 focus-within:border-navy-600 focus-within:ring-[3px] focus-within:ring-navy-600/20">
      {skills.map((s) => (
        <span key={s} className="flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs text-navy-700">
          {s}
          <button
            type="button"
            onClick={() => onChange(skills.filter((x) => x !== s))}
            aria-label={`Remove ${s}`}
            className="hover:text-navy-900"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addSkill(input);
          }
          if (e.key === "Backspace" && !input && skills.length > 0) onChange(skills.slice(0, -1));
        }}
        placeholder={skills.length === 0 ? "Add skills…" : ""}
        className="min-w-[80px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70 focus-visible:shadow-none"
      />
    </div>
  );
}

// ─── Filter form state ────────────────────────────────────────────────────────

interface FilterForm {
  location: string;
  experience: string;
  noticePeriod: string;
  skills: string[];
  role: string;
  source: string;
}

const DEFAULT_FILTERS: FilterForm = {
  location: "All",
  experience: "All",
  noticePeriod: "Any",
  skills: [],
  role: "",
  source: "All",
};

type ActiveSearch = Omit<SearchParams, "page" | "limit">;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResumeSearchPage() {
  // Draft form values (what the user is editing)
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterForm>({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<SearchSort>("relevance");

  // The search that produced the current results; load-more/export/sort use this
  const [activeSearch, setActiveSearch] = useState<ActiveSearch | null>(null);
  const [results, setResults] = useState<{ candidate: Candidate; score: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wizardCandidates, setWizardCandidates] = useState<Candidate[] | null>(null);
  const [emailCandidates, setEmailCandidates] = useState<Candidate[] | null>(null);
  const { sendEmail, sending: emailSending, emailToast } = useSendEmail();
  const notify = useNotify();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Incremented per new search so late responses from an older search are ignored
  const requestIdRef = useRef(0);

  const [triggerSearch] = useLazySearchCandidatesQuery();

  const setFilter = <K extends keyof FilterForm>(key: K, value: FilterForm[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const formToSearch = (q: string): ActiveSearch => ({
    query: q,
    location: filters.location,
    experience: filters.experience,
    noticePeriod: filters.noticePeriod,
    skills: filters.skills,
    role: filters.role,
    source: filters.source,
    sort,
  });

  /** Start a new search (page 1). Shows the skeleton, clears selection. */
  const runSearch = useCallback(async (params: ActiveSearch) => {
    const id = ++requestIdRef.current;
    setActiveSearch(params);
    setStatus("loading");
    setSearchError(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    setSelectedIds(new Set());
    try {
      const data = await triggerSearch({ ...params, page: 1, limit: PAGE_SIZE }).unwrap();
      if (id !== requestIdRef.current) return;
      setResults(data.results);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setStatus("ready");
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setResults([]);
      setTotal(0);
      setSearchError(errorMessage(err, "Search failed"));
      setStatus("error");
    }
  }, [triggerSearch]);

  /** Append the next page without unmounting the table. */
  const loadMore = useCallback(async () => {
    if (!activeSearch || status !== "ready" || loadingMore || page >= totalPages) return;
    const id = requestIdRef.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await triggerSearch({ ...activeSearch, page: page + 1, limit: PAGE_SIZE }).unwrap();
      if (id !== requestIdRef.current) return;
      setResults((prev) => {
        const seen = new Set(prev.map((r) => r.candidate.id));
        return [...prev, ...data.results.filter((r) => !seen.has(r.candidate.id))];
      });
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (id !== requestIdRef.current) return;
      setLoadMoreError(errorMessage(err, "Could not load more results"));
    } finally {
      if (id === requestIdRef.current) setLoadingMore(false);
    }
  }, [activeSearch, status, loadingMore, page, totalPages, triggerSearch]);

  const handleSearch = () => runSearch(formToSearch(query));

  const handleQuickSearch = (q: string) => {
    setQuery(q);
    runSearch(formToSearch(q));
  };

  const handleSortChange = (value: SearchSort) => {
    setSort(value);
    if (activeSearch) runSearch({ ...activeSearch, sort: value });
  };

  const handleExport = useCallback(async () => {
    if (!activeSearch || exporting) return;
    setExporting(true);
    try {
      const qs = buildSearchQueryString(activeSearch);
      const token = accessToken ?? localStorage.getItem("jwt");
      const res = await fetch(`${API_BASE}/candidates/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidates_export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(errorMessage(err, "Export failed"));
    } finally {
      setExporting(false);
    }
  }, [activeSearch, exporting, accessToken, notify]);

  const handleClearAll = () => {
    requestIdRef.current++;
    setFilters({ ...DEFAULT_FILTERS });
    setQuery("");
    setSort("relevance");
    setActiveSearch(null);
    setResults([]);
    setStatus("idle");
    setSearchError(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    setSelectedIds(new Set());
    setPage(1);
    setTotalPages(1);
    setTotal(0);
  };

  const topMatches = results.filter((r) => r.score >= 75).slice(0, 8);
  const selectedCandidates = results.filter((r) => selectedIds.has(r.candidate.id)).map((r) => r.candidate);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = results.length > 0 && results.every((r) => selectedIds.has(r.candidate.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(results.map((r) => r.candidate.id)));
  };

  // Infinite scroll: auto-load when the sentinel is visible (paused after an error)
  const canLoadMore = status === "ready" && page < totalPages;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !canLoadMore || loadMoreError) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoadMore, loadMoreError, loadMore]);

  const hasActiveFilters =
    filters.location !== "All" ||
    filters.experience !== "All" ||
    filters.noticePeriod !== "Any" ||
    filters.skills.length > 0 ||
    filters.role !== "" ||
    filters.source !== "All";

  const loading = status === "loading";

  return (
    <>
      <PageHeader
        title="Resume search"
        subtitle="Search across your entire candidate database"
        actions={
          selectedCandidates.length > 0 ? (
            <>
              <span className="text-sm text-muted">{selectedCandidates.length} selected</span>
              <Button variant="secondary" icon={<Mail size={16} />} onClick={() => setEmailCandidates(selectedCandidates)}>
                Email
              </Button>
              <Button icon={<BookmarkPlus size={16} />} onClick={() => setWizardCandidates(selectedCandidates)}>
                Add to pipeline
              </Button>
            </>
          ) : null
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* ── Search Panel ── */}
        <section className="zh-card p-4 sm:p-5" aria-labelledby="resume-search-heading">
          <h2 id="resume-search-heading" className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <Search size={16} className="text-navy-600" aria-hidden="true" />
            Search candidates
          </h2>

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="rs-keywords" className="zh-label">
                Keywords
              </label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  id="rs-keywords"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading && (query.trim() || hasActiveFilters)) handleSearch();
                  }}
                  placeholder="React OR Vue AND TypeScript"
                  className="zh-input py-2 pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rs-skills" className="zh-label flex items-center gap-1">
                <Tag size={12} aria-hidden="true" />
                Skills
              </label>
              <SkillsTagInput id="rs-skills" skills={filters.skills} onChange={(s) => setFilter("skills", s)} />
            </div>

            <div>
              <label htmlFor="rs-role" className="zh-label">
                Current role
              </label>
              <div className="relative">
                <select
                  id="rs-role"
                  value={filters.role}
                  onChange={(e) => setFilter("role", e.target.value)}
                  className="zh-input appearance-none py-2 pr-9"
                >
                  <option value="">Any role</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label htmlFor="rs-experience" className="zh-label">
                Experience
              </label>
              <SelectDropdown
                id="rs-experience"
                value={filters.experience}
                options={EXPERIENCE_OPTIONS}
                onChange={(v) => setFilter("experience", v)}
              />
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="rs-location" className="zh-label">
                Location
              </label>
              <SelectDropdown
                id="rs-location"
                value={filters.location}
                options={LOCATION_OPTIONS}
                onChange={(v) => setFilter("location", v)}
                clearable
              />
            </div>
            <div>
              <label htmlFor="rs-notice" className="zh-label">
                Notice period
              </label>
              <SelectDropdown
                id="rs-notice"
                value={filters.noticePeriod}
                options={NOTICE_OPTIONS}
                onChange={(v) => setFilter("noticePeriod", v)}
              />
            </div>
            <div>
              <label htmlFor="rs-source" className="zh-label">
                Source
              </label>
              <SelectDropdown
                id="rs-source"
                value={filters.source}
                options={SOURCE_OPTIONS}
                onChange={(v) => setFilter("source", v)}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="ghost" onClick={handleClearAll}>
              Clear all
            </Button>
            <Button
              onClick={handleSearch}
              disabled={!query.trim() && !hasActiveFilters}
              loading={loading}
              icon={<Search size={16} />}
            >
              Search candidates
            </Button>
          </div>
        </section>

        {/* ── Skeleton (first load of a new search only) ── */}
        {loading && <TableSkeleton rows={5} columns={6} />}

        {/* ── Error ── */}
        {status === "error" && (
          <div className="zh-card">
            <ErrorState
              title="Search failed"
              message={searchError ?? undefined}
              onRetry={activeSearch ? () => runSearch(activeSearch) : undefined}
            />
          </div>
        )}

        {/* ── Empty pre-search state ── */}
        {status === "idle" && (
          <div className="zh-card">
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title="Search your candidate database"
              description="Use keywords, skills, role, or location filters to find the best matches."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {["React TypeScript Node.js", "Python Machine Learning", "Java Spring Boot", "DevOps Kubernetes AWS"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleQuickSearch(q)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-navy-300 hover:bg-navy-50 hover:text-navy-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
        )}

        {/* ── Results ── */}
        {status === "ready" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {total.toLocaleString("en-IN")} candidate{total === 1 ? "" : "s"} found
                </h2>
                <p className="mt-0.5 text-sm text-muted">Showing results for your search</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  disabled={total === 0}
                  loading={exporting}
                  icon={<Download size={14} />}
                >
                  Export CSV
                </Button>
                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => handleSortChange(e.target.value as SearchSort)}
                    aria-label="Sort results"
                    className="h-8 appearance-none rounded-md border border-line bg-white pl-3 pr-8 text-xs font-medium text-ink-soft"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                </div>
              </div>
            </div>

            {topMatches.length > 0 && (
              <section aria-labelledby="rs-top-matches">
                <div className="mb-3">
                  <h3 id="rs-top-matches" className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Star size={14} className="fill-brand-500 text-brand-500" aria-hidden="true" />
                    Top matches
                  </h3>
                  <p className="text-xs text-muted">Best matched candidates based on your search criteria</p>
                </div>
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                  {topMatches.map(({ candidate, score }) => (
                    <TopMatchCard
                      key={candidate.id}
                      candidate={candidate}
                      score={score}
                      onAddToPipeline={(c) => setWizardCandidates([c])}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="zh-card overflow-hidden" aria-labelledby="rs-all-candidates">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <h3 id="rs-all-candidates" className="text-sm font-semibold text-ink">
                  All candidates
                </h3>
                {selectedIds.size > 0 && <p className="text-xs font-medium text-navy-600">{selectedIds.size} selected</p>}
              </div>

              {results.length === 0 ? (
                <EmptyState
                  icon={<Users size={22} aria-hidden="true" />}
                  title="No results found"
                  description="Try different keywords or adjust filters."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                    <caption className="sr-only">Search results</caption>
                    <thead className="bg-surface">
                      <tr className="border-b border-line">
                        <th scope="col" className="w-10 px-4 py-2.5">
                          <input
                            type="checkbox"
                            aria-label="Select all loaded candidates"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = selectedIds.size > 0 && !allSelected;
                            }}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 cursor-pointer rounded border-line-strong text-navy-600"
                          />
                        </th>
                        {["Candidate", "Experience", "Current role", "Skills", "Location", "Source", "Match", "Updated on"].map((h) => (
                          <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted">
                            {h}
                          </th>
                        ))}
                        <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-muted">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(({ candidate, score }) => (
                        <CandidateRow
                          key={candidate.id}
                          candidate={candidate}
                          score={score}
                          isSelected={selectedIds.has(candidate.id)}
                          onToggle={() => toggleSelect(candidate.id)}
                          onAddToPipeline={(c) => setWizardCandidates([c])}
                          onSendEmail={(c) => sendEmail(c.email, { firstName: c.first_name })}
                          emailSending={emailSending}
                          updatedAt={(candidate as Candidate & { updated_at?: string }).updated_at}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted" role="status">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading more…
                </div>
              )}
              {loadMoreError && !loadingMore && (
                <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-4 text-xs">
                  <span className="flex items-center gap-1 text-danger-600" role="alert">
                    <AlertCircle size={14} aria-hidden="true" /> {loadMoreError}
                  </span>
                  <Button variant="secondary" size="sm" onClick={loadMore} icon={<RefreshCw size={12} />}>
                    Retry
                  </Button>
                </div>
              )}
              {results.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
                  <p className="text-xs text-muted">
                    Showing {results.length.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} candidates
                  </p>
                  {canLoadMore && !loadingMore && !loadMoreError && (
                    <Button variant="secondary" size="sm" onClick={loadMore}>
                      Load more
                    </Button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {wizardCandidates && (
        <AddToPipelineModal candidates={wizardCandidates} onClose={() => setWizardCandidates(null)} />
      )}
      {emailCandidates && <BulkEmailModal candidates={emailCandidates} onClose={() => setEmailCandidates(null)} />}
      {emailToast && <EmailToast {...emailToast} />}
    </>
  );
}
