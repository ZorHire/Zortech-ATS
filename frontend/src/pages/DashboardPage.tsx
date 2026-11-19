import {
  Briefcase,
  Calendar,
  AlertTriangle,
  Users,
  Mail,
  Clock,
  ChevronRight,
  LayoutGrid,
  Circle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
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
import {
  PageHeader,
  StatCard,
  StageBadge,
  Skeleton,
  EmptyState,
  ErrorState,
  buttonClasses,
} from "../components/ui";
import { JobStatusBadge } from "../components/jobs/jobBadges";
import { getStage } from "../lib/stages";

type CardType = "pipeline" | "jobs" | "interviews" | "alerts";

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name.split(" ")[0]}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function activityMeta(a: ActivityItem): { icon: LucideIcon; tone: string; text: string } {
  if (a.type === "application") {
    const loc = a.current_location || a.job_location;
    return {
      icon: Users,
      tone: "bg-navy-50 text-navy-600",
      text: `${a.candidate_name} applied for ${a.job_title}${loc ? ` · ${loc}` : ""}`,
    };
  }
  if (a.type === "stage_change") {
    return {
      icon: LayoutGrid,
      tone: "bg-brand-50 text-brand-700",
      text: `${a.candidate_name} moved to ${getStage(a.to_stage).label} for ${a.job_title}`,
    };
  }
  return {
    icon: Calendar,
    tone: "bg-success-50 text-success-700",
    text: `${a.interview_type ?? "Interview"} scheduled with ${a.candidate_name} for ${a.job_title}`,
  };
}

