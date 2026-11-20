import { useMemo, useState } from "react";
import { Search, Building2, CheckCircle2, AlertCircle, ChevronDown, Briefcase } from "lucide-react";
import { useGetJobsQuery } from "../../store/api/jobApi";
import { useAddApplicationToJobMutation } from "../../store/api/pipelineApi";
import type { Candidate, Job, PipelineStage } from "../../types";
import { useNotify } from "../../hooks/useNotify";
import { STAGES } from "../../lib/stages";
import { Button, EmptyState, ErrorState, Modal, Skeleton, StageBadge } from "../ui";

// Stage keys match job_applications.stage CHECK constraint / PipelineStage type.
// "offer_rejected" is not offered when adding a candidate (same list as before).
const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = STAGES.filter((s) => s.key !== "offer_rejected").map(
  (s) => ({ key: s.key as PipelineStage, label: s.label }),
);

const DEFAULT_STAGE: PipelineStage = "shortlisted";

export interface AddToPipelineOutcome {
  added: number;
  skipped: number;
  failed: { name: string; reason: string }[];
}

type Outcome = AddToPipelineOutcome;

/** The modal only needs these fields, so callers can pass partial candidate rows. */
export type PipelineCandidate = Pick<Candidate, "id" | "first_name" | "last_name">;

function fullName(c: PipelineCandidate) {
  return `${c.first_name} ${c.last_name}`.trim();
}

function errorStatus(err: unknown): number | string | undefined {
  return (err as { status?: number | string } | undefined)?.status;
}

function errorMessage(err: unknown): string {
  const e = err as { data?: { message?: string }; error?: string; message?: string } | undefined;
  return e?.data?.message ?? e?.error ?? e?.message ?? "Unknown error";
}

/**
 * Single-step "Add to Pipeline": pick an open job and a stage on one screen.
 * Works for one candidate or many. Each candidate is added independently
 * (allSettled) so one duplicate does not mask the others; the result screen
 * reports added / skipped / failed.
 */
export default function AddToPipelineModal({
  candidates,
  onClose,
  onAdded,
  excludeJobIds,
}: {
  candidates: PipelineCandidate[];
  onClose: () => void;
  /** Called once the adds settle (before the result screen), e.g. to clear a selection. */
  onAdded?: (outcome: AddToPipelineOutcome) => void;
  /** Jobs to leave out of the list, e.g. ones the candidate is already in. */
  excludeJobIds?: string[];
}) {
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedStage, setSelectedStage] = useState<PipelineStage>(DEFAULT_STAGE);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notify = useNotify();

  const { data: jobs = [], isLoading: fetching, isError: jobsError, error: jobsErr, refetch } = useGetJobsQuery();
  const [addApplicationToJob] = useAddApplicationToJobMutation();

  const openJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return jobs
      .filter((j) => j.status === "active")
      .filter((j) => !excludeJobIds?.includes(j.id))
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          (j.client?.name ?? "").toLowerCase().includes(q),
      );
  }, [jobs, jobSearch, excludeJobIds]);

  const handleAdd = async () => {
    if (!selectedJob || submitting) return;
    setSubmitting(true);
    const settled = await Promise.allSettled(
      candidates.map((c) =>
        addApplicationToJob({ jobId: selectedJob.id, candidateId: c.id, stage: selectedStage }).unwrap(),
      ),
    );
    const result: Outcome = { added: 0, skipped: 0, failed: [] };
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") result.added++;
      else if (errorStatus(s.reason) === 409) result.skipped++;
      else result.failed.push({ name: fullName(candidates[i]), reason: errorMessage(s.reason) });
    });
    setSubmitting(false);
    setOutcome(result);
    onAdded?.(result);

    const summary = `Added ${result.added}, skipped ${result.skipped} already in pipeline, failed ${result.failed.length}`;
    if (result.failed.length > 0) notify.error(summary);
    else notify.success(summary);
  };

  const subtitle =
    candidates.length === 1 ? `Adding ${fullName(candidates[0])}` : `Adding ${candidates.length} candidates`;

  if (outcome) {
    return (
      <Modal open onClose={onClose} title="Add to pipeline" description={subtitle} footer={<Button onClick={onClose}>Done</Button>}>
        <div className="flex flex-col items-center gap-3 text-center">
          {outcome.failed.length === 0 ? (
            <CheckCircle2 size={40} className="text-success-600" aria-hidden="true" />
          ) : (
            <AlertCircle size={40} className="text-warning-600" aria-hidden="true" />
          )}
          <p className="font-semibold text-ink">
            Added {outcome.added}, skipped {outcome.skipped} already in pipeline, failed {outcome.failed.length}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <span className="font-medium text-ink">{selectedJob?.title}</span>
            <StageBadge stage={selectedStage} />
          </p>
          {outcome.failed.length > 0 && (
            <ul className="max-h-40 w-full space-y-1 overflow-y-auto rounded-lg bg-danger-50 p-3 text-left text-xs text-danger-700">
              {outcome.failed.map((f, i) => (
                <li key={i}>
                  <span className="font-medium">{f.name}</span>: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add to pipeline"
      description={subtitle}
      preventClose={submitting}
      footer={
        <>
          <p className="mr-auto hidden self-center text-xs text-muted sm:block">{openJobs.length} open jobs</p>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedJob} loading={submitting}>
            Add {candidates.length > 1 ? `${candidates.length} candidates` : "candidate"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="pipeline-job-search" className="zh-label">
            Open job
          </label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="pipeline-job-search"
              type="text"
              value={jobSearch}
              onChange={(e) => setJobSearch(e.target.value)}
              placeholder="Search jobs…"
              data-autofocus
              className="zh-input pl-9"
            />
          </div>
        </div>

        {fetching ? (
          <div className="space-y-2" role="status" aria-label="Loading jobs">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : jobsError ? (
          <ErrorState error={jobsErr} title="Could not load jobs" onRetry={refetch} compact />
        ) : openJobs.length === 0 ? (
          <EmptyState icon={<Briefcase size={22} aria-hidden="true" />} title="No open jobs found" compact />
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {openJobs.map((job) => {
              const active = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJob(job)}
                  aria-pressed={active}
                  className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    active ? "border-navy-600 bg-navy-50 ring-1 ring-navy-600" : "border-line hover:border-line-strong hover:bg-surface"
                  }`}
                >
                  <span className="block truncate text-sm font-medium text-ink">{job.title}</span>
                  {job.client?.name && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Building2 size={12} aria-hidden="true" />
                      {job.client.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div>
          <label htmlFor="pipeline-stage" className="zh-label">
            Stage
          </label>
          <div className="relative">
            <select
              id="pipeline-stage"
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as PipelineStage)}
              className="zh-input appearance-none pr-9"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
