import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Calendar,
  Video,
  PhoneCall,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  useGetInterviewsQuery,
  useUpdateInterviewMutation,
  type Interview,
} from "../store/api/interviewApi";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  StatCard,
  buttonClasses,
} from "../components/ui";
import type { BadgeTone, Column } from "../components/ui";
import { useNotify } from "../hooks/useNotify";

const TYPE_LABELS: Record<string, string> = {
  video: "Video call",
  phone: "Phone",
  face_to_face: "In-person",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={14} aria-hidden="true" />,
  phone: <PhoneCall size={14} aria-hidden="true" />,
  face_to_face: <Users size={14} aria-hidden="true" />,
};

/** Interview status → badge tone, label and icon (one mapping for the page). */
const STATUS: Record<string, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  scheduled: { label: "Scheduled", tone: "navy", icon: <Calendar size={12} aria-hidden="true" /> },
  completed: { label: "Completed", tone: "success", icon: <CheckCircle2 size={12} aria-hidden="true" /> },
  cancelled: { label: "Cancelled", tone: "neutral", icon: <XCircle size={12} aria-hidden="true" /> },
  no_show: { label: "No show", tone: "danger", icon: <AlertCircle size={12} aria-hidden="true" /> },
};
const STATUS_KEYS = Object.keys(STATUS);

type FilterTab = "all" | "upcoming" | "today" | "past";

function formatScheduledAt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isUpcoming(iso: string) {
  return new Date(iso) >= new Date();
}

