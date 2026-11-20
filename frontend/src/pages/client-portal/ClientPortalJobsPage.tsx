import { Link } from "react-router-dom";
import { ChevronRight, FileText, MapPin } from "lucide-react";
import ClientPortalLayout from "../../components/client-portal/ClientPortalLayout";
import { useGetClientPortalJobsQuery } from "../../store/api/clientPortalApi";
import { Badge, CardGridSkeleton, EmptyState, ErrorState, PageHeader, StatCard } from "../../components/ui";
import type { BadgeTone } from "../../components/ui";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  on_hold: "warning",
  draft: "neutral",
  closed_filled: "navy",
};

const PRIORITY_TONE: Record<string, BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "brand",
  low: "neutral",
};

export default function ClientPortalJobsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetClientPortalJobsQuery();

  const jobs = data?.jobs ?? [];

  return (
    <ClientPortalLayout>
      <PageHeader
        title="Open positions"
        subtitle="Review candidates submitted for your open roles and share your feedback."
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {jobs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Active jobs" value={jobs.filter((j) => j.status === "active").length} />
            <StatCard
              label="Pending review"
              value={jobs.reduce((sum, j) => sum + Number(j.pending_review_count), 0)}
              tone="brand"
            />
            <StatCard
              label="Reviewed"
              value={jobs.reduce((sum, j) => sum + Number(j.reviewed_count), 0)}
              tone="success"
            />
          </div>
        )}

        {isLoading ? (
          <CardGridSkeleton count={3} />
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<FileText size={22} aria-hidden="true" />}
              title="No positions shared yet"
              description="Your recruitment team will share open roles here."
            />
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => {
              const pending = Number(job.pending_review_count);
              return (
                <li key={job.id}>
                  <Link
                    to={`/client-portal/jobs/${job.id}/candidates`}
                    className="zh-card group block p-4 transition hover:border-navy-200 hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink group-hover:text-navy-700">{job.title}</h3>
                          <Badge tone={STATUS_TONE[job.status] ?? "neutral"} className="capitalize">
                            {job.status.replace(/_/g, " ")}
                          </Badge>
                          <Badge tone={PRIORITY_TONE[job.priority] ?? "neutral"} className="capitalize">
                            {job.priority}
                          </Badge>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} aria-hidden="true" />
                              {job.location}
                            </span>
                          )}
                          <span>{job.experience_min}–{job.experience_max} yrs</span>
                          <span className="capitalize">{job.work_mode.replace("_", " ")}</span>
                          <span>{job.headcount} opening{job.headcount !== 1 ? "s" : ""}</span>
                        </div>

                        {job.mandatory_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {job.mandatory_skills.slice(0, 5).map((s) => (
                              <Badge key={s} tone="navy">{s}</Badge>
                            ))}
                            {job.mandatory_skills.length > 5 && (
                              <span className="text-xs text-muted">+{job.mandatory_skills.length - 5} more</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        {pending > 0 && <Badge tone="brand">{pending} awaiting review</Badge>}
                        {Number(job.reviewed_count) > 0 && (
                          <span className="text-xs text-muted">{job.reviewed_count} reviewed</span>
                        )}
                        <span className="ml-auto flex items-center gap-1 text-sm font-medium text-navy-600 group-hover:text-navy-800 sm:ml-0">
                          View candidates
                          <ChevronRight size={16} aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ClientPortalLayout>
  );
}
