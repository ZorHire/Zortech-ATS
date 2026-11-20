import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  CircleDollarSign,
  ClipboardCheck,
  MessagesSquare,
  PauseCircle,
  Send,
  Sparkles,
} from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  buttonClasses,
  useConfirm,
} from "../components/ui";
import AgentActivityList from "../components/agents/AgentActivityList";
import {
  useGetAgentActivityQuery,
  useGetAgentSummaryQuery,
  usePauseAllAgentsMutation,
} from "../store/api/agentsApi";
import { useGetJobsQuery } from "../store/api/jobApi";
import { describeApiError } from "../store/api/baseApi";
import { useNotify } from "../hooks/useNotify";
import { AGENT_META, formatUsd } from "../lib/agents";
import type { AgentEvent } from "../types/agents";

const AGENT_FILTERS = Object.entries(AGENT_META) as [AgentEvent["agent"], (typeof AGENT_META)[AgentEvent["agent"]]][];
// The activity endpoint filters by job only; agent / Needs review are filtered here.
const FEED_LIMIT = 100;
const POLL_MS = 30000;

export default function AgentsPage() {
  const [params, setParams] = useSearchParams();
  const jobId = params.get("jobId") ?? "";
  const agent = params.get("agent") ?? "";
  const needsReview = params.get("view") === "needs_review";

  const notify = useNotify();
  const confirm = useConfirm();

  const summary = useGetAgentSummaryQuery(undefined, { pollingInterval: POLL_MS });
  const activity = useGetAgentActivityQuery(
    { jobId: jobId || undefined, limit: FEED_LIMIT },
    { pollingInterval: POLL_MS },
  );
  const { data: jobs } = useGetJobsQuery();
  const [pauseAll, { isLoading: pausing }] = usePauseAllAgentsMutation();

  const setParam = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const events = useMemo(() => {
    let list = activity.data ?? [];
    if (agent) list = list.filter((e) => e.agent === agent);
    if (needsReview) list = list.filter((e) => e.action === "needs_review");
    return list;
  }, [activity.data, agent, needsReview]);

  const filtersActive = !!(jobId || agent || needsReview);
  const s = summary.data;

  const handlePauseAll = async () => {
    const ok = await confirm({
      title: "Pause all agents?",
      message:
        "Autopilot will be turned off on every job. No new candidate emails will be sent and queued steps stop. You can turn autopilot back on per job.",
      confirmText: "Pause all agents",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await pauseAll().unwrap();
      notify.success(
        res.paused > 0
          ? `Paused autopilot on ${res.paused} job${res.paused === 1 ? "" : "s"}`
          : "No jobs had autopilot on",
      );
    } catch (err) {
      notify.error(describeApiError(err, "Couldn't pause the agents. Please try again."));
    }
  };

  const jobOptions = useMemo(() => {
    const list = [...(jobs ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    // Keep a job chosen from a link selectable even if it's not in the list.
    if (jobId && !list.some((j) => j.id === jobId)) {
      const title = activity.data?.find((e) => e.job_id === jobId)?.job_title ?? "Selected job";
      return [{ id: jobId, title }, ...list.map((j) => ({ id: j.id, title: j.title }))];
    }
    return list.map((j) => ({ id: j.id, title: j.title }));
  }, [jobs, jobId, activity.data]);

  return (
    <>
      <PageHeader
        title="AI agents"
        subtitle="Autopilot shortlists, screens and schedules candidates on the jobs where you turn it on. Every step is logged here."
        actions={
          <Button
            variant="danger"
            icon={<PauseCircle size={16} />}
            onClick={handlePauseAll}
            loading={pausing}
            loadingText="Pausing…"
            disabled={!!s && s.autopilot_jobs === 0}
          >
            Pause all agents
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Today */}
        <section aria-labelledby="agents-today">
          <h2 id="agents-today" className="mb-3 text-sm font-semibold text-ink">
            Today
          </h2>
          {summary.isError ? (
            <div className="zh-card">
              <ErrorState compact error={summary.error} onRetry={summary.refetch} retrying={summary.isFetching} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Autopilot jobs"
                value={s?.autopilot_jobs ?? 0}
                icon={<Bot size={18} />}
                loading={summary.isLoading}
                hint={s && s.pending_tasks > 0 ? `${s.pending_tasks} step${s.pending_tasks === 1 ? "" : "s"} queued` : undefined}
              />
              <StatCard
                label="Shortlisted today"
                value={s?.today.shortlisted ?? 0}
                icon={<Sparkles size={18} />}
                tone="success"
                loading={summary.isLoading}
              />
              <StatCard
                label="Needs review"
                value={s?.today.needs_review ?? 0}
                icon={<AlertTriangle size={18} />}
                tone="brand"
                loading={summary.isLoading}
                hint={needsReview ? "Showing only these below" : "Show in the feed"}
                onClick={() => setParam("view", needsReview ? null : "needs_review")}
              />
              <StatCard
                label="Screening invites"
                value={s?.today.screening_invites ?? 0}
                icon={<Send size={18} />}
                loading={summary.isLoading}
              />
              <StatCard
                label="Screenings completed"
                value={s?.today.screenings_completed ?? 0}
                icon={<MessagesSquare size={18} />}
                loading={summary.isLoading}
              />
              <StatCard
                label="Interviews booked"
                value={s?.today.interviews_booked ?? 0}
                icon={<CalendarCheck size={18} />}
                tone="success"
                loading={summary.isLoading}
              />
              <StatCard
                label="Spend this month"
                value={formatUsd(s?.spend_month_usd)}
                icon={<CircleDollarSign size={18} />}
                tone="neutral"
                loading={summary.isLoading}
                hint="AI model cost for agent work"
              />
            </div>
          )}
        </section>

        {/* Activity */}
        <section className="zh-card" aria-labelledby="agents-activity">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 id="agents-activity" className="text-base font-semibold text-ink">
                Activity
              </h2>
              <p className="mt-0.5 text-sm text-muted">Latest {FEED_LIMIT} agent steps, newest first. Updates every 30 seconds.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div
                role="group"
                aria-label="Quick filter"
                className="inline-flex self-start rounded-lg border border-line bg-surface p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={!needsReview}
                  onClick={() => setParam("view", null)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    !needsReview ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  aria-pressed={needsReview}
                  onClick={() => setParam("view", "needs_review")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    needsReview ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
                  }`}
                >
                  <AlertTriangle size={14} aria-hidden="true" />
                  Needs review
                </button>
              </div>
              <div>
                <label htmlFor="agents-filter-agent" className="sr-only">
                  Agent
                </label>
                <select
                  id="agents-filter-agent"
                  value={agent}
                  onChange={(e) => setParam("agent", e.target.value || null)}
                  className="zh-input py-2 sm:w-48"
                >
                  <option value="">All agents</option>
                  {AGENT_FILTERS.map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="agents-filter-job" className="sr-only">
                  Job
                </label>
                <select
                  id="agents-filter-job"
                  value={jobId}
                  onChange={(e) => setParam("jobId", e.target.value || null)}
                  className="zh-input py-2 sm:w-56"
                >
                  <option value="">All jobs</option>
                  {jobOptions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-5">
            {activity.isLoading ? (
              <div className="space-y-4 py-5" role="status" aria-label="Loading activity">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.isError ? (
              <ErrorState error={activity.error} onRetry={activity.refetch} retrying={activity.isFetching} />
            ) : events.length > 0 ? (
              <AgentActivityList events={events} hideJob={!!jobId} />
            ) : filtersActive ? (
              <EmptyState
                title={needsReview ? "Nothing needs review" : "No matching activity"}
                description={
                  needsReview
                    ? "No candidates in the latest activity were sent to Needs review."
                    : "Try another agent or job, or clear the filters."
                }
                action={
                  <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<ClipboardCheck size={22} aria-hidden="true" />}
                title="No agent activity yet"
                description={
                  <>
                    Open a job and switch on <strong className="font-semibold text-ink">Autopilot</strong> at the top of
                    the page. Agents will then shortlist new candidates, invite them to a screening interview and send
                    a booking link, and every step will appear here.
                  </>
                }
                action={
                  <Link to="/jobs" className={buttonClasses("primary")}>
                    Go to jobs
                  </Link>
                }
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