function StatusControl({
  interview,
  onUpdate,
}: {
  interview: Interview;
  onUpdate: (id: string, status: string) => void;
}) {
  const s = STATUS[interview.status] ?? STATUS.scheduled;
  return (
    <div className="flex items-center gap-2">
      <Badge tone={s.tone} icon={s.icon}>
        {s.label}
      </Badge>
      <select
        aria-label={`Change status for ${interview.first_name ?? ""} ${interview.last_name ?? ""}`.trim()}
        value=""
        onChange={(e) => e.target.value && onUpdate(interview.id, e.target.value)}
        className="h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink-soft hover:border-line-strong"
      >
        <option value="">Change…</option>
        {STATUS_KEYS.filter((k) => k !== interview.status).map((k) => (
          <option key={k} value={k}>
            {STATUS[k].label}
          </option>
        ))}
      </select>
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

export default function InterviewsPage() {
  const notify = useNotify();
  const [filter, setFilter] = React.useState<FilterTab>("upcoming");
  const [feedbackModal, setFeedbackModal] = React.useState<Interview | null>(null);
  const [feedbackScore, setFeedbackScore] = React.useState("");
  const [feedbackNotes, setFeedbackNotes] = React.useState("");
  const [scoreError, setScoreError] = React.useState("");
  const [savingFeedback, setSavingFeedback] = React.useState(false);

  const {
    data: interviews = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetInterviewsQuery();
  const [updateInterview] = useUpdateInterviewMutation();

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateInterview({ id, body: { status } }).unwrap();
      notify.success(`Marked as ${STATUS[status]?.label ?? status}`);
    } catch {
      notify.error("Failed to update status");
    }
  };

  const openFeedback = (iv: Interview) => {
    setFeedbackModal(iv);
    setFeedbackScore(iv.feedback_score != null ? String(iv.feedback_score) : "");
    setFeedbackNotes(iv.feedback_notes ?? "");
    setScoreError("");
  };

  const handleSaveFeedback = async () => {
    if (!feedbackModal) return;
    if (feedbackScore) {
      const n = parseFloat(feedbackScore);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setScoreError("Enter a score between 0 and 10.");
        return;
      }
    }
    setScoreError("");
    setSavingFeedback(true);
    try {
      await updateInterview({
        id: feedbackModal.id,
        body: {
          feedback_score: feedbackScore ? parseFloat(feedbackScore) : undefined,
          feedback_notes: feedbackNotes || undefined,
        },
      }).unwrap();
      notify.success("Feedback saved");
      setFeedbackModal(null);
    } catch {
      notify.error("Failed to save feedback");
    } finally {
      setSavingFeedback(false);
    }
  };

  const filtered = interviews.filter((iv) => {
    if (filter === "today") return isToday(iv.scheduled_at);
    if (filter === "upcoming") return isUpcoming(iv.scheduled_at) && iv.status === "scheduled";
    if (filter === "past") return !isUpcoming(iv.scheduled_at) || iv.status !== "scheduled";
    return true;
  });

  const todayCount = interviews.filter((iv) => isToday(iv.scheduled_at)).length;
  const upcomingCount = interviews.filter(
    (iv) => isUpcoming(iv.scheduled_at) && iv.status === "scheduled",
  ).length;
  const completedCount = interviews.filter((iv) => iv.status === "completed").length;

  const columns: Column<Interview>[] = [
    {
      key: "candidate",
      header: "Candidate",
      cell: (iv) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {iv.first_name} {iv.last_name}
          </p>
          {iv.candidate_email && <p className="truncate text-xs text-muted">{iv.candidate_email}</p>}
        </div>
      ),
    },
    {
      key: "job",
      header: "Job",
      cell: (iv) => <span className="text-ink-soft">{iv.job_title || "—"}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (iv) => (
        <div>
          <span className="flex items-center gap-1.5 text-ink-soft">
            {TYPE_ICONS[iv.interview_type]}
            {TYPE_LABELS[iv.interview_type] ?? iv.interview_type}
          </span>
          {iv.meeting_link && (
            <a
              href={iv.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 text-xs text-navy-600 hover:underline"
            >
              <Link size={11} aria-hidden="true" />
              Join link
            </a>
          )}
        </div>
      ),
    },
    {
      key: "when",
      header: "Date & time",
      className: "whitespace-nowrap",
      cell: (iv) => (
        <span className="text-ink-soft">
          {formatScheduledAt(iv.scheduled_at)}
          {isToday(iv.scheduled_at) && (
            <Badge tone="brand" className="ml-2">
              Today
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      className: "whitespace-nowrap",
      cell: (iv) => <span className="text-muted">{iv.duration_minutes} min</span>,
    },
    {
      key: "interviewer",
      header: "Interviewer",
      cell: (iv) => iv.interviewer_name || <span className="text-muted">—</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (iv) => <StatusControl interview={iv} onUpdate={handleStatusUpdate} />,
    },
    {
      key: "feedback",
      header: "Feedback",
      className: "whitespace-nowrap",
      cell: (iv) =>
        iv.feedback_score != null ? (
          <Button variant="link" size="sm" className="text-xs" onClick={() => openFeedback(iv)}>
            Score: {iv.feedback_score}/10
          </Button>
        ) : (
          <Button variant="link" size="sm" className="text-xs" onClick={() => openFeedback(iv)}>
            + Add feedback
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Interviews"
        subtitle="Manage and track candidate interview schedules"
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            Refresh
          </Button>
        }
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Upcoming"
            value={upcomingCount}
            hint="Scheduled interviews"
            icon={<Calendar size={18} />}
            tone="navy"
            loading={isLoading}
          />
          <StatCard
            label="Today"
            value={todayCount}
            hint="Interviews today"
            icon={<Clock size={18} />}
            tone="brand"
            loading={isLoading}
          />
          <StatCard
            label="Completed"
            value={completedCount}
            hint="Total completed"
            icon={<CheckCircle2 size={18} />}
            tone="success"
            loading={isLoading}
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter interviews"
          className="flex w-full gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-1 sm:w-fit"
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex-1 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                filter === tab.key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataTable
          caption="Interviews"
          columns={columns}
          rows={isError ? undefined : filtered}
          rowKey={(iv) => iv.id}
          loading={isLoading}
          error={isError ? error : undefined}
          onRetry={refetch}
          empty={
            interviews.length === 0 ? (
              <EmptyState
                icon={<Calendar size={22} aria-hidden="true" />}
                title="No interviews yet"
                description="Interviews are scheduled from a candidate's profile or the job pipeline."
                action={
                  <RouterLink to="/candidates" className={buttonClasses("primary")}>
                    Go to candidates
                  </RouterLink>
                }
              />
            ) : (
              <EmptyState
                icon={<Calendar size={22} aria-hidden="true" />}
                title="No interviews in this view"
                description="Try another filter to see the rest of your interviews."
                action={
                  <Button variant="secondary" onClick={() => setFilter("all")}>
                    Show all interviews
                  </Button>
                }
              />
            )
          }
        />
      </div>

      <Modal
        open={!!feedbackModal}
        onClose={() => setFeedbackModal(null)}
        preventClose={savingFeedback}
        title="Interview feedback"
        description={
          feedbackModal
            ? `${feedbackModal.first_name ?? ""} ${feedbackModal.last_name ?? ""}${
                feedbackModal.job_title ? ` — ${feedbackModal.job_title}` : ""
              }`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackModal(null)} disabled={savingFeedback}>
              Cancel
            </Button>
            <Button onClick={handleSaveFeedback} loading={savingFeedback}>
              Save feedback
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="iv-feedback-score" className="zh-label">
              Score (0–10)
            </label>
            <input
              id="iv-feedback-score"
              type="number"
              min="0"
              max="10"
              step="0.5"
              inputMode="decimal"
              value={feedbackScore}
              onChange={(e) => setFeedbackScore(e.target.value)}
              aria-invalid={!!scoreError}
              aria-describedby={scoreError ? "iv-feedback-score-error" : undefined}
              className="zh-input"
              placeholder="e.g. 7.5"
            />
            {scoreError && (
              <p id="iv-feedback-score-error" className="mt-1 text-xs text-danger-600">
                {scoreError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="iv-feedback-notes" className="zh-label">
              Notes
            </label>
            <textarea
              id="iv-feedback-notes"
              rows={4}
              value={feedbackNotes}
              onChange={(e) => setFeedbackNotes(e.target.value)}
              className="zh-input resize-none"
              placeholder="Interview observations, strengths, concerns…"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
