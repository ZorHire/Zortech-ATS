import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/api';
import {
  MapPin,
  Users,
  Clock,
  Briefcase,
  ChevronDown,
  Mail,
  Building2,
  TrendingUp,
  UserPlus,
  Sparkles,
  Globe,
  IndianRupee,
  Plus,
  Check,
} from 'lucide-react';
import { useGetJobQuery, useUpdateJobMutation } from '../store/api/jobApi';
import { useAddApplicationToJobMutation } from '../store/api/pipelineApi';
import AssignJdModal from '../components/vendors/AssignJdModal';
import { useAppSelector } from '../hooks/useAppSelector';
import { selectCurrentUser } from '../store/slices/authSlice';
import AddCandidateModal from '../components/candidates/AddCandidateModal';
import { generateBooleanQueries } from '../lib/booleanQueryGenerator';
import CopyButton from '../components/common/CopyButton';
import JdApprovalPanel from '../components/jobs/JdApprovalPanel';
import JdVersionHistory from '../components/jobs/JdVersionHistory';
import JobBoardStatusSection from '../components/jobs/JobBoardStatusSection';
import JobBoardPublishModal from '../components/jobs/JobBoardPublishModal';
import { useNotify } from '../hooks/useNotify';
import { formatINR, getErrorMessage, getErrorStatus } from '../lib/format';
import {
  Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, buttonClasses, useConfirm,
} from '../components/ui';
import { JobStatusBadge, PriorityBadge, Avatar } from '../components/jobs/jobBadges';

const workModeLabel: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
};

