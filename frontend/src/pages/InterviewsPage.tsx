import React from "react";
import {
  Calendar,
  Video,
  PhoneCall,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Link,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  useGetInterviewsQuery,
  useUpdateInterviewMutation,
  type Interview,
} from "../store/api/interviewApi";

const TYPE_LABELS: Record<string, string> = {
  video: "Video Call",
  phone: "Phone",
  face_to_face: "In-Person",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={14} />,
  phone: <PhoneCall size={14} />,
  face_to_face: <Users size={14} />,
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  no_show: "bg-red-50 text-red-600 border-red-100",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Calendar size={12} />,
  completed: <CheckCircle2 size={12} />,
  cancelled: <XCircle size={12} />,
  no_show: <AlertCircle size={12} />,
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

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

function StatusDropdown({
  interview,
  onUpdate,
}: {
  interview: Interview;
  onUpdate: (id: string, status: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = ["scheduled", "completed", "cancelled", "no_show"].filter(
    (s) => s !== interview.status,
  );

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[interview.status]}`}
      >
        {STATUS_ICONS[interview.status]}
        {STATUS_LABELS[interview.status]}
        <ChevronDown size={11} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute z-20 right-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          {options.map((s) => (
            <button
              key={s}
              onClick={() => {
                onUpdate(interview.id, s);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left"
            >
              {STATUS_ICONS[s]}
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InterviewsPage() {
  const [filter, setFilter] = React.useState<FilterTab>("upcoming");
  const [feedbackModal, setFeedbackModal] = React.useState<Interview | null>(null);
  const [feedbackScore, setFeedbackScore] = React.useState("");
  const [feedbackNotes, setFeedbackNotes] = React.useState("");
  const [savingFeedback, setSavingFeedback] = React.useState(false);
  const [toast, setToast] = React.useState("");

  const { data: interviews = [], isLoading, refetch } = useGetInterviewsQuery();
  const [updateInterview] = useUpdateInterviewMutation();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateInterview({ id, body: { status } }).unwrap();
      showToast(`Marked as ${STATUS_LABELS[status]}`);
    } catch {
      showToast("Failed to update status");
    }
  };

  const handleSaveFeedback = async () => {
    if (!feedbackModal) return;
    setSavingFeedback(true);
    try {
      await updateInterview({
        id: feedbackModal.id,
        body: {
          feedback_score: feedbackScore ? parseFloat(feedbackScore) : undefined,
          feedback_notes: feedbackNotes || undefined,
        },
      }).unwrap();
      showToast("Feedback saved");
      setFeedbackModal(null);
    } catch {
      showToast("Failed to save feedback");
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

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "upcoming", label: "Upcoming" },
    { key: "today", label: "Today" },
    { key: "past", label: "Past" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage and track candidate interview schedules
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
        >
          <Clock size={14} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upcoming</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{upcomingCount}</p>
          <p className="text-xs text-gray-400 mt-1">scheduled interviews</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Today</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{todayCount}</p>
          <p className="text-xs text-gray-400 mt-1">interviews today</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-1">total completed</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            Loading interviews…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <Calendar size={32} className="opacity-40" />
            <p className="text-sm">No interviews in this view</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidate</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date & Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Interviewer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((iv) => (
                <tr key={iv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">
                      {iv.first_name} {iv.last_name}
                    </p>
                    <p className="text-xs text-gray-400">{iv.candidate_email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-gray-700 font-medium">{iv.job_title || "—"}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      {TYPE_ICONS[iv.interview_type]}
                      {TYPE_LABELS[iv.interview_type]}
                    </span>
                    {iv.meeting_link && (
                      <a
                        href={iv.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
                      >
                        <Link size={11} />
                        Join link
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">
                    {formatScheduledAt(iv.scheduled_at)}
                    {isToday(iv.scheduled_at) && (
                      <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {iv.duration_minutes} min
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">
                    {iv.interviewer_name || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusDropdown interview={iv} onUpdate={handleStatusUpdate} />
                  </td>
                  <td className="px-5 py-3.5">
                    {iv.feedback_score != null ? (
                      <button
                        onClick={() => {
                          setFeedbackModal(iv);
                          setFeedbackScore(String(iv.feedback_score ?? ""));
                          setFeedbackNotes(iv.feedback_notes ?? "");
                        }}
                        className="text-xs text-emerald-600 font-medium hover:underline"
                      >
                        Score: {iv.feedback_score}/10
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setFeedbackModal(iv);
                          setFeedbackScore("");
                          setFeedbackNotes("");
                        }}
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        + Add feedback
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Interview Feedback</h2>
            <p className="text-sm text-gray-500 mb-4">
              {feedbackModal.first_name} {feedbackModal.last_name} —{" "}
              {feedbackModal.job_title}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Score (0–10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={feedbackScore}
                  onChange={(e) => setFeedbackScore(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 7.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Notes
                </label>
                <textarea
                  rows={4}
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Interview observations, strengths, concerns…"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setFeedbackModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFeedback}
                disabled={savingFeedback}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingFeedback && <Loader2 size={14} className="animate-spin" />}
                Save Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
