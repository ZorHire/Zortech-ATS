import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Building2, Users, Briefcase, ChevronRight } from "lucide-react";
import { Job } from "../../types";
import { EmptyState, Modal } from "../ui";
import { JobStatusBadge, PriorityBadge } from "../jobs/jobBadges";

interface Props {
  jobs: Job[];
  onClose: () => void;
}

export default function PipelineJobSelector({ jobs, onClose }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.client?.name || "").toLowerCase().includes(q) ||
        j.mandatory_skills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [jobs, search]);

  const handleSelect = (jobId: string) => {
    setSelectedId(jobId);
    navigate(`/pipeline/${jobId}`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Select a job"
      description="Choose which job's pipeline to view"
      size="lg"
      closeOnBackdrop
      bodyClassName="!p-0"
      footer={
        <p className="w-full text-center text-xs text-muted">
          {filtered.length} of {jobs.length} job{jobs.length !== 1 ? "s" : ""} shown
        </p>
      }
    >
      {/* Search */}
      <div className="sticky top-0 z-[1] border-b border-line bg-white px-5 py-3 sm:px-6">
        <label htmlFor="pipeline-job-search" className="sr-only">
          Search jobs
        </label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="pipeline-job-search"
            data-autofocus
            type="text"
            placeholder="Search by title, client or skill…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="zh-input pl-9"
          />
        </div>
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <EmptyState
          compact
          icon={<Briefcase size={22} aria-hidden="true" />}
          title="No jobs found"
          description={jobs.length === 0 ? "There are no jobs to show yet." : "Try a different search term."}
        />
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((job) => (
            <li key={job.id}>
              <button
                type="button"
                onClick={() => handleSelect(job.id)}
                className={`group w-full px-5 py-3.5 text-left transition-colors hover:bg-surface sm:px-6 ${
                  selectedId === job.id ? "bg-navy-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-navy-700">{job.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {job.client?.name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={12} aria-hidden="true" />
                          {job.client.name}
                        </span>
                      )}
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} aria-hidden="true" />
                          {job.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users size={12} aria-hidden="true" />
                        {job.application_count ?? 0} candidate{(job.application_count ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {job.mandatory_skills.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {job.mandatory_skills.slice(0, 3).map((s) => (
                          <span key={s} className="rounded-md bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-700">
                            {s}
                          </span>
                        ))}
                        {job.mandatory_skills.length > 3 && (
                          <span className="text-xs text-muted">+{job.mandatory_skills.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                    <PriorityBadge priority={job.priority} />
                    <JobStatusBadge status={job.status} />
                    <ChevronRight size={16} className="hidden text-line-strong group-hover:text-navy-600 sm:block" aria-hidden="true" />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
