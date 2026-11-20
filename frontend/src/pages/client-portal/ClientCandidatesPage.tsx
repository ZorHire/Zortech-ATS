import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, FileDown, MapPin, PauseCircle, Users, X } from "lucide-react";
import ClientPortalLayout from "../../components/client-portal/ClientPortalLayout";
import {
  useGetClientPortalCandidatesQuery,
  useSubmitClientFeedbackMutation,
} from "../../store/api/clientPortalApi";
import { Badge, Button, CardGridSkeleton, EmptyState, ErrorState, Modal, PageHeader } from "../../components/ui";
import type { BadgeTone } from "../../components/ui";
import { useNotify } from "../../hooks/useNotify";

type Decision = "approved" | "rejected" | "hold";

const DECISION_CONFIG: Record<Decision, { label: string; icon: React.ReactNode; tone: BadgeTone; button: string }> = {
  approved: {
    label: "Approve",
    icon: <Check size={16} aria-hidden="true" />,
    tone: "success",
    button: "text-success-700 hover:bg-success-50",
  },
  hold: {
    label: "Hold",
    icon: <PauseCircle size={16} aria-hidden="true" />,
    tone: "warning",
    button: "text-warning-700 hover:bg-warning-50",
  },
  rejected: {
    label: "Reject",
    icon: <X size={16} aria-hidden="true" />,
    tone: "danger",
    button: "text-danger-700 hover:bg-danger-50",
  },
};

/** The API may return a storage key instead of a URL; only link real web addresses. */
function isWebUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export default function ClientCandidatesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const notify = useNotify();

  const { data: candidates = [], isLoading, isError, error, refetch, isFetching } = useGetClientPortalCandidatesQuery(jobId!);
  const [submitFeedback, { isLoading: isSaving }] = useSubmitClientFeedbackMutation();

  const [pendingDecision, setPendingDecision] = useState<{
    applicationId: string;
    decision: Decision;
    notes: string;
  } | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);

  const handleFeedback = async (applicationId: string, decision: Decision, notes: string) => {
    setSavingId(applicationId);
    try {
      await submitFeedback({ applicationId, decision, notes }).unwrap();
    } catch {
      notify.error("Couldn't save your feedback. Please try again.");
    } finally {
      setSavingId(null);
      setPendingDecision(null);
    }
  };

  const pending = candidates.filter((c) => !c.client_decision);
  const reviewed = candidates.filter((c) => !!c.client_decision);

  return (
    <ClientPortalLayout>
      <Modal
        open={!!pendingDecision}
        onClose={() => setPendingDecision(null)}
        size="sm"
        preventClose={isSaving}
        title={pendingDecision ? `${DECISION_CONFIG[pendingDecision.decision].label} candidate` : undefined}
        footer={
          pendingDecision && (
            <>
              <Button variant="secondary" onClick={() => setPendingDecision(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant={pendingDecision.decision === "rejected" ? "danger" : "primary"}
                loading={isSaving}
                loadingText="Saving…"
                onClick={() =>
                  handleFeedback(pendingDecision.applicationId, pendingDecision.decision, pendingDecision.notes)
                }
              >
                Confirm
              </Button>
            </>
          )
        }
      >
        <label htmlFor="client-feedback-notes" className="zh-label">
          Notes <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="client-feedback-notes"
          rows={3}
          value={pendingDecision?.notes ?? ""}
          onChange={(e) => setPendingDecision((p) => (p ? { ...p, notes: e.target.value } : null))}
          placeholder="Add any feedback or reasons…"
          className="zh-input resize-none"
        />
      </Modal>

      <PageHeader
        breadcrumbs={[{ label: "Open positions", to: "/client-portal/jobs" }, { label: "Candidates" }]}
        title="Candidate review"
        subtitle={isLoading ? undefined : `${pending.length} awaiting your decision · ${reviewed.length} reviewed`}
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <CardGridSkeleton count={2} />
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : candidates.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Users size={22} aria-hidden="true" />}
              title="No candidates submitted yet"
              description="Your recruiter will share candidates here once they are ready for your review."
            />
          </div>
        ) : null}

        {pending.length > 0 && (
          <section aria-labelledby="awaiting-heading">
            <h2 id="awaiting-heading" className="mb-3 text-base font-semibold text-ink">
              Awaiting review ({pending.length})
            </h2>
            <ul className="space-y-4">
              {pending.map((c) => (
                <li key={c.application_id} className="zh-card p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-ink">{c.full_name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        {c.current_title && <span>{c.current_title}</span>}
                        {c.experience_years != null && <span>{c.experience_years} yrs exp</span>}
                        {c.current_location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={14} aria-hidden="true" />
                            {c.current_location}
                          </span>
                        )}
                      </div>

                      {c.skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {c.skills.slice(0, 6).map((s) => (
                            <Badge key={s} tone="navy">{s}</Badge>
                          ))}
                        </div>
                      )}

                      {c.summary && <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{c.summary}</p>}

                      {isWebUrl(c.resume_url) && (
                        <a
                          href={c.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-800 hover:underline"
                        >
                          <FileDown size={16} aria-hidden="true" />
                          View resume
                        </a>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                      {(["approved", "hold", "rejected"] as Decision[]).map((d) => {
                        const cfg = DECISION_CONFIG[d];
                        return (
                          <Button
                            key={d}
                            variant="secondary"
                            size="md"
                            className={`flex-1 sm:flex-none sm:justify-start ${cfg.button}`}
                            icon={cfg.icon}
                            disabled={savingId === c.application_id}
                            onClick={() =>
                              setPendingDecision({ applicationId: c.application_id, decision: d, notes: "" })
                            }
                          >
                            {cfg.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviewed.length > 0 && (
          <section aria-labelledby="reviewed-heading">
            <h2 id="reviewed-heading" className="mb-3 text-base font-semibold text-ink">
              Already reviewed ({reviewed.length})
            </h2>
            <ul className="space-y-3">
              {reviewed.map((c) => {
                const cfg = DECISION_CONFIG[c.client_decision as Decision];
                return (
                  <li key={c.application_id} className="zh-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <h3 className="font-medium text-ink">{c.full_name}</h3>
                          {c.current_title && <span className="text-sm text-muted">{c.current_title}</span>}
                        </div>
                        {c.client_notes && <p className="mt-1 text-xs text-muted">{c.client_notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={cfg?.tone ?? "neutral"} icon={cfg?.icon}>
                          {cfg?.label ?? c.client_decision}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingDecision({
                              applicationId: c.application_id,
                              decision: c.client_decision as Decision,
                              notes: c.client_notes ?? "",
                            })
                          }
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </ClientPortalLayout>
  );
}