/** Horizontal bars per stage, coloured from lib/stages. Real counts only. */
function StageBars({ rows }: { rows: { stage: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  if (!max) {
    return <EmptyState compact title="No candidates in the pipeline yet" description="Stage counts appear once candidates are added to a job." />;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const s = getStage(r.stage);
        return (
          <li key={r.stage} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="truncate text-ink-soft">{s.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
              <span className={`block h-full rounded-full ${s.dot}`} style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium tabular-nums text-ink">{r.count.toLocaleString("en-IN")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`zh-card flex flex-col p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const profile = useAppSelector(selectCurrentUser);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useGetDashboardStatsQuery(undefined, { pollingInterval: 30_000 });
  const {
    data: activity = [],
    isLoading: activityLoading,
    isError: activityError,
    error: activityErr,
    refetch: refetchActivity,
  } = useGetDashboardActivityQuery(undefined, { pollingInterval: 30_000 });
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErr,
    refetch: refetchTasks,
  } = useGetDashboardTasksQuery(undefined, { pollingInterval: 30_000 });
  const {
    data: jobs = [],
    isLoading: jobsLoading,
    isError: jobsError,
    error: jobsErr,
    refetch: refetchJobs,
  } = useGetJobsQuery(undefined, { pollingInterval: 30_000 });

  const activeJobs = jobs.filter((j) => j.status === "active");

  const fmt = (n: number | undefined) => (n !== undefined ? n.toLocaleString("en-IN") : "—");

  // NOTE: no per-day pipeline data exists in the API, so there is no weekly trend chart.

  const pipelineStages = stats?.pipeline_stages ?? [];
  const pipelineTotal = pipelineStages.reduce((s, r) => s + r.count, 0);
  const getStageCount = (key: string) => pipelineStages.find((s) => s.stage === key)?.count ?? 0;

  // Funnel rows: the main stages, in pipeline order.
  const funnelKeys = ["sourced", "screened", "shortlisted", "submitted_to_client", "client_interview_scheduled", "selected", "offer_extended", "joined"];
  const funnelRows = funnelKeys.map((k) => ({ stage: k, count: getStageCount(k) }));

  const summaryRow = [
    { label: "Sourced", key: "sourced" },
    { label: "Screened", key: "screened" },
    { label: "Interview", key: "client_interview_scheduled" },
    { label: "Offered", key: "offer_extended" },
    { label: "Joined", key: "joined" },
  ];

  const renderModal = () => {
    switch (activeCard) {
      case "pipeline":
        return pipelineStages.length === 0 ? (
          <EmptyState compact title="No pipeline data yet" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {pipelineStages.map((row) => (
              <li key={row.stage} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <StageBadge stage={row.stage} />
                <span className="text-sm font-medium tabular-nums text-ink">{row.count.toLocaleString("en-IN")}</span>
              </li>
            ))}
            <li className="flex items-center justify-between bg-surface px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="text-sm font-semibold tabular-nums text-ink">{pipelineTotal.toLocaleString("en-IN")}</span>
            </li>
          </ul>
        );
      case "jobs":
        return activeJobs.length === 0 ? (
          <EmptyState compact icon={<Briefcase size={22} aria-hidden="true" />} title="No active jobs" />
        ) : (
          <div className="space-y-3">
            {activeJobs.slice(0, 6).map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="block rounded-xl border border-line p-4 transition hover:border-line-strong hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{job.title}</p>
                    {job.department && <p className="mt-0.5 text-xs text-muted">{job.department}</p>}
                  </div>
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted">
                  <div>
                    <p className="font-semibold text-ink">{job.application_count || 0}</p>
                    <p>Applications</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">{job.location || "—"}</p>
                    <p>Location</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        );
      case "interviews":
        return (
          <div className="space-y-2 py-4 text-center">
            <p className="font-display text-3xl font-semibold text-ink">{fmt(stats?.upcoming_interviews)}</p>
            <p className="text-sm text-muted">
              {(stats?.upcoming_interviews ?? 0) === 0
                ? "No upcoming interviews."
                : `${stats?.upcoming_interviews} interview${(stats?.upcoming_interviews ?? 0) > 1 ? "s" : ""} scheduled.`}
            </p>
            <Link to="/interviews" className={buttonClasses("secondary", "sm", "mt-3")}>
              Open interviews
            </Link>
          </div>
        );
      case "alerts":
        return (
          <div className="space-y-2 py-4 text-center">
            <p className={`font-display text-3xl font-semibold ${(stats?.sla_alerts ?? 0) > 0 ? "text-danger-600" : "text-ink"}`}>
              {fmt(stats?.sla_alerts)}
            </p>
            <p className="text-sm text-muted">
              {(stats?.sla_alerts ?? 0) === 0
                ? "All jobs within SLA."
                : `${stats?.sla_alerts} job${(stats?.sla_alerts ?? 0) > 1 ? "s have" : " has"} breached SLA deadline.`}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <PageHeader
        title={profile ? greeting(profile.full_name) : "Dashboard"}
        subtitle="Here's what's happening with your recruitment today."
        actions={
          <>
            <Link to="/candidates" className={buttonClasses("secondary")}>
              Candidates
            </Link>
            <Link to="/jobs" className={buttonClasses("primary")}>
              <Briefcase size={16} aria-hidden="true" />
              View jobs
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Stat cards */}
        {statsError && !stats ? (
          <div className="zh-card">
            <ErrorState compact error={statsErr} onRetry={refetchStats} title="Couldn't load dashboard stats" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={<Users size={18} aria-hidden="true" />}
              label="Total candidates"
              value={fmt(stats?.total_candidates)}
              loading={statsLoading}
              onClick={() => setActiveCard("pipeline")}
            />
            <StatCard
              icon={<Mail size={18} aria-hidden="true" />}
              label="Emails sent"
              value={fmt(stats?.emails_sent)}
              loading={statsLoading}
              tone="neutral"
            />
            <StatCard
              icon={<Briefcase size={18} aria-hidden="true" />}
              label="Active jobs"
              value={stats ? fmt(stats.active_jobs) : fmt(activeJobs.length)}
              loading={statsLoading}
              tone="brand"
              onClick={() => setActiveCard("jobs")}
            />
            <StatCard
              icon={<Calendar size={18} aria-hidden="true" />}
              label="Upcoming interviews"
              value={fmt(stats?.upcoming_interviews)}
              loading={statsLoading}
              tone="success"
              onClick={() => setActiveCard("interviews")}
            />
            <StatCard
              icon={<AlertTriangle size={18} aria-hidden="true" />}
              label="SLA alerts"
              value={fmt(stats?.sla_alerts)}
              loading={statsLoading}
              tone={(stats?.sla_alerts ?? 0) > 0 ? "danger" : "neutral"}
              onClick={() => setActiveCard("alerts")}
            />
          </div>
        )}

        {/* Pipeline + funnel + tasks */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Panel title="Active pipeline" className="lg:col-span-5">
            {statsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <p className="font-display text-3xl font-semibold text-ink">{pipelineTotal.toLocaleString("en-IN")}</p>
                <p className="text-sm text-muted">Candidates in pipeline</p>
                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 sm:grid-cols-5">
                  {summaryRow.map((row) => (
                    <div key={row.key} className="text-center">
                      <dd className="text-base font-semibold tabular-nums text-ink">{getStageCount(row.key)}</dd>
                      <dt className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted">
                        <span className={`h-1.5 w-1.5 rounded-full ${getStage(row.key).dot}`} aria-hidden="true" />
                        {row.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Panel>

          <Panel title="Recruitment funnel" className="lg:col-span-4">
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            ) : (
              <StageBars rows={funnelRows} />
            )}
          </Panel>

          <Panel title="Tasks & reminders" className="lg:col-span-3">
            {tasksLoading ? (
              <ListSkeleton />
            ) : tasksError ? (
              <ErrorState compact error={tasksErr} onRetry={refetchTasks} />
            ) : tasks.length === 0 ? (
              <EmptyState compact title="All caught up" description="No pending tasks." />
            ) : (
              <ul className="space-y-3">
                {tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0">
                      {t.priority === "overdue" ? (
                        <AlertCircle size={14} className="text-danger-600" aria-label="Overdue" />
                      ) : (
                        <Circle size={14} className="text-line-strong" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink">{t.text}</p>
                      <p
                        className={`mt-0.5 text-xs ${
                          t.priority === "overdue"
                            ? "font-medium text-danger-600"
                            : t.priority === "urgent"
                              ? "text-warning-700"
                              : "text-muted"
                        }`}
                      >
                        {t.due}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Active jobs + activity + AI banner */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Panel
            title="Active jobs"
            className="lg:col-span-4"
            action={
              <Link to="/jobs" className="flex items-center gap-0.5 text-sm font-medium text-navy-600 hover:underline">
                View all <ChevronRight size={14} aria-hidden="true" />
              </Link>
            }
          >
            {jobsLoading ? (
              <ListSkeleton />
            ) : jobsError ? (
              <ErrorState compact error={jobsErr} onRetry={refetchJobs} title="Couldn't load jobs" />
            ) : activeJobs.length === 0 ? (
              <EmptyState
                compact
                icon={<Briefcase size={22} aria-hidden="true" />}
                title="No active jobs yet"
                action={
                  <Link to="/jobs" className={buttonClasses("secondary", "sm")}>
                    Go to jobs
                  </Link>
                }
              />
            ) : (
              <div className="space-y-1">
                {activeJobs.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                      <Briefcase size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{job.title}</p>
                      <p className="truncate text-xs text-muted">
                        {[job.department, job.location].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">{job.application_count ?? 0}</p>
                      <p className="text-xs text-muted">Applicants</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent activity" className="lg:col-span-5">
            {activityLoading ? (
              <ListSkeleton rows={4} />
            ) : activityError ? (
              <ErrorState compact error={activityErr} onRetry={refetchActivity} />
            ) : activity.length === 0 ? (
              <EmptyState compact title="No recent activity yet" />
            ) : (
              <ul className="max-h-96 space-y-3 overflow-y-auto">
                {activity.map((a, i) => {
                  const meta = activityMeta(a);
                  const Icon = meta.icon;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-ink">{meta.text}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <Clock size={11} aria-hidden="true" />
                          {timeAgo(a.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <section className="relative flex min-h-[180px] flex-col justify-between overflow-hidden rounded-xl bg-navy-700 p-6 shadow-card lg:col-span-3">
            <div className="space-y-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-brand-400">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold leading-tight text-white">
                Optimise sourcing with <span className="text-brand-400">ZorHire AI</span>
              </h2>
              <p className="text-sm leading-relaxed text-navy-100">
                Automate candidate outreach and matching with enterprise-grade intelligence.
              </p>
            </div>
            <div className="mt-6">
              <Link to="/pricing" className={buttonClasses("accent")}>
                Upgrade now
              </Link>
            </div>
          </section>
        </div>
      </div>

      {activeCard && (
        <DashboardModal
          title={
            activeCard === "pipeline"
              ? "Active pipeline"
              : activeCard === "jobs"
                ? "Active jobs"
                : activeCard === "interviews"
                  ? "Upcoming interviews"
                  : "SLA alerts"
          }
          onClose={() => setActiveCard(null)}
        >
          {renderModal()}
        </DashboardModal>
      )}
    </>
  );
}
