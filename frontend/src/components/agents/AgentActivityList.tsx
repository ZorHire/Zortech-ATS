import { Link } from "react-router-dom";
import { Badge } from "../ui";
import type { AgentEvent } from "../../types/agents";
import { actionMeta, agentMeta, formatDateTime, formatRelative } from "../../lib/agents";

interface AgentActivityListProps {
  events: AgentEvent[];
  /** Hide the job link (e.g. on the job's own page). */
  hideJob?: boolean;
  /** Hide the candidate link (e.g. inside the candidate pop-up). */
  hideCandidate?: boolean;
  /** Called when a link is followed (e.g. to close a modal). */
  onNavigate?: () => void;
  dense?: boolean;
}

/** One row per agent event: agent icon, who/what, action badge, summary, time. */
export default function AgentActivityList({ events, hideJob, hideCandidate, onNavigate, dense }: AgentActivityListProps) {
  return (
    <ul className="divide-y divide-line">
      {events.map((ev) => {
        const agent = agentMeta(ev.agent);
        const Icon = agent.icon;
        const action = actionMeta(ev.action);
        return (
          <li key={ev.id} className={`flex items-start gap-3 ${dense ? "py-2.5" : "py-3.5"}`}>
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600"
              title={agent.label}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="sr-only">{agent.label}</span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {!hideCandidate &&
                  (ev.candidate_id ? (
                    <Link
                      to={`/candidates/${ev.candidate_id}`}
                      onClick={onNavigate}
                      className="truncate text-sm font-medium text-ink hover:text-navy-600 hover:underline"
                    >
                      {ev.candidate_name || "Candidate"}
                    </Link>
                  ) : ev.candidate_name ? (
                    <span className="truncate text-sm font-medium text-ink">{ev.candidate_name}</span>
                  ) : null)}
                {!hideJob && ev.job_id && (
                  <span className="min-w-0 truncate text-xs text-muted">
                    {!hideCandidate && (ev.candidate_id || ev.candidate_name) ? "for " : ""}
                    <Link
                      to={`/jobs/${ev.job_id}`}
                      onClick={onNavigate}
                      className="font-medium text-navy-600 hover:text-navy-800 hover:underline"
                    >
                      {ev.job_title || "Job"}
                    </Link>
                  </span>
                )}
                <Badge tone={action.tone}>{action.label}</Badge>
              </div>
              {ev.summary && <p className="mt-0.5 break-words text-sm text-ink-soft">{ev.summary}</p>}
            </div>
            <time
              dateTime={ev.created_at}
              title={formatDateTime(ev.created_at)}
              className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted"
            >
              {formatRelative(ev.created_at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
