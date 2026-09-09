import {
  Briefcase,
  Calendar,
  AlertTriangle,
  Users,
  Mail,
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  Circle,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/layout/Header";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import {
  useGetDashboardStatsQuery,
  useGetDashboardActivityQuery,
  useGetDashboardTasksQuery,
  type ActivityItem,
} from "../store/api/dashboardApi";
import { useGetJobsQuery } from "../store/api/jobApi";
import DashboardModal from "../components/DashboardModal";

type CardType = "pipeline" | "jobs" | "interviews" | "alerts";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  sourced: "Sourced",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to Client",
  client_interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  offer_rejected: "Offer Rejected",
  joined: "Joined",
  disqualified: "Disqualified",
};

const STAGE_COLORS: Record<string, string> = {
  sourced: "#3b82f6",
  screened: "#8b5cf6",
  shortlisted: "#f59e0b",
  submitted_to_client: "#06b6d4",
  selected: "#10b981",
  offer_extended: "#6366f1",
  offer_accepted: "#14b8a6",
  joined: "#22c55e",
  disqualified: "#ef4444",
};

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name.split(" ")[0]}!`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color,
  bgColor,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  color: string;
  bgColor: string;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-3 ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={color} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {trendLabel && <p className="text-[10px] text-gray-400 mt-0.5">{trendLabel}</p>}
      </div>
    </Wrapper>
  );
}

// ─── Simple SVG line chart ────────────────────────────────────────────────────

function PipelineChart({ data }: { data: { day: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 400;
  const H = 80;
  const pad = 8;
  const xStep = (W - pad * 2) / (data.length - 1);

  const points = data.map((d, i) => ({
    x: pad + i * xStep,
    y: H - pad - ((d.count / max) * (H - pad * 2)),
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${H} L ${pad} ${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lineGrad)" />
      <path d={path} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#f59e0b" stroke="white" strokeWidth="2" />
      ))}
    </svg>
  );
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">No data yet</div>
    );
  }

  const radius = 48;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = segments.map((s) => {
    const pct = s.value / total;
    const arc = {
      ...s,
      pct,
      dashArray: `${pct * circumference} ${circumference}`,
      rotate: offset * 360 - 90,
    };
    offset += pct;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0">
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth="14"
            strokeDasharray={a.dashArray}
            strokeDashoffset="0"
            transform={`rotate(${a.rotate} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg" fontSize="18" fontWeight="bold" fill="#111">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#999">
          Total
        </text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {arcs.slice(0, 6).map((a) => (
          <div key={a.label} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className="text-gray-600 truncate">{a.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-semibold text-gray-900">{a.value}</span>
              <span className="text-gray-400">({Math.round(a.pct * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function activityMeta(a: ActivityItem): { icon: React.ComponentType<any>; color: string; text: string } {
  if (a.type === 'application') {
    const loc = a.current_location || a.job_location;
    return {
      icon: Users,
      color: "text-blue-500 bg-blue-50",
      text: `${a.candidate_name} applied for ${a.job_title}${loc ? ` · ${loc}` : ''}`,
    };
  }
  if (a.type === 'stage_change') {
    const LABELS: Record<string, string> = {
      new: "New", sourced: "Sourced", screened: "Screened", shortlisted: "Shortlisted",
      submitted_to_client: "Submitted", client_interview_scheduled: "Interview Scheduled",
      interview_completed: "Interview Done", selected: "Selected", offer_extended: "Offered",
      offer_accepted: "Accepted", joined: "Hired", disqualified: "Disqualified",
    };
    return {
      icon: LayoutGrid,
      color: "text-violet-500 bg-violet-50",
      text: `${a.candidate_name} moved to ${LABELS[a.to_stage ?? ''] ?? a.to_stage} for ${a.job_title}`,
    };
  }
  return {
    icon: Calendar,
    color: "text-amber-500 bg-amber-50",
    text: `${a.interview_type ?? 'Interview'} scheduled with ${a.candidate_name} for ${a.job_title}`,
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const profile = useAppSelector(selectCurrentUser);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const { data: stats } = useGetDashboardStatsQuery(undefined, { pollingInterval: 30_000 });
  const { data: activity = [], isLoading: activityLoading } = useGetDashboardActivityQuery(undefined, { pollingInterval: 30_000 });
  const { data: tasks = [], isLoading: tasksLoading } = useGetDashboardTasksQuery(undefined, { pollingInterval: 30_000 });
  const { data: jobs = [], isLoading: jobsLoading, isError: jobsError } = useGetJobsQuery(undefined, { pollingInterval: 30_000 });

  const activeJobs = jobs.filter((j) => j.status === "active");

  const fmt = (n: number | undefined) => (n !== undefined ? n.toLocaleString("en-IN") : "—");

  // Build week sparkline data from pipeline stages
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekData = weekDays.map((day, i) => ({
    day,
    count: stats ? Math.max(0, Math.round((stats.total_candidates / 7) * (0.6 + 0.5 * Math.sin(i * 1.2 + 0.5)))) : 0,
  }));

  // Build donut segments
  const snapshotStages = ["sourced", "screened", "shortlisted", "submitted_to_client", "selected"];
  const donutSegments = (stats?.pipeline_stages ?? [])
    .filter((s) => snapshotStages.includes(s.stage) && s.count > 0)
    .map((s) => ({
      label: STAGE_LABELS[s.stage] ?? s.stage,
      value: s.count,
      color: STAGE_COLORS[s.stage] ?? "#6b7280",
    }));

  const pipelineTotal = (stats?.pipeline_stages ?? []).reduce((s, r) => s + r.count, 0);

  // Pipeline bottom row
  const pipelineRow = [
    { label: "Sourced", key: "sourced", color: "text-blue-600" },
    { label: "Screening", key: "screened", color: "text-violet-600" },
    { label: "Interview", key: "client_interview_scheduled", color: "text-amber-600" },
    { label: "Offered", key: "offer_extended", color: "text-emerald-600" },
    { label: "Hired", key: "joined", color: "text-emerald-700" },
  ];
  const getStageCount = (key: string) =>
    stats?.pipeline_stages?.find((s) => s.stage === key)?.count ?? 0;

  const renderModal = () => {
    switch (activeCard) {
      case "pipeline": {
        const stages = stats?.pipeline_stages ?? [];
        const tot = stages.reduce((s, r) => s + r.count, 0);
        return stages.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No pipeline data yet.</p>
        ) : (
          <div className="space-y-2">
            {stages.map((row) => (
              <div key={row.stage} className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50">
                <span className="text-sm font-medium text-gray-700">{STAGE_LABELS[row.stage] ?? row.stage}</span>
                <span className="text-sm font-bold text-gray-900">{row.count.toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50">
              <span className="text-sm font-bold text-blue-800">Total</span>
              <span className="text-sm font-bold text-blue-800">{tot.toLocaleString("en-IN")}</span>
            </div>
          </div>
        );
      }
      case "jobs":
        return (
          <div className="space-y-3">
            {activeJobs.length === 0 ? (
              <p className="text-sm text-slate-500">No active jobs.</p>
            ) : activeJobs.slice(0, 6).map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{job.department}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1">{job.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div><p className="font-semibold text-slate-900">{job.application_count || 0}</p><p>Applications</p></div>
                  <div><p className="font-semibold text-slate-900">{job.location}</p><p>Location</p></div>
                </div>
              </div>
            ))}
          </div>
        );
      case "interviews":
        return (
          <div className="text-center py-4 space-y-2">
            <p className="text-3xl font-black text-slate-900">{fmt(stats?.upcoming_interviews)}</p>
            <p className="text-sm text-slate-500">
              {(stats?.upcoming_interviews ?? 0) === 0 ? "No upcoming interviews." : `${stats?.upcoming_interviews} interview${(stats?.upcoming_interviews ?? 0) > 1 ? "s" : ""} scheduled.`}
            </p>
          </div>
        );
      case "alerts":
        return (
          <div className="text-center py-4 space-y-2">
            <p className={`text-3xl font-black ${(stats?.sla_alerts ?? 0) > 0 ? "text-amber-500" : "text-slate-900"}`}>{fmt(stats?.sla_alerts)}</p>
            <p className="text-sm text-slate-500">
              {(stats?.sla_alerts ?? 0) === 0 ? "All jobs within SLA." : `${stats?.sla_alerts} job${(stats?.sla_alerts ?? 0) > 1 ? "s have" : " has"} breached SLA deadline.`}
            </p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={profile ? greeting(profile.full_name) : "Dashboard"}
        subtitle="Here's what's happening with your recruitment today."
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-5">

        {/* ── 5 Stat Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            icon={Users}
            label="Total Candidates"
            value={fmt(stats?.total_candidates)}
            trend={12}
            trendLabel="from last week"
            color="text-blue-600"
            bgColor="bg-blue-50"
            onClick={() => setActiveCard("pipeline")}
          />
          <StatCard
            icon={Mail}
            label="Emails Sent"
            value={fmt(stats?.emails_sent ?? 0)}
            trend={8}
            trendLabel="from last week"
            color="text-emerald-600"
            bgColor="bg-emerald-50"
          />
          <StatCard
            icon={Briefcase}
            label="Active Jobs"
            value={stats ? fmt(stats.active_jobs) : fmt(activeJobs.length)}
            trend={15}
            trendLabel="from last week"
            color="text-violet-600"
            bgColor="bg-violet-50"
            onClick={() => setActiveCard("jobs")}
          />
          <StatCard
            icon={Calendar}
            label="Interviews"
            value={fmt(stats?.upcoming_interviews)}
            trend={25}
            trendLabel="from last week"
            color="text-amber-600"
            bgColor="bg-amber-50"
            onClick={() => setActiveCard("interviews")}
          />
          <StatCard
            icon={AlertTriangle}
            label="SLA Alerts"
            value={fmt(stats?.sla_alerts)}
            trend={(stats?.sla_alerts ?? 0) > 0 ? -(stats?.sla_alerts ?? 0) : 0}
            trendLabel="2 new alerts"
            color="text-red-600"
            bgColor="bg-red-50"
            onClick={() => setActiveCard("alerts")}
          />
        </div>

        {/* ── Middle row: Pipeline chart + Snapshot + Tasks ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

          {/* Active Pipeline */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-bold text-gray-900">Active Pipeline</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{pipelineTotal.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">Candidates in pipeline</p>
              </div>
              <div className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-500">
                This Week
                <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </div>
            </div>
            <div className="mt-4">
              <PipelineChart data={weekData} />
            </div>
            <div className="flex items-center justify-between mt-3 text-center">
              {weekDays.map((d, i) => (
                <div key={d} className="flex flex-col items-center">
                  <span className={`text-[11px] font-semibold ${i === 2 ? "text-amber-600" : "text-gray-400"}`}>{d}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1 mt-4 pt-4 border-t border-gray-50">
              {pipelineRow.map((row) => (
                <div key={row.key} className="text-center">
                  <p className={`text-sm font-bold ${row.color}`}>{getStageCount(row.key)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{row.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recruitment Snapshot */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-gray-900 mb-4">Recruitment Snapshot</p>
            <DonutChart
              segments={
                donutSegments.length > 0
                  ? donutSegments
                  : [
                      { label: "Sourced", value: 4, color: "#3b82f6" },
                      { label: "Screening", value: 4, color: "#8b5cf6" },
                      { label: "Interview", value: 5, color: "#f59e0b" },
                      { label: "Offered", value: 2, color: "#6366f1" },
                      { label: "Hired", value: 1, color: "#10b981" },
                    ]
              }
            />
          </div>

          {/* Tasks & Reminders */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Tasks & Reminders</p>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {tasksLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-start gap-2.5">
                    <div className="w-3.5 h-3.5 bg-gray-200 rounded-full mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-full mb-1.5" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))
              ) : tasks.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">All caught up! No pending tasks.</p>
              ) : (
                tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0">
                      {t.priority === 'overdue' ? (
                        <AlertCircle size={14} className="text-red-500" />
                      ) : (
                        <Circle size={14} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 leading-snug">{t.text}</p>
                      <p className={`text-[11px] mt-0.5 ${t.priority === 'overdue' ? "text-red-500 font-semibold" : t.priority === 'urgent' ? "text-amber-600" : "text-gray-400"}`}>
                        {t.due}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom row: Active Jobs + Recent Activity + Upgrade ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">

          {/* Active Jobs */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Active Jobs</p>
              <Link to="/jobs" className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
                View All <ChevronRight size={11} />
              </Link>
            </div>
            <div className="space-y-3">
              {jobsLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))
              ) : jobsError ? (
                <p className="text-xs text-red-400 text-center py-4">Could not load jobs.</p>
              ) : activeJobs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No active jobs yet.</p>
              ) : (
                activeJobs.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {job.title.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{job.title}</p>
                      <p className="text-[11px] text-gray-400">{job.department} · {job.location ?? "—"}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gray-900">{job.application_count ?? 0}</p>
                      <p className="text-[10px] text-gray-400">Applications</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Recent Activity</p>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {activityLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-xl flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-3 bg-gray-200 rounded w-5/6 mb-1.5" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : activity.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No recent activity yet.</p>
              ) : (
                activity.map((a, i) => {
                  const meta = activityMeta(a);
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl ${meta.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{meta.text}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />{timeAgo(a.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* AI Upgrade Banner */}
          <div className="lg:col-span-3">
            <div className="bg-[#111111] rounded-2xl p-6 h-full flex flex-col justify-between relative overflow-hidden min-h-[180px]">
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 border border-white/10 rounded-full" />
              <div className="absolute bottom-[-10%] left-[-10%] w-36 h-36 border border-white/5 rounded-full" />

              <div className="relative z-10 space-y-3">
                <h2 className="text-lg font-black text-white leading-tight">
                  Optimize{" "}
                  <span className="italic font-serif text-amber-400">Sourcing</span>
                  {" "}with ZorHire AI
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Automate candidate outreach and matching with enterprise-grade intelligence.
                </p>
              </div>

              <div className="relative z-10 mt-6">
                <Link
                  to="/pricing"
                  className="inline-block bg-amber-400 text-gray-900 px-5 py-2.5 rounded-xl font-black text-sm hover:bg-amber-300 transition-colors"
                >
                  Upgrade Now
                </Link>
              </div>

              <div className="absolute bottom-4 right-6 opacity-10">
                <LayoutGrid size={80} className="text-white" strokeWidth={0.5} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeCard && (
        <DashboardModal
          title={
            activeCard === "pipeline" ? "Active Pipeline"
            : activeCard === "jobs" ? "Active Jobs"
            : activeCard === "interviews" ? "Upcoming Interviews"
            : "SLA Alerts"
          }
          subtitle="Tap outside or use the close button to dismiss"
          onClose={() => setActiveCard(null)}
        >
          {renderModal()}
        </DashboardModal>
      )}
    </div>
  );
}
