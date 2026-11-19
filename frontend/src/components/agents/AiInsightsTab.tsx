import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  HelpCircle,
  MessagesSquare,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, useConfirm } from "../ui";
import type { BadgeTone } from "../ui";
import { useNotify } from "../../hooks/useNotify";
import { describeApiError } from "../../store/api/baseApi";
import { useGetApplicationInsightsQuery, useRunAgentMutation } from "../../store/api/agentsApi";
import type { AgentName, ApplicationInsights, ScreeningInsight, ShortlistResult } from "../../types/agents";
import { formatDateTime, scoreTone } from "../../lib/agents";
import AgentActivityList from "./AgentActivityList";

const DECISION: Record<ShortlistResult["decision"], { label: string; tone: BadgeTone }> = {
  shortlist: { label: "Shortlist", tone: "success" },
  review: { label: "Review", tone: "warning" },
  not_a_fit: { label: "Not a fit", tone: "danger" },
};

const RECOMMENDATION: Record<string, { label: string; tone: BadgeTone }> = {
  advance: { label: "Advance", tone: "success" },
  review: { label: "Review", tone: "warning" },
  do_not_advance: { label: "Do not advance", tone: "danger" },
};

const SCREENING_STATUS: Record<ScreeningInsight["status"], { label: string; tone: BadgeTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  invited: { label: "Invited", tone: "navy" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  expired: { label: "Expired", tone: "neutral" },
};

const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sent: { label: "Link sent", tone: "navy" },
  booked: { label: "Booked", tone: "success" },
  expired: { label: "Expired", tone: "neutral" },
};

const STROKE = { success: "stroke-success-600", warning: "stroke-warning-600", danger: "stroke-danger-600" };
const TEXT = { success: "text-success-700", warning: "text-warning-700", danger: "text-danger-700" };
const BAR = { success: "bg-success-600", warning: "bg-warning-600", danger: "bg-danger-600" };

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));
}

