import { useEffect, useMemo, useState } from "react";
import { Search, Building2, Loader2, X, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { useGetJobsQuery } from "../../store/api/jobApi";
import { useAddApplicationToJobMutation } from "../../store/api/pipelineApi";
import type { Candidate, Job, PipelineStage } from "../../types";
import { useNotify } from "../../hooks/useNotify";

// Stage keys match job_applications.stage CHECK constraint / PipelineStage type.
const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "sourced", label: "Sourced" },
  { key: "screened", label: "Screened" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "submitted_to_client", label: "Submitted to Client" },
  { key: "client_interview_scheduled", label: "Interview Scheduled" },
  { key: "interview_completed", label: "Interview Completed" },
  { key: "selected", label: "Selected" },
  { key: "offer_extended", label: "Offer Extended" },
  { key: "offer_accepted", label: "Offer Accepted" },
  { key: "joined", label: "Joined" },
  { key: "disqualified", label: "Disqualified" },
];

const DEFAULT_STAGE: PipelineStage = "shortlisted";

interface Outcome {
  added: number;
  skipped: number;
  failed: { name: string; reason: string }[];
}

function fullName(c: Candidate) {
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
 * Each candidate is added independently (allSettled) so one duplicate does not
 * mask the others; the result screen reports added / skipped / failed.
 */
export default function AddToPipelineModal({
  candidates,
  onClose,
}: {
  candidates: Candidate[];
  onClose: () => void;
}) {
  const [jobSearch, setJobSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedStage, setSelectedStage] = useState<PipelineStage>(DEFAULT_STAGE);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notify = useNotify();

  const { data: jobs = [], isLoading: fetching, isError: jobsError } = useGetJobsQuery();
  const [addApplicationToJob] = useAddApplicationToJobMutation();

  // Close on Esc (not while requests are in flight)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const openJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return jobs
      .filter((j) => j.status === "active")
      .filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          (j.client?.name ?? "").toLowerCase().includes(q),
      );
  }, [jobs, jobSearch]);

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

    const summary = `Added ${result.added}, skipped ${result.skipped} already in pipeline, failed ${result.failed.length}`;
    if (result.failed.length > 0) notify.error(summary);
    else notify.success(summary);
  };

  const stageLabel = PIPELINE_STAGES.find((s) => s.key === selectedStage)?.label;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !submitting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-pipeline-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 id="add-to-pipeline-title" className="font-semibold text-gray-900">Add to Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {candidates.length === 1
                ? `Adding ${fullName(candidates[0])}`
                : `Adding ${candidates.length} candidates`}
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} aria-label="Close" className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        {outcome ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center gap-3 text-center">
              {outcome.failed.length === 0 ? (
                <CheckCircle2 size={40} className="text-emerald-500" />
              ) : (
                <AlertCircle size={40} className="text-amber-500" />
              )}
              <p className="font-semibold text-gray-900">
                Added {outcome.added}, skipped {outcome.skipped} already in pipeline, failed {outcome.failed.length}
              </p>
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">{selectedJob?.title}</span>
                {" — "}
                <span className="font-medium text-gray-700">{stageLabel}</span>
              </p>
              {outcome.failed.length > 0 && (
                <ul className="w-full text-left text-xs text-red-600 bg-red-50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {outcome.failed.map((f, i) => (
                    <li key={i}><span className="font-medium">{f.name}</span>: {f.reason}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={onClose} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Open job</label>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs…"
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {fetching ? (
                <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
              ) : jobsError ? (
                <p className="text-center text-sm text-red-500 py-8">Could not load jobs</p>
              ) : openJobs.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No open jobs found</p>
              ) : (
                <div className="space-y-2">
                  {openJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${selectedJob?.id === job.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"}`}
                    >
                      <span className="font-medium text-sm text-gray-900 truncate block">{job.title}</span>
                      {job.client?.name && (
                        <p className="text-xs text-gray-500 mt-1">
                          <Building2 size={10} className="inline mr-1" />{job.client.name}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 space-y-3">
              <div>
                <label htmlFor="pipeline-stage" className="block text-xs font-medium text-gray-500 mb-1.5">Stage</label>
                <div className="relative">
                  <select
                    id="pipeline-stage"
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value as PipelineStage)}
                    className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{openJobs.length} open jobs</p>
                <div className="flex gap-3">
                  <button onClick={onClose} disabled={submitting} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Cancel</button>
                  <button
                    onClick={handleAdd}
                    disabled={!selectedJob || submitting}
                    className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium"
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    Add {candidates.length > 1 ? `${candidates.length} Candidates` : "Candidate"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
