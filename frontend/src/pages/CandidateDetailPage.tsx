import React, { useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAppSelector } from "../hooks/useAppSelector";
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  IndianRupee,
  Calendar,
  Video,
  PhoneCall,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  ExternalLink,
  UserX,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  useGetCandidateByIdQuery,
  useGetCandidateTimelineQuery,
} from "../store/api/candidateApi";
import type { ApplicationEntry, InterviewEntry } from "../store/api/candidateApi";
import { useNotify } from "../hooks/useNotify";
import { formatINR, getErrorStatus } from "../lib/format";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, buttonClasses } from "../components/ui";
import { Avatar } from "../components/jobs/jobBadges";
import StageSelect from "../components/pipeline/StageSelect";
import AddToPipelineModal from "../components/resume-search/AddToPipelineModal";

const INTERVIEW_TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={12} />,
  phone: <PhoneCall size={12} />,
  face_to_face: <Users size={12} />,
};

const INTERVIEW_STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  scheduled: { color: "text-navy-600", icon: <Clock size={12} /> },
  completed: { color: "text-success-700", icon: <CheckCircle2 size={12} /> },
  cancelled: { color: "text-muted", icon: <XCircle size={12} /> },
  no_show: { color: "text-danger-600", icon: <AlertCircle size={12} /> },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function InterviewRow({ interview }: { interview: InterviewEntry }) {
  const typeIcon = INTERVIEW_TYPE_ICONS[interview.type] ?? <Users size={12} />;
  const statusStyle = INTERVIEW_STATUS_STYLES[interview.status] ?? INTERVIEW_STATUS_STYLES.scheduled;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs text-ink-soft">
      <span className="text-muted" aria-hidden="true">
        {typeIcon}
      </span>
      <span className="capitalize">{interview.type.replace(/_/g, " ")}</span>
      <span className="text-line-strong" aria-hidden="true">·</span>
      <span>
        {fmtDate(interview.scheduled_at)}{" "}
        {new Date(interview.scheduled_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      {interview.interviewer_name && (
        <>
          <span className="text-line-strong" aria-hidden="true">·</span>
          <span>{interview.interviewer_name}</span>
        </>
      )}
      <span className={`ml-auto flex items-center gap-1 font-medium ${statusStyle.color}`}>
        {statusStyle.icon}
        <span className="capitalize">{interview.status.replace(/_/g, " ")}</span>
      </span>
    </div>
  );
}

function ApplicationCard({ entry, candidateName }: { entry: ApplicationEntry; candidateName: string }) {
  const showReason = !!entry.rejection_reason && (entry.stage === "disqualified" || entry.stage === "offer_rejected");
  return (
    <div className="zh-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/jobs/${entry.job_id}`}
            className="text-sm font-semibold text-ink hover:text-navy-600 hover:underline"
          >
            {entry.job_title}
          </Link>
          {entry.job_location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <MapPin size={12} aria-hidden="true" />
              {entry.job_location}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/pipeline/${entry.job_id}`} className={buttonClasses("ghost", "sm")}>
            <TrendingUp size={14} aria-hidden="true" />
            Pipeline
          </Link>
          <StageSelect
            size="sm"
            value={entry.stage}
            applicationId={entry.id}
            candidateName={candidateName}
            label={`Stage for ${entry.job_title}`}
            className="w-48"
          />
        </div>
      </div>

      {showReason && (
        <p className="mb-3 text-xs text-muted">
          Reason: <span className="text-ink-soft">{entry.rejection_reason}</span>
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Calendar size={12} aria-hidden="true" />
          Applied {fmtDate(entry.created_at)}
        </span>
        {entry.ai_score != null && <Badge tone="navy">AI match {Math.round(entry.ai_score)}%</Badge>}
      </div>

      {entry.notes && <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-sm italic text-ink-soft">{entry.notes}</p>}

      {(entry.interviews ?? []).length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1 text-xs font-medium text-muted">Interviews ({(entry.interviews ?? []).length})</p>
          {(entry.interviews ?? []).map((iv) => (
            <InterviewRow key={iv.id} interview={iv} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink">
      <span className="flex-shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth?.accessToken) ?? localStorage.getItem("jwt");

  const notify = useNotify();
  const [showAddToJob, setShowAddToJob] = useState(false);
  const {
    data: candidate,
    isLoading: candidateLoading,
    error: candidateError,
    refetch: refetchCandidate,
    isFetching: candidateFetching,
  } = useGetCandidateByIdQuery(id!);
  const {
    data: timeline = [],
    isLoading: timelineLoading,
    error: timelineError,
    refetch: refetchTimeline,
  } = useGetCandidateTimelineQuery(id!);

  const isLoading = candidateLoading || timelineLoading;
  const candidateNotFound = getErrorStatus(candidateError) === 404;

  const openResume = useCallback(async () => {
    if (!id) return;
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000/v1";
    let resp: Response;
    try {
      resp = await fetch(`${base}/candidates/${id}/resume`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      notify.error("Could not load resume. Check your connection and try again.");
      return;
    }
    if (!resp.ok) { notify.error("Resume not available"); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [id, token, notify]);

  const fullName = candidate ? `${candidate.first_name} ${candidate.last_name}` : "";
  const breadcrumbs = [{ label: "Candidates", to: "/candidates" }, { label: fullName || "Candidate" }];

  if (isLoading) {
    return (
      <>
        <PageHeader title="Candidate" breadcrumbs={breadcrumbs} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading candidate">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="zh-card flex items-start gap-4 p-5 sm:p-6">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64 max-w-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  if (candidateError && !candidateNotFound) {
    return (
      <>
        <PageHeader title="Candidate" breadcrumbs={breadcrumbs} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            <ErrorState
              error={candidateError}
              title="Couldn't load this candidate"
              retrying={candidateFetching}
              onRetry={() => {
                refetchCandidate();
                refetchTimeline();
              }}
            />
          </div>
        </div>
      </>
    );
  }

  if (!candidate) {
    return (
      <>
        <PageHeader title="Candidate not found" breadcrumbs={breadcrumbs} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            <EmptyState
              icon={<UserX size={22} aria-hidden="true" />}
              title="Candidate not found"
              description="This profile may have been removed, or you may not have access to it."
              action={
                <Button variant="secondary" onClick={() => navigate("/candidates")}>
                  Back to candidates
                </Button>
              }
            />
          </div>
        </div>
      </>
    );
  }

  const skills: string[] = candidate.skills ?? [];

  return (
    <>
      <PageHeader
        title={fullName}
        subtitle={
          candidate.current_title
            ? `${candidate.current_title}${candidate.current_company ? ` at ${candidate.current_company}` : ""}`
            : "Full profile and application history"
        }
        breadcrumbs={breadcrumbs}
        actions={
          <>
            {candidate.resume_url && (
              <Button variant="secondary" onClick={openResume} icon={<FileText size={16} />} iconRight={<ExternalLink size={14} />}>
                View resume
              </Button>
            )}
            <Button icon={<Plus size={16} />} onClick={() => setShowAddToJob(true)}>
              Add to job
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Identity card */}
          <div className="zh-card p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <Avatar name={fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-ink">{fullName}</h2>
                {candidate.current_title && (
                  <p className="mt-0.5 text-sm text-muted">
                    {candidate.current_title}
                    {candidate.current_company && ` at ${candidate.current_company}`}
                  </p>
                )}
                {skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {skills.slice(0, 8).map((skill) => (
                      <Badge key={skill} tone="navy">
                        {skill}
                      </Badge>
                    ))}
                    {skills.length > 8 && <Badge>+{skills.length - 8} more</Badge>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="zh-card space-y-3 p-5">
              <h3 className="text-sm font-semibold text-ink">Contact</h3>
              {candidate.email && (
                <InfoRow icon={<Mail size={14} />}>
                  <a href={`mailto:${candidate.email}`} className="block truncate hover:text-navy-600 hover:underline">
                    {candidate.email}
                  </a>
                </InfoRow>
              )}
              {candidate.phone && <InfoRow icon={<Phone size={14} />}>{candidate.phone}</InfoRow>}
              {candidate.current_location && <InfoRow icon={<MapPin size={14} />}>{candidate.current_location}</InfoRow>}
              {!candidate.email && !candidate.phone && !candidate.current_location && (
                <p className="text-sm text-muted">No contact details on file.</p>
              )}
            </div>

            <div className="zh-card space-y-3 p-5">
              <h3 className="text-sm font-semibold text-ink">Career</h3>
              {candidate.experience_years != null && (
                <InfoRow icon={<Briefcase size={14} />}>{candidate.experience_years} yrs experience</InfoRow>
              )}
              {candidate.notice_period_days != null && (
                <InfoRow icon={<Clock size={14} />}>{candidate.notice_period_days} days notice</InfoRow>
              )}
              {(candidate.current_ctc != null || candidate.expected_ctc != null) && (
                <InfoRow icon={<IndianRupee size={14} />}>
                  {candidate.current_ctc != null && `Current: ${formatINR(candidate.current_ctc)}`}
                  {candidate.current_ctc != null && candidate.expected_ctc != null && " · "}
                  {candidate.expected_ctc != null && `Expected: ${formatINR(candidate.expected_ctc)}`}
                </InfoRow>
              )}
              {candidate.source && (
                <InfoRow icon={<Calendar size={14} />}>
                  Source: <span className="capitalize">{candidate.source}</span>
                </InfoRow>
              )}
            </div>
          </div>

          {/* Summary */}
          {candidate.summary && (
            <div className="zh-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-ink">Summary</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{candidate.summary}</p>
            </div>
          )}

          {/* Application timeline */}
          <section aria-labelledby="application-history">
            <h3 id="application-history" className="mb-3 text-base font-semibold text-ink">
              Application history
              {timeline.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">
                  ({timeline.length} job{timeline.length !== 1 ? "s" : ""})
                </span>
              )}
            </h3>
            {timelineError ? (
              <div className="zh-card">
                <ErrorState
                  compact
                  error={timelineError}
                  title="Couldn't load application history"
                  onRetry={() => refetchTimeline()}
                />
              </div>
            ) : timeline.length === 0 ? (
              <div className="zh-card">
                <EmptyState
                  compact
                  icon={<Briefcase size={22} aria-hidden="true" />}
                  title="No job applications yet"
                  description="When this candidate is added to a job, the application and its interviews show up here."
                  action={
                    <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setShowAddToJob(true)}>
                      Add to job
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.map((entry) => (
                  <ApplicationCard key={entry.id} entry={entry} candidateName={fullName} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showAddToJob && (
        <AddToPipelineModal
          candidates={[candidate]}
          excludeJobIds={timeline.map((t) => t.job_id)}
          onClose={() => setShowAddToJob(false)}
        />
      )}
    </>
  );
}