/** Circular 0-100 score. */
function ScoreRing({ score, label }: { score: number; label: string }) {
  const v = clampScore(score);
  const tone = scoreTone(v);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${label}: ${v} out of 100`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-line" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className={STROKE[tone]}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-display text-lg font-semibold ${TEXT[tone]}`}>
        {v}
      </span>
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="zh-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="text-navy-600" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: "success" | "warning" }) {
  if (items.length === 0) return <p className="text-sm text-muted">None noted.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm text-ink-soft">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "success" ? "bg-success-600" : "bg-warning-600"}`}
          />
          <span className="min-w-0 break-words">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function YesNo({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-muted">Unknown</span>;
  return value ? (
    <span className="inline-flex items-center gap-1 text-success-700">
      <CheckCircle2 size={14} aria-hidden="true" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-danger-700">
      <XCircle size={14} aria-hidden="true" /> No
    </span>
  );
}

const subtle = "text-xs font-medium text-muted";

function ShortlistSection({ shortlist }: { shortlist: ShortlistResult }) {
  const decision = DECISION[shortlist.decision] ?? { label: shortlist.decision, tone: "neutral" as BadgeTone };
  const coverage = shortlist.must_have_coverage ?? [];
  const met = coverage.filter((c) => c.met).length;
  return (
    <>
      <div className="flex items-center gap-4">
        <ScoreRing score={shortlist.score} label="Shortlist score" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">Decision</span>
            <Badge tone={decision.tone}>{decision.label}</Badge>
          </div>
          <p className="text-xs text-muted">
            Scored {formatDateTime(shortlist.created_at)}
            {shortlist.model ? ` · ${shortlist.model}` : ""}
          </p>
        </div>
      </div>
      {shortlist.reasoning && <p className="text-sm leading-relaxed text-ink-soft">{shortlist.reasoning}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h4 className={`${subtle} mb-2`}>Strengths</h4>
          <BulletList items={shortlist.strengths ?? []} tone="success" />
        </div>
        <div>
          <h4 className={`${subtle} mb-2`}>Gaps</h4>
          <BulletList items={shortlist.gaps ?? []} tone="warning" />
        </div>
      </div>
      {coverage.length > 0 && (
        <div>
          <h4 className={`${subtle} mb-2`}>
            Must-have skills · {met} of {coverage.length} met
          </h4>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {coverage.map((c, i) => (
              <li key={`${c.skill}-${i}`} className="flex items-start gap-2.5 px-3 py-2">
                {c.met ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-600" aria-label="Met" />
                ) : (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-danger-600" aria-label="Not met" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.skill}</p>
                  {c.evidence && <p className="break-words text-xs text-muted">{c.evidence}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ScreeningSection({ screening }: { screening: ScreeningInsight }) {
  const [open, setOpen] = useState(false);
  const st = SCREENING_STATUS[screening.status] ?? { label: screening.status, tone: "neutral" as BadgeTone };
  const ev = screening.evaluation;
  const rec = ev ? RECOMMENDATION[ev.recommendation] ?? { label: ev.recommendation, tone: "neutral" as BadgeTone } : null;
  const transcript = screening.transcript ?? [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Badge tone={st.tone}>{st.label}</Badge>
        {screening.invited_at && <span className="text-xs text-muted">Invited {formatDateTime(screening.invited_at)}</span>}
        {screening.completed_at && (
          <span className="text-xs text-muted">Completed {formatDateTime(screening.completed_at)}</span>
        )}
      </div>

      {ev && rec && (
        <>
          <div className="flex items-center gap-4">
            <ScoreRing score={ev.overall_score} label="Screening score" />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">Recommendation</span>
                <Badge tone={rec.tone}>{rec.label}</Badge>
              </div>
              {ev.summary && <p className="text-sm text-ink-soft">{ev.summary}</p>}
            </div>
          </div>

          {(ev.competencies ?? []).length > 0 && (
            <div>
              <h4 className={`${subtle} mb-2`}>Competencies</h4>
              <ul className="space-y-3">
                {ev.competencies.map((c, i) => {
                  const v = clampScore(c.score);
                  const tone = scoreTone(v);
                  return (
                    <li key={`${c.name}-${i}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className={`text-xs font-semibold ${TEXT[tone]}`}>{v}/100</span>
                      </div>
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line"
                        role="progressbar"
                        aria-label={c.name}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={v}
                      >
                        <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${v}%` }} />
                      </div>
                      {c.evidence && <p className="mt-1 break-words text-xs text-muted">{c.evidence}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {ev.logistics && (
            <div>
              <h4 className={`${subtle} mb-2`}>Logistics</h4>
              <dl className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-2">
                <div className="rounded-lg bg-surface p-2.5">
                  <dt className="text-xs text-muted">Notice period</dt>
                  <dd className="font-medium text-ink">{ev.logistics.notice_period || "Not shared"}</dd>
                </div>
                <div className="rounded-lg bg-surface p-2.5">
                  <dt className="text-xs text-muted">Expected CTC</dt>
                  <dd className="font-medium text-ink">{ev.logistics.expected_ctc || "Not shared"}</dd>
                </div>
                <div className="rounded-lg bg-surface p-2.5">
                  <dt className="text-xs text-muted">Location works</dt>
                  <dd className="font-medium">
                    <YesNo value={ev.logistics.location_ok} />
                  </dd>
                </div>
                <div className="rounded-lg bg-surface p-2.5">
                  <dt className="text-xs text-muted">Work mode works</dt>
                  <dd className="font-medium">
                    <YesNo value={ev.logistics.work_mode_ok} />
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {(ev.red_flags ?? []).length > 0 && (
            <div className="rounded-lg border border-danger-50 bg-danger-50 p-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger-700">
                <AlertTriangle size={14} aria-hidden="true" /> Red flags
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-danger-700">
                {ev.red_flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!ev && screening.status === "completed" && (
        <p className="text-sm text-muted">The evaluation is being written. Check back in a minute.</p>
      )}

      {transcript.length > 0 && (
        <div className="rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-surface"
          >
            Transcript ({transcript.length} message{transcript.length === 1 ? "" : "s"})
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <ol className="max-h-96 space-y-2 overflow-y-auto border-t border-line p-3">
              {transcript.map((m, i) => (
                <li key={i} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                      m.role === "candidate" ? "rounded-br-sm bg-navy-600 text-white" : "rounded-bl-sm bg-surface-sunken text-ink"
                    }`}
                  >
                    <span className="sr-only">{m.role === "candidate" ? "Candidate: " : "Interviewer: "}</span>
                    {m.content}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}

function BookingSection({ booking }: { booking: NonNullable<ApplicationInsights["booking"]> }) {
  const st = BOOKING_STATUS[booking.status] ?? { label: booking.status, tone: "neutral" as BadgeTone };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={st.tone}>{st.label}</Badge>
        {booking.chosen_slot && (
          <span className="text-sm font-medium text-ink">
            <time dateTime={booking.chosen_slot}>{formatDateTime(booking.chosen_slot)}</time>
          </span>
        )}
      </div>
      {booking.status !== "booked" && (booking.slots ?? []).length > 0 && (
        <div>
          <h4 className={`${subtle} mb-2`}>Offered times</h4>
          <ul className="flex flex-wrap gap-1.5">
            {booking.slots.map((s) => (
              <li key={s}>
                <Badge tone="neutral">
                  <time dateTime={s}>{formatDateTime(s)}</time>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

interface AiInsightsTabProps {
  applicationId: string | null;
  candidateName: string;
  /** Close the pop-up when following a link. */
  onNavigate?: () => void;
}

/** AI shortlist / screening / booking for one application, with manual "run agent" buttons. */
export default function AiInsightsTab({ applicationId, candidateName, onNavigate }: AiInsightsTabProps) {
  const notify = useNotify();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetApplicationInsightsQuery(applicationId ?? "", {
    skip: !applicationId,
  });
  const [runAgent] = useRunAgentMutation();
  const [running, setRunning] = useState<AgentName | null>(null);

  if (!applicationId) {
    return (
      <div className="zh-card">
        <EmptyState
          compact
          icon={<Sparkles size={22} />}
          title="Not in any pipeline yet"
          description="Add this candidate to a job to see AI scoring, screening and scheduling."
        />
      </div>
    );
  }

  const run = async (agent: AgentName) => {
    if (agent === "screener" || agent === "scheduler") {
      const ok = await confirm({
        title: agent === "screener" ? "Send screening interview?" : "Send scheduling link?",
        message:
          agent === "screener"
            ? `${candidateName} will get an email with a link to a short AI screening interview.`
            : `${candidateName} will get an email with a link to pick one of this job's interview slots.`,
        confirmText: agent === "screener" ? "Send interview" : "Send link",
      });
      if (!ok) return;
    }
    setRunning(agent);
    try {
      await runAgent({ applicationId, agent }).unwrap();
      notify.success(
        agent === "shortlister"
          ? "Shortlister queued — the score will appear here shortly"
          : agent === "screener"
            ? `Screening interview queued for ${candidateName}`
            : `Scheduling link queued for ${candidateName}`,
      );
    } catch (err) {
      notify.error(describeApiError(err, "Couldn't start the agent. Please try again."));
    } finally {
      setRunning(null);
    }
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<Sparkles size={14} />}
        loading={running === "shortlister"}
        disabled={!!running}
        onClick={() => run("shortlister")}
      >
        Run shortlister
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<MessagesSquare size={14} />}
        loading={running === "screener"}
        disabled={!!running}
        onClick={() => run("screener")}
      >
        Send screening interview
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<Send size={14} />}
        loading={running === "scheduler"}
        disabled={!!running}
        onClick={() => run("scheduler")}
      >
        Send scheduling link
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading AI insights">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        {actions}
        <div className="zh-card">
          <ErrorState compact title="Couldn't load AI insights" error={error} onRetry={refetch} retrying={isFetching} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.needs_review && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-brand-200 bg-warning-50 p-4 text-sm text-warning-700"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Needs review</p>
            <p className="mt-0.5">
              Autopilot didn't move this candidate forward on its own. Read the notes below and decide the next step —
              autopilot never rejects anyone.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className={subtle}>Run an agent for this application</p>
        {actions}
      </div>

      <Card title="Shortlist score" icon={<Sparkles size={14} />}>
        {data.shortlist ? (
          <ShortlistSection shortlist={data.shortlist} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <HelpCircle size={16} aria-hidden="true" />
            Not scored yet. Use “Run shortlister” to score this candidate against the job.
          </p>
        )}
      </Card>

      <Card title="Screening interview" icon={<MessagesSquare size={14} />}>
        {data.screening ? (
          <ScreeningSection screening={data.screening} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CircleSlash size={16} aria-hidden="true" />
            No screening interview sent yet.
          </p>
        )}
      </Card>

      <Card title="Interview booking" icon={<CalendarCheck size={14} />}>
        {data.booking ? (
          <BookingSection booking={data.booking} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CircleSlash size={16} aria-hidden="true" />
            No scheduling link sent yet.
          </p>
        )}
      </Card>

      <section className="zh-card overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink">Recent agent activity</h3>
        </div>
        <div className="px-5">
          {(data.events ?? []).length === 0 ? (
            <p className="py-5 text-center text-sm text-muted">No agent activity for this application yet.</p>
          ) : (
            <AgentActivityList events={data.events.slice(0, 10)} hideCandidate hideJob dense onNavigate={onNavigate} />
          )}
        </div>
      </section>
    </div>
  );
}
