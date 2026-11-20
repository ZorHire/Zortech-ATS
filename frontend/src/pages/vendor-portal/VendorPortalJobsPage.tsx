import { useState } from "react";
import { Briefcase, MapPin, Search, UserPlus } from "lucide-react";
import VendorPortalLayout from "../../components/vendor-portal/VendorPortalLayout";
import VendorSubmitModal from "../../components/vendor-portal/VendorSubmitModal";
import { useGetVendorPortalJobsQuery } from "../../store/api/vendorPortalApi";
import { Badge, Button, CardGridSkeleton, EmptyState, ErrorState, PageHeader } from "../../components/ui";
import type { BadgeTone } from "../../components/ui";

const PRIORITY_TONE: Record<string, BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "brand",
  low: "neutral",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  on_hold: "warning",
};

export default function VendorPortalJobsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetVendorPortalJobsQuery();
  const [submitFor, setSubmitFor] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();
  const allJobs = data?.jobs ?? [];
  const jobs = allJobs.filter(
    (j) =>
      j.title.toLowerCase().includes(q) ||
      (j.location ?? "").toLowerCase().includes(q) ||
      (j.client_name ?? "").toLowerCase().includes(q),
  );

  return (
    <VendorPortalLayout>
      {submitFor && (
        <VendorSubmitModal
          jobId={submitFor.id}
          jobTitle={submitFor.title}
          onClose={() => setSubmitFor(null)}
        />
      )}

      <PageHeader title="Assigned jobs" subtitle="Jobs your company has been assigned to source candidates for." />

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search jobs"
            placeholder="Search by title, location, or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="zh-input pl-9"
          />
        </div>

        {isLoading ? (
          <CardGridSkeleton count={2} />
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="zh-card">
            {allJobs.length === 0 ? (
              <EmptyState
                icon={<Briefcase size={22} aria-hidden="true" />}
                title="No active jobs assigned to your company"
                description="Check back later or contact your recruiter."
              />
            ) : (
              <EmptyState icon={<Search size={22} aria-hidden="true" />} title="No jobs match your search" compact />
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id} className="zh-card p-4 transition-shadow hover:shadow-md sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{job.title}</h3>
                      <Badge tone={PRIORITY_TONE[job.priority] ?? "neutral"} className="capitalize">
                        {job.priority}
                      </Badge>
                      <Badge tone={STATUS_TONE[job.status] ?? "neutral"} className="capitalize">
                        {job.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      {job.client_name && <span>{job.client_name}</span>}
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
                        {job.mandatory_skills.slice(0, 6).map((s) => (
                          <Badge key={s} tone="navy">{s}</Badge>
                        ))}
                        {job.mandatory_skills.length > 6 && (
                          <span className="text-xs text-muted">+{job.mandatory_skills.length - 6} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-row-reverse items-center justify-between gap-2 sm:flex-col sm:items-end">
                    <Button
                      icon={<UserPlus size={16} aria-hidden="true" />}
                      onClick={() => setSubmitFor({ id: job.id, title: job.title })}
                    >
                      Submit candidate
                    </Button>
                    {job.my_submission_count > 0 && (
                      <Badge tone="success">{job.my_submission_count} submitted</Badge>
                    )}
                  </div>
                </div>

                {job.sla_deadline && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-xs text-muted">
                      Submission deadline:{" "}
                      <span className="font-medium text-ink-soft">
                        {new Date(job.sla_deadline).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </VendorPortalLayout>
  );
}