interface CandidateMatch {
  id: string;
  first_name: string;
  last_name: string;
  current_title: string | null;
  current_location: string | null;
  skills: string[] | null;
  similarity: number;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed_filled', label: 'Closed - Filled' },
  { value: 'closed_cancelled', label: 'Closed - Cancelled' },
  { value: 'expired', label: 'Expired' },
];

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useAppSelector(selectCurrentUser);
  const { data: job, isLoading, error, refetch, isFetching } = useGetJobQuery(id!, { skip: !id });
  const [updateJob, { isLoading: statusChanging }] = useUpdateJobMutation();
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [matches, setMatches] = useState<CandidateMatch[] | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isPublishBoardsOpen, setIsPublishBoardsOpen] = useState(false);
  const [isAssignVendorsOpen, setIsAssignVendorsOpen] = useState(false);
  // Matching results: which ones are in this job's pipeline (added now or already there) / being added.
  const [inPipeline, setInPipeline] = useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addApplicationToJob] = useAddApplicationToJobMutation();
  const notify = useNotify();
  const confirm = useConfirm();

  const handleFindMatches = async () => {
    if (!id) return;
    setMatchesLoading(true);
    setMatchesError(null);
    try {
      const data = await api.post(`/jobs/${id}/matches`, {});
      setMatches(data.matches ?? []);
      setInPipeline(new Set());
    } catch (err: unknown) {
      setMatchesError(getErrorMessage(err, 'Failed to find matching candidates'));
    } finally {
      setMatchesLoading(false);
    }
  };

  // Adds matches to this job's pipeline as "Shortlisted" (same API as Add to pipeline elsewhere).
  // A 409 means the candidate is already in the pipeline, which counts as done.
  const addMatchesToPipeline = async (list: CandidateMatch[]) => {
    if (!id) return;
    const todo = list.filter((c) => !inPipeline.has(c.id) && !addingIds.has(c.id));
    if (todo.length === 0) return;
    setAddingIds((prev) => new Set([...prev, ...todo.map((c) => c.id)]));
    const settled = await Promise.allSettled(
      todo.map((c) => addApplicationToJob({ jobId: id, candidateId: c.id, stage: 'shortlisted' }).unwrap()),
    );
    let added = 0;
    let already = 0;
    const done: string[] = [];
    const failed: string[] = [];
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        added++;
        done.push(todo[i].id);
      } else if (getErrorStatus(res.reason) === 409) {
        already++;
        done.push(todo[i].id);
      } else {
        failed.push(`${todo[i].first_name} ${todo[i].last_name}`);
      }
    });
    setInPipeline((prev) => new Set([...prev, ...done]));
    setAddingIds((prev) => {
      const next = new Set(prev);
      todo.forEach((c) => next.delete(c.id));
      return next;
    });
    if (todo.length === 1) {
      const name = `${todo[0].first_name} ${todo[0].last_name}`;
      if (added) notify.success(`${name} added to the pipeline as Shortlisted`);
      else if (already) notify.info(`${name} is already in this pipeline`);
      else notify.error(`Could not add ${name} to the pipeline`);
      return;
    }
    const summary = `Added ${added}, ${already} already in pipeline${failed.length ? `, failed ${failed.length}` : ''}`;
    if (failed.length) notify.error(summary);
    else notify.success(summary);
  };

  const canEditStatus =
    profile?.role === 'super_admin' ||
    profile?.role === 'accounts_manager' ||
    profile?.role === 'recruiter';

  // Roles that can reach the Assign-JD flow on the Vendors page (mirrors the sidebar's /vendors roles).
  const canAssignVendors =
    profile?.role === 'super_admin' ||
    profile?.role === 'accounts_manager' ||
    profile?.role === 'vendor_manager';

  const handleStatusChange = async (newStatus: string) => {
    if (!job || !id) return;
    if (newStatus === 'closed_filled' || newStatus === 'closed_cancelled') {
      const label = STATUS_OPTIONS.find((o) => o.value === newStatus)?.label ?? newStatus;
      const ok = await confirm({
        title: `Change this job to ${label}?`,
        message: 'This stops hiring on the job.',
        confirmText: 'Change status',
      });
      if (!ok) return;
    }
    try {
      await updateJob({ id, body: { status: newStatus } }).unwrap();
      notify.success('Job status updated');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Failed to update job status'));
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Job details" breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: 'Loading…' }]} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading job">
          <div className="zh-card space-y-4 p-6">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error || !job) {
    const notFound = !error || getErrorStatus(error) === 404;
    return (
      <>
        <PageHeader title="Job details" breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: 'Not found' }]} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            {notFound ? (
              <EmptyState
                icon={<Briefcase size={22} />}
                title="Job not found"
                description="It may have been deleted, or you don't have access to it."
                action={<Link to="/jobs" className={buttonClasses('secondary')}>Back to jobs</Link>}
              />
            ) : (
              <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
            )}
          </div>
        </div>
      </>
    );
  }

  const salary =
    job.salary_min && job.salary_max
      ? `${formatINR(job.salary_min)} – ${formatINR(job.salary_max)}`
      : 'Salary not specified';

  const booleanQueries = generateBooleanQueries({
    title: job.title,
    mandatory_skills: job.mandatory_skills ?? [],
    preferred_skills: job.preferred_skills ?? [],
    location: job.location ?? '',
    experience_min: job.experience_min,
    experience_max: job.experience_max,
  });

  const subtitle = [job.client?.name, job.location].filter(Boolean).join(' · ');
  const showInternal = profile && profile.role !== 'vendor_user' && (profile.role as string) !== 'client_user';

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={subtitle || undefined}
        breadcrumbs={[{ label: 'Jobs', to: '/jobs' }, { label: job.title }]}
        actions={
          <>
            <Link to={`/pipeline/${id}`} className={buttonClasses('secondary')}>
              <TrendingUp size={16} />
              Pipeline ({job.application_count ?? 0})
            </Link>
            {canAssignVendors && (
              <Button variant="secondary" icon={<Mail size={16} />} onClick={() => setIsAssignVendorsOpen(true)}>
                Send to vendors
              </Button>
            )}
            {canEditStatus && (
              <Button variant="secondary" icon={<Globe size={16} />} onClick={() => setIsPublishBoardsOpen(true)}>
                Publish to boards
              </Button>
            )}
            <Button icon={<UserPlus size={16} />} onClick={() => setIsAddCandidateOpen(true)}>
              Add candidate
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Main info card */}
        <div className="zh-card space-y-6 p-5 sm:p-6">
          {/* Client + badges */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              <Building2 size={15} />
              <span className="truncate">{job.client?.name ?? 'No client'}</span>
              {job.client?.tier === 'priority' && <Badge tone="brand">Priority client</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEditStatus ? (
                <div className="relative">
                  <select
                    aria-label="Job status"
                    value={job.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusChanging}
                    className="cursor-pointer appearance-none rounded-lg border border-line bg-white py-1 pl-2.5 pr-7 text-xs font-medium text-ink hover:border-line-strong disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              ) : (
                <JobStatusBadge status={job.status} />
              )}
              <PriorityBadge priority={job.priority} />
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="text-muted" />
                {job.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Briefcase size={15} className="text-muted" />
              {workModeLabel[job.work_mode] ?? job.work_mode}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-muted" />
              {job.experience_min}–{job.experience_max} yrs
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={15} className="text-muted" />
              {job.headcount} headcount
            </span>
            <span className="flex items-center gap-1.5">
              <IndianRupee size={15} className="text-muted" />
              {salary}
            </span>
            {job.department && <span>{job.department}</span>}
          </div>

          {/* Skills */}
          {job.mandatory_skills.length > 0 && (
            <Section title="Mandatory skills">
              <div className="flex flex-wrap gap-1.5">
                {job.mandatory_skills.map((skill) => (
                  <Badge key={skill} tone="navy">{skill}</Badge>
                ))}
              </div>
            </Section>
          )}

          {job.preferred_skills && job.preferred_skills.length > 0 && (
            <Section title="Preferred skills">
              <div className="flex flex-wrap gap-1.5">
                {job.preferred_skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Sourcing — boolean search strings for external job boards */}
          <Section title="Sourcing — Boolean search">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface p-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted">LinkedIn (X-ray search via Google)</p>
                  <CopyButton text={booleanQueries.linkedin} />
                </div>
                <p className="break-all font-mono text-xs text-ink-soft">{booleanQueries.linkedin}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted">Naukri, Indeed, Monster, Glassdoor</p>
                  <CopyButton text={booleanQueries.generic} />
                </div>
                <p className="break-all font-mono text-xs text-ink-soft">{booleanQueries.generic}</p>
              </div>
            </div>
          </Section>

          {/* Matching — vector-similarity candidate search */}
          <Section
            title="Matching candidates"
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={<Sparkles size={14} />}
                onClick={handleFindMatches}
                loading={matchesLoading}
                loadingText="Searching…"
              >
                Find matching candidates
              </Button>
            }
          >
            {matchesError && (
              <p role="alert" className="rounded-lg border border-danger-50 bg-danger-50 p-2.5 text-sm text-danger-700">
                {matchesError}
              </p>
            )}

            {matches && matches.length === 0 && !matchesError && (
              <p className="text-sm text-muted">
                No matching candidates found — candidates need an embedding before they can be matched.
              </p>
            )}

            {matches && matches.length > 0 && (
              <>
                {canEditStatus && (
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted">
                      {matches.length} match{matches.length !== 1 ? 'es' : ''} · added as Shortlisted
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus size={14} />}
                      onClick={() => addMatchesToPipeline(matches)}
                      disabled={matches.every((c) => inPipeline.has(c.id))}
                      loading={addingIds.size > 1}
                      loadingText="Adding…"
                    >
                      Add all
                    </Button>
                  </div>
                )}
                <ul className="space-y-1.5">
                  {matches.map((c) => {
                    const name = `${c.first_name} ${c.last_name}`;
                    const added = inPipeline.has(c.id);
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <Link
                              to={`/candidates/${c.id}`}
                              className="block truncate text-sm font-medium text-ink hover:text-navy-600 hover:underline"
                            >
                              {name}
                            </Link>
                            <p className="truncate text-xs text-muted">
                              {c.current_title || 'No title'}
                              {c.current_location ? ` · ${c.current_location}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="success">{Math.round(c.similarity * 100)}% match</Badge>
                          {canEditStatus &&
                            (added ? (
                              <Badge tone="navy" icon={<Check size={12} aria-hidden="true" />}>
                                In pipeline
                              </Badge>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Plus size={14} />}
                                loading={addingIds.has(c.id)}
                                onClick={() => addMatchesToPipeline([c])}
                                aria-label={`Add ${name} to pipeline`}
                              >
                                Add to pipeline
                              </Button>
                            ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Section>

          {/* Description */}
          {job.description && (
            <Section title="Description">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{job.description}</p>
            </Section>
          )}
        </div>

        {/* Pipeline CTA */}
        <div className="zh-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">Candidate pipeline</p>
            <p className="mt-0.5 text-sm text-muted">
              {job.application_count
                ? `${job.application_count} candidate${job.application_count !== 1 ? 's' : ''} in pipeline`
                : 'No candidates added yet'}
            </p>
          </div>
          <Link to={`/pipeline/${id}`} className={buttonClasses('secondary', 'md', 'shrink-0')}>
            <TrendingUp size={16} />
            Open pipeline
          </Link>
        </div>

        {/* Job Board Distribution */}
        {showInternal && <JobBoardStatusSection jobId={id!} />}

        {/* Approval Workflow + Version History — only for non-portal roles */}
        {showInternal && profile && (
          <>
            <JdApprovalPanel jobId={id!} jobStatus={job.status} userRole={profile.role} />
            <JdVersionHistory jobId={id!} />
          </>
        )}
      </div>

      {isAddCandidateOpen && id && (
        <AddCandidateModal
          jobId={id}
          onClose={() => setIsAddCandidateOpen(false)}
          onSuccess={() => { refetch(); }}
        />
      )}

      {isAssignVendorsOpen && id && profile && (
        <AssignJdModal
          jobId={id}
          jobTitle={job.title}
          userRole={profile.role}
          onClose={() => setIsAssignVendorsOpen(false)}
        />
      )}

      {isPublishBoardsOpen && id && (
        <JobBoardPublishModal
          jobId={id}
          onClose={() => setIsPublishBoardsOpen(false)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
