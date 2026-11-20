import React from 'react';
import {
  X, Mail, Phone, MapPin, Clock, Calendar, Download, Eye,
  FileText, Send, Trash2, Loader2, Upload, Plus, TrendingUp,
  Video, PhoneCall, Users, Link, CheckCircle2, XCircle, AlertCircle, Sparkles,
} from 'lucide-react';
import AiInsightsTab from '../agents/AiInsightsTab';
import WhatsAppTab from '../whatsapp/WhatsAppTab';
import { Candidate } from '../../types';
import api, { ApiError } from '../../lib/api';
import { Link as RouterLink } from 'react-router-dom';
import ComposeEmailModal from './ComposeEmailModal';
import StageSelect from '../pipeline/StageSelect';
import AddToPipelineModal from '../resume-search/AddToPipelineModal';
import { useNotify } from '../../hooks/useNotify';
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton, StageBadge, buttonClasses } from '../ui';
import type { BadgeTone } from '../ui';
import { Avatar } from '../jobs/jobBadges';
import { getStage } from '../../lib/stages';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { baseApi } from '../../store/api/baseApi';
import { formatINR, getErrorMessage } from '../../lib/format';

const RESUME_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/v1';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate?: (candidate: Candidate) => void;
  /** Omit to hide "Delete candidate" (e.g. when opened from the pipeline). */
  onDelete?: (id: string) => void;
  /** Open with this application selected (e.g. the pipeline card that was clicked). */
  applicationId?: string;
}

// Order used for the progress bar only; any stage can be chosen in the StageSelect.
const FORWARD_STAGES = [
  "new", "sourced", "screened", "shortlisted", "submitted_to_client",
  "client_interview_scheduled", "interview_completed", "selected",
  "offer_extended", "offer_accepted", "joined",
] as const;

const INTERVIEW_STATUS_TONES: Record<string, BadgeTone> = {
  scheduled: "navy",
  completed: "success",
  cancelled: "neutral",
  no_show: "danger",
};

const INTERVIEW_STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Calendar size={13} />,
  completed: <CheckCircle2 size={13} />,
  cancelled: <XCircle size={13} />,
  no_show: <AlertCircle size={13} />,
};

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  video: "Video Call",
  phone: "Phone",
  face_to_face: "In-Person",
  in_person: "In-Person",
};

const CandidateModal: React.FC<CandidateModalProps> = ({ candidate, onClose, onDelete, onUpdate, applicationId }) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'resume' | 'activity' | 'ai' | 'whatsapp'>('overview');
  const [localCandidate, setLocalCandidate] = React.useState<Candidate>(candidate);
  const [resumeUploading, setResumeUploading] = React.useState(false);
  const [resumeBlobUrl, setResumeBlobUrl] = React.useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = React.useState(false);

  // Application state
  const [applications, setApplications] = React.useState<any[]>([]);
  const [appLoading, setAppLoading] = React.useState(true);
  const [selectedApp, setSelectedApp] = React.useState<any>(null);
  const [stagePrompting, setStagePrompting] = React.useState(false);
  const [showAddToJob, setShowAddToJob] = React.useState(false);

  // Compose email modal
  const [showCompose, setShowCompose] = React.useState(false);

  const notify = useNotify();
  const dispatch = useAppDispatch();


  // Schedule interview state
  const [showScheduler, setShowScheduler] = React.useState(false);
  const [interviewDate, setInterviewDate] = React.useState("");
  const [interviewTime, setInterviewTime] = React.useState("");
  const [interviewType, setInterviewType] = React.useState("video");
  const [interviewerName, setInterviewerName] = React.useState("");
  const [meetingLink, setMeetingLink] = React.useState("");
  const [interviewDuration, setInterviewDuration] = React.useState("60");
  const [scheduleSending, setScheduleSending] = React.useState(false);

  // Activity tab state
  const [pipelineHistory, setPipelineHistory] = React.useState<any[]>([]);
  const [interviews, setInterviews] = React.useState<any[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [updatingInterview, setUpdatingInterview] = React.useState<string | null>(null);
  const [activityError, setActivityError] = React.useState<string | null>(null);
  const [appError, setAppError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchApplications();
  }, [candidate.id]);

  React.useEffect(() => {
    if (activeTab === 'activity' && selectedApp) {
      fetchActivity(selectedApp.id);
    }
  }, [activeTab, selectedApp?.id]);

  // `quiet` refreshes in place (after a stage move / add to job) without the skeleton.
  const fetchApplications = async (quiet = false, preferId?: string) => {
    if (!quiet) setAppLoading(true);
    setAppError(null);
    try {
      const data = await api.get(`/pipeline/candidates/${candidate.id}/applications`);
      const list = Array.isArray(data) ? data : [];
      setApplications(list);
      const wanted = preferId ?? applicationId;
      setSelectedApp(list.find((a) => a.id === wanted) ?? list[0] ?? null);
    } catch (err) {
      // 404 means the candidate is not in any pipeline yet; anything else is a real failure
      if (!(err instanceof ApiError && err.status === 404)) {
        setAppError(getErrorMessage(err, "Could not load applications"));
      }
    } finally {
      setAppLoading(false);
    }
  };

  const fetchActivity = async (appId: string) => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const [history, ivs] = await Promise.all([
        api.get(`/pipeline/applications/${appId}/history`),
        api.get(`/interviews/applications/${appId}`),
      ]);
      setPipelineHistory(Array.isArray(history) ? history : []);
      setInterviews(Array.isArray(ivs) ? ivs : []);
    } catch (err) {
      setActivityError(getErrorMessage(err, "Could not load activity"));
    } finally {
      setActivityLoading(false);
    }
  };

  const currentStageIndex = selectedApp
    ? FORWARD_STAGES.indexOf(selectedApp.stage as any)
    : -1;

  const progressPct = currentStageIndex >= 0
    ? Math.round(((currentStageIndex + 1) / FORWARD_STAGES.length) * 100)
    : 0;

  // StageSelect saved through the RTK mutation (caches refresh there); mirror it locally.
  const handleStageMoved = (stage: string) => {
    if (!selectedApp) return;
    const id = selectedApp.id;
    setSelectedApp({ ...selectedApp, stage });
    setApplications(prev => prev.map(a => (a.id === id ? { ...a, stage } : a)));
    // Pick up the stored rejection reason, if any.
    fetchApplications(true, id);
    if (activeTab === 'activity') fetchActivity(id);
  };


  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime) {
      notify.warning("Please select date and time.");
      return;
    }
    if (!candidate.email) {
      notify.error("This candidate has no email address.");
      return;
    }
    setScheduleSending(true);
    try {
      const jobTitle = selectedApp?.job?.title || candidate.current_title || "the position";
      const scheduledAt = new Date(`${interviewDate}T${interviewTime}`);
      const formattedDate = scheduledAt.toLocaleString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const typeLabel = interviewType === "video" ? "Video Call" : interviewType === "phone" ? "Phone Interview" : "In-Person Interview";
      const linkLine = meetingLink ? `\n🔗 Join link: ${meetingLink}` : "";
      const interviewerLine = interviewerName ? `\nInterviewer: ${interviewerName}` : "";
      const body = `Hi ${candidate.first_name},\n\nThank you for your interest in the ${jobTitle} role.\n\nWe would like to schedule a ${typeLabel} with you on:\n\n📅 ${formattedDate}${interviewerLine}${linkLine}\n\nPlease confirm your availability by replying to this email. If this time does not work for you, kindly suggest an alternate slot.\n\nWe look forward to speaking with you!\n\nBest regards,\nRecruitment Team`;

      // Send invite email
      await api.post('/email/send-single', {
        to: candidate.email,
        subject: `Interview Invitation – ${jobTitle}`,
        body,
      });

      // Persist interview record — the email has already gone out, so report a save failure separately
      let saveError: string | null = null;
      if (selectedApp) {
        try {
          const dbType = interviewType === "in_person" ? "face_to_face" : interviewType;
          const created = await api.post('/interviews', {
            application_id: selectedApp.id,
            interview_type: dbType,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: parseInt(interviewDuration),
            interviewer_name: interviewerName || null,
            meeting_link: meetingLink || null,
          });
          setInterviews(prev => [created, ...prev]);
          dispatch(baseApi.util.invalidateTags(["Interviews", "Dashboard"]));
        } catch (err) {
          saveError = getErrorMessage(err, "unknown error");
        }
      }

      if (saveError) {
        notify.warning(`Invite email sent, but the interview could not be saved (${saveError}). Please add it manually.`);
      } else if (!selectedApp) {
        notify.success("Invite email sent. Not saved as an interview because the candidate is not in any pipeline.");
      } else {
        notify.success("Interview invite sent and saved.");
      }
      setShowScheduler(false);
      setInterviewDate("");
      setInterviewTime("");
      setInterviewerName("");
      setMeetingLink("");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to send interview invite. Nothing was saved."));
    } finally {
      setScheduleSending(false);
    }
  };

  const handleUpdateInterviewStatus = async (interviewId: string, status: string) => {
    setUpdatingInterview(interviewId);
    try {
      const updated = await api.patch(`/interviews/${interviewId}`, { status });
      setInterviews(prev => prev.map(iv => iv.id === interviewId ? { ...iv, ...updated } : iv));
      dispatch(baseApi.util.invalidateTags(["Interviews", "Dashboard"]));
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not update interview status"));
    } finally {
      setUpdatingInterview(null);
    }
  };

  // Fetch resume blob with auth
  React.useEffect(() => {
    if (!localCandidate.resume_url) { setResumeBlobUrl(null); return; }
    let revoked = false;
    const load = async () => {
      setResumeLoading(true);
      try {
        const token = localStorage.getItem('jwt');
        // Always go through the authenticated resume endpoint: it serves files
        // from local disk or the private R2 bucket, whichever resume_url points to.
        const r = await fetch(`${RESUME_API}/candidates/${localCandidate.id}/resume`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        if (!revoked) setResumeBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!revoked) setResumeBlobUrl(null);
      } finally {
        if (!revoked) setResumeLoading(false);
      }
    };
    load();
    return () => { revoked = true; };
  }, [localCandidate.id, localCandidate.resume_url]);

  React.useEffect(() => {
    return () => { if (resumeBlobUrl) URL.revokeObjectURL(resumeBlobUrl); };
  }, [resumeBlobUrl]);

  const handleDownload = () => {
    if (!resumeBlobUrl) return;
    const a = document.createElement('a');
    a.href = resumeBlobUrl;
    a.download = `Resume_${localCandidate.last_name}.pdf`;
    a.click();
  };

  const handleFullScreen = () => {
    // The resume is only reachable with the auth header, so open the loaded blob.
    if (resumeBlobUrl) window.open(resumeBlobUrl, '_blank');
  };

  const handleUploadResume = async (file: File) => {
    setResumeUploading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const updated = await api.patch(`/candidates/${localCandidate.id}`, form);
      setLocalCandidate(updated);
      onUpdate?.(updated);
      dispatch(baseApi.util.invalidateTags(["Candidates", { type: "Candidate", id: localCandidate.id }]));
      notify.success('Resume uploaded');
    } catch (err) {
      notify.error(getErrorMessage(err, 'Failed to upload resume'));
    } finally {
      setResumeUploading(false);
    }
  };

  const sectionTitle = "text-sm font-semibold text-ink";
  const subtle = "text-xs font-medium text-muted";

  return (
    <>
    <Modal
      open
      onClose={onClose}
      size="xl"
      hideHeader
      closeOnBackdrop
      // A dialog on top (compose, stage reason, add to job) handles Esc while it is open.
      preventClose={showCompose || stagePrompting || showAddToJob}
      bodyClassName="!p-0 bg-surface"
    >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={`${candidate.first_name} ${candidate.last_name}`} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-ink sm:text-xl">{candidate.first_name} {candidate.last_name}</h2>
                {candidate.source && <Badge tone="navy" className="capitalize">{candidate.source}</Badge>}
              </div>
              {(candidate.current_title || candidate.current_company) && (
                <p className="mt-0.5 truncate text-sm text-muted">
                  {candidate.current_title}
                  {candidate.current_title && candidate.current_company && " at "}
                  {candidate.current_company && <span className="text-ink-soft">{candidate.current_company}</span>}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 border-b border-line bg-white px-5 sm:px-6">
          <div role="tablist" className="flex gap-6 overflow-x-auto">
            {(['overview', 'resume', 'activity', 'ai', 'whatsapp'] as const).map((tab) => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  tab === 'ai' || tab === 'whatsapp' ? '' : 'capitalize'
                } ${
                  activeTab === tab ? 'border-navy-600 text-navy-700' : 'border-transparent text-muted hover:text-ink'
                }`}>
                {tab === 'ai' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles size={14} aria-hidden="true" />
                    AI insights
                  </span>
                ) : tab === 'whatsapp' ? 'WhatsApp' : tab}
                {tab === 'activity' && interviews.length > 0 && (
                  <span className="ml-2 rounded-full bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-700">
                    {interviews.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">

          {/* ── Overview Tab ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {/* Left Column */}
              <div className="space-y-5 md:col-span-2">
                <div className="zh-card space-y-4 p-5">
                  <h3 className={sectionTitle}>Contact information</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { icon: <Mail size={16} />, label: 'Email', value: candidate.email || 'Not provided', truncate: true },
                      { icon: <Phone size={16} />, label: 'Phone', value: candidate.phone || 'Not provided' },
                      { icon: <MapPin size={16} />, label: 'Location', value: candidate.current_location || 'Not provided' },
                      {
                        icon: <Clock size={16} />,
                        label: 'Notice period',
                        value: candidate.notice_period_days != null ? `${candidate.notice_period_days} days` : 'Not provided',
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 rounded-lg bg-surface p-3">
                        <span className="text-navy-600">{row.icon}</span>
                        <div className="min-w-0">
                          <p className={subtle}>{row.label}</p>
                          <p className={`text-sm font-medium text-ink ${row.truncate ? 'truncate' : ''}`}>{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="zh-card space-y-4 p-5">
                  <h3 className={sectionTitle}>Professional summary</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{candidate.summary || 'No summary provided.'}</p>
                  <div className="pt-2">
                    <h4 className={`${subtle} mb-2`}>Core skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(candidate.skills ?? []).length === 0 && <span className="text-sm text-muted">No skills listed.</span>}
                      {(candidate.skills ?? []).map(skill => (
                        <Badge key={skill} tone="navy">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column — Application Status */}
              <div className="space-y-5">
                <div className="zh-card space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={sectionTitle}>Application status</h3>
                    {applications.length > 1 && (
                      <select
                        aria-label="Application"
                        value={selectedApp?.id || ""}
                        onChange={(e) => setSelectedApp(applications.find(a => a.id === e.target.value))}
                        className="zh-input w-auto max-w-[10rem] px-2 py-1 text-xs"
                      >
                        {applications.map(a => (
                          <option key={a.id} value={a.id}>{a.job?.title || "Job"}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {appLoading ? (
                    <div className="space-y-2" aria-label="Loading">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : appError ? (
                    <div className="space-y-2 rounded-lg bg-danger-50 p-4 text-center" role="alert">
                      <p className="text-xs font-medium text-danger-700">{appError}</p>
                      <Button variant="link" size="sm" onClick={() => fetchApplications()}>Try again</Button>
                    </div>
                  ) : selectedApp ? (
                    <>
                      <div className="rounded-lg border border-line bg-surface p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted">Current stage</span>
                          <StageBadge stage={selectedApp.stage} />
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-navy-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        {selectedApp.job?.title && (
                          <p className="mt-2 truncate text-xs text-muted">
                            Job:{' '}
                            <RouterLink
                              to={`/jobs/${selectedApp.job_id}`}
                              onClick={onClose}
                              className="font-medium text-navy-600 hover:text-navy-800 hover:underline"
                            >
                              {selectedApp.job.title}
                            </RouterLink>
                          </p>
                        )}
                        {selectedApp.rejection_reason && ['disqualified', 'offer_rejected'].includes(selectedApp.stage) && (
                          <p className="mt-1 text-xs text-muted">
                            Reason: <span className="text-ink-soft">{selectedApp.rejection_reason}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <span className="mb-1 block text-xs font-medium text-muted">Move to stage</span>
                        <StageSelect
                          key={selectedApp.id}
                          value={selectedApp.stage}
                          applicationId={selectedApp.id}
                          candidateName={`${candidate.first_name} ${candidate.last_name}`}
                          onMoved={handleStageMoved}
                          onPromptingChange={setStagePrompting}
                          label="Move to stage"
                          className="w-full"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <RouterLink
                          to={`/pipeline/${selectedApp.job_id}`}
                          onClick={onClose}
                          className={buttonClasses('link', 'sm', 'text-xs')}
                        >
                          <TrendingUp size={13} className="mr-1" aria-hidden="true" />
                          Open pipeline
                        </RouterLink>
                        <Button variant="link" size="sm" className="text-xs" icon={<Plus size={13} />} onClick={() => setShowAddToJob(true)}>
                          Add to another job
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3 rounded-lg bg-surface p-4 text-center">
                      <p className="text-xs text-muted">Not in any pipeline yet</p>
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddToJob(true)}>
                        Add to job
                      </Button>
                    </div>
                  )}

                  <Button fullWidth variant="secondary" onClick={() => setShowCompose(true)} icon={<Mail size={16} />}>
                    Send email
                  </Button>

                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={() => setShowScheduler(!showScheduler)}
                    aria-expanded={showScheduler}
                    icon={<Calendar size={16} />}
                  >
                    Schedule interview
                  </Button>

                  {showScheduler && (
                    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
                      <p className={subtle}>Interview details</p>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="cm-iv-date" className="sr-only">Date</label>
                            <input
                              id="cm-iv-date"
                              type="date"
                              value={interviewDate}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={(e) => setInterviewDate(e.target.value)}
                              className="zh-input px-3 py-2"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-iv-time" className="sr-only">Time</label>
                            <input
                              id="cm-iv-time"
                              type="time"
                              value={interviewTime}
                              onChange={(e) => setInterviewTime(e.target.value)}
                              className="zh-input px-3 py-2"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            aria-label="Interview type"
                            value={interviewType}
                            onChange={(e) => setInterviewType(e.target.value)}
                            className="zh-input px-3 py-2"
                          >
                            <option value="video">Video Call</option>
                            <option value="phone">Phone</option>
                            <option value="in_person">In-Person</option>
                          </select>
                          <select
                            aria-label="Duration"
                            value={interviewDuration}
                            onChange={(e) => setInterviewDuration(e.target.value)}
                            className="zh-input px-3 py-2"
                          >
                            <option value="30">30 min</option>
                            <option value="45">45 min</option>
                            <option value="60">60 min</option>
                            <option value="90">90 min</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          aria-label="Interviewer name"
                          value={interviewerName}
                          onChange={(e) => setInterviewerName(e.target.value)}
                          placeholder="Interviewer name (optional)"
                          className="zh-input px-3 py-2"
                        />
                        <input
                          type="url"
                          aria-label="Meeting link"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                          placeholder="Meeting link (optional)"
                          className="zh-input px-3 py-2"
                        />
                      </div>
                      <Button
                        fullWidth
                        onClick={handleScheduleInterview}
                        loading={scheduleSending}
                        loadingText="Sending…"
                        icon={<Send size={14} />}
                      >
                        Send invite &amp; save
                      </Button>
                    </div>
                  )}

                </div>

                <div className="zh-card space-y-3 p-5">
                  <h3 className={sectionTitle}>Financials</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Current CTC</span>
                      <span className="text-sm font-semibold text-ink">{formatINR(candidate.current_ctc, 'N/A')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Expected CTC</span>
                      <span className="text-sm font-semibold text-ink">{formatINR(candidate.expected_ctc, 'N/A')}</span>
                    </div>
                  </div>
                </div>

                {onDelete && (
                  <Button
                    fullWidth
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(candidate.id)}
                    icon={<Trash2 size={14} />}
                    className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                  >
                    Delete candidate
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Resume Tab ── */}
          {activeTab === 'resume' && (
            <div className="flex h-full flex-col space-y-4">
              {localCandidate.resume_url ? (
                <>
                  <div className="zh-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">Resume_{localCandidate.last_name}.pdf</p>
                        <p className="text-xs text-muted">Uploaded resume</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownload}
                        disabled={!resumeBlobUrl || resumeLoading}
                        icon={<Download size={14} />}
                      >
                        Download
                      </Button>
                      <Button size="sm" onClick={handleFullScreen} disabled={resumeLoading} icon={<Eye size={14} />}>
                        Full screen
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-sunken" style={{ minHeight: '420px' }}>
                    {resumeLoading ? (
                      <Loader2 size={28} className="animate-spin text-navy-400" aria-label="Loading resume" />
                    ) : resumeBlobUrl ? (
                      <iframe src={resumeBlobUrl} className="h-full w-full" style={{ minHeight: '420px' }} title="Resume Preview" />
                    ) : (
                      <div className="space-y-2 text-center">
                        <FileText size={36} className="mx-auto text-line-strong" />
                        <p className="text-sm text-muted">Preview unavailable</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-line-strong bg-white px-8 py-16">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-600">
                    <Upload size={22} />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-ink">No resume uploaded</p>
                    <p className="mt-1 text-sm text-muted">Upload a PDF, DOCX, or DOC file (max 8 MB)</p>
                  </div>
                  <label className={buttonClasses('primary', 'md', `cursor-pointer ${resumeUploading ? 'pointer-events-none opacity-60' : ''}`)}>
                    {resumeUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {resumeUploading ? 'Uploading…' : 'Choose file'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="sr-only"
                      disabled={resumeUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadResume(file);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── Activity Tab ── */}
          {activeTab === 'activity' && (
            <div className="space-y-5">
              {/* Application selector when multiple */}
              {applications.length > 1 && (
                <div className="zh-card flex items-center gap-3 p-4">
                  <label htmlFor="cm-activity-app" className={`${subtle} shrink-0`}>Viewing</label>
                  <select
                    id="cm-activity-app"
                    value={selectedApp?.id || ""}
                    onChange={(e) => {
                      const app = applications.find(a => a.id === e.target.value);
                      setSelectedApp(app);
                    }}
                    className="zh-input flex-1 py-2"
                  >
                    {applications.map(a => (
                      <option key={a.id} value={a.id}>{a.job?.title || "Job"}</option>
                    ))}
                  </select>
                </div>
              )}

              {activityLoading ? (
                <div className="space-y-3" aria-label="Loading">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : activityError ? (
                <div className="zh-card">
                  <ErrorState
                    compact
                    message={activityError}
                    onRetry={selectedApp ? () => fetchActivity(selectedApp.id) : undefined}
                  />
                </div>
              ) : !selectedApp ? (
                <div className="zh-card">
                  <EmptyState compact title="Not in any pipeline yet" description="Add this candidate to a job to track stages and interviews." />
                </div>
              ) : (
                <>
                  {/* Interviews section */}
                  <div className="zh-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                      <h3 className={`${sectionTitle} flex items-center gap-2`}>
                        <Calendar size={14} className="text-navy-600" /> Interviews
                      </h3>
                      <span className="text-xs text-muted">{interviews.length} total</span>
                    </div>

                    {interviews.length === 0 ? (
                      <EmptyState
                        compact
                        icon={<Video size={20} />}
                        title="No interviews scheduled yet"
                        action={
                          <Button size="sm" variant="secondary" onClick={() => { setActiveTab('overview'); setShowScheduler(true); }}>
                            Schedule interview
                          </Button>
                        }
                      />
                    ) : (
                      <div className="divide-y divide-line">
                        {interviews.map(iv => (
                          <div key={iv.id} className="px-5 py-4 transition-colors hover:bg-surface">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                                  {iv.interview_type === 'video' ? <Video size={14} /> :
                                   iv.interview_type === 'phone' ? <PhoneCall size={14} /> :
                                   <Users size={14} />}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-ink">
                                      {INTERVIEW_TYPE_LABELS[iv.interview_type] || iv.interview_type}
                                    </p>
                                    <Badge tone={INTERVIEW_STATUS_TONES[iv.status] ?? 'neutral'} icon={INTERVIEW_STATUS_ICONS[iv.status]} className="capitalize">
                                      {String(iv.status ?? '').replace(/_/g, ' ')}
                                    </Badge>
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {new Date(iv.scheduled_at).toLocaleString('en-IN', {
                                      weekday: 'short', day: 'numeric', month: 'short',
                                      hour: '2-digit', minute: '2-digit',
                                    })}
                                    {iv.duration_minutes ? ` · ${iv.duration_minutes} min` : ''}
                                  </p>
                                  {iv.interviewer_name && (
                                    <p className="mt-0.5 text-xs text-muted">
                                      Interviewer: {iv.interviewer_name}
                                    </p>
                                  )}
                                  {iv.meeting_link && (
                                    <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer"
                                      className="mt-0.5 flex items-center gap-1 text-xs text-navy-600 hover:underline">
                                      <Link size={10} /> Join meeting
                                    </a>
                                  )}
                                </div>
                              </div>
                              {/* Status quick-update */}
                              {iv.status === 'scheduled' && (
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    onClick={() => handleUpdateInterviewStatus(iv.id, 'completed')}
                                    disabled={updatingInterview === iv.id}
                                    title="Mark completed"
                                    aria-label="Mark completed"
                                    className="rounded-lg p-1.5 text-success-700 hover:bg-success-50 disabled:opacity-50"
                                  >
                                    {updatingInterview === iv.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                  </button>
                                  <button
                                    onClick={() => handleUpdateInterviewStatus(iv.id, 'cancelled')}
                                    disabled={updatingInterview === iv.id}
                                    title="Cancel"
                                    aria-label="Cancel interview"
                                    className="rounded-lg p-1.5 text-muted hover:bg-surface-sunken disabled:opacity-50"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateInterviewStatus(iv.id, 'no_show')}
                                    disabled={updatingInterview === iv.id}
                                    title="No show"
                                    aria-label="Mark no show"
                                    className="rounded-lg p-1.5 text-warning-700 hover:bg-warning-50 disabled:opacity-50"
                                  >
                                    <AlertCircle size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pipeline history timeline */}
                  <div className="zh-card overflow-hidden">
                    <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                      <h3 className={`${sectionTitle} flex items-center gap-2`}>
                        <Clock size={14} className="text-navy-600" /> Pipeline timeline
                      </h3>
                      <span className="text-xs text-muted">{pipelineHistory.length} events</span>
                    </div>
                    <div className="p-5">
                      {pipelineHistory.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted">No stage changes recorded yet</p>
                      ) : (
                        <ol className="space-y-4">
                          {pipelineHistory.map((event) => (
                            <li key={event.id} className="relative pl-8 before:absolute before:bottom-[-16px] before:left-[11px] before:top-5 before:w-0.5 before:bg-line last:before:hidden">
                              <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-navy-100 bg-white">
                                <div className={`h-2 w-2 rounded-full ${getStage(event.to_stage).dot}`} />
                              </div>
                              <div>
                                <p className="text-xs text-muted">
                                  {new Date(event.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                  })}
                                  {event.changed_by_email ? ` · ${event.changed_by_email}` : ''}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
                                  {event.from_stage ? (
                                    <>
                                      <StageBadge stage={event.from_stage} />
                                      <span className="text-muted" aria-label="to">→</span>
                                      <StageBadge stage={event.to_stage} />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-muted">Added to pipeline:</span>
                                      <StageBadge stage={event.to_stage} />
                                    </>
                                  )}
                                </div>
                                {event.note && (
                                  <p className="mt-1 text-xs italic text-muted">"{event.note}"</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── WhatsApp Tab ── */}
          {activeTab === 'whatsapp' && (
            <WhatsAppTab candidateId={candidate.id} firstName={candidate.first_name} jobTitle={selectedApp?.job?.title ?? null} />
          )}

          {/* ── AI insights Tab ── */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              {applications.length > 1 && (
                <div className="zh-card flex items-center gap-3 p-4">
                  <label htmlFor="cm-ai-app" className={`${subtle} shrink-0`}>Viewing</label>
                  <select
                    id="cm-ai-app"
                    value={selectedApp?.id || ""}
                    onChange={(e) => setSelectedApp(applications.find(a => a.id === e.target.value))}
                    className="zh-input flex-1 py-2"
                  >
                    {applications.map(a => (
                      <option key={a.id} value={a.id}>{a.job?.title || "Job"}</option>
                    ))}
                  </select>
                </div>
              )}
              {appLoading ? (
                <div className="space-y-3" aria-label="Loading">
                  <Skeleton className="h-28 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : appError ? (
                <div className="zh-card">
                  <ErrorState compact message={appError} onRetry={() => fetchApplications()} />
                </div>
              ) : (
                <AiInsightsTab
                  key={selectedApp?.id ?? 'none'}
                  applicationId={selectedApp?.id ?? null}
                  candidateName={`${candidate.first_name} ${candidate.last_name}`}
                  onNavigate={onClose}
                />
              )}
            </div>
          )}
        </div>
    </Modal>

    {showAddToJob && (
      <AddToPipelineModal
        candidates={[localCandidate]}
        excludeJobIds={applications.map((a) => a.job_id)}
        onAdded={(outcome) => {
          if (outcome.added > 0) fetchApplications(true, selectedApp?.id);
        }}
        onClose={() => setShowAddToJob(false)}
      />
    )}

    {showCompose && (
      <ComposeEmailModal
        to={localCandidate.email}
        toName={`${localCandidate.first_name} ${localCandidate.last_name}`}
        positionHint={selectedApp?.job?.title || localCandidate.current_title || "the position"}
        onClose={() => setShowCompose(false)}
      />
    )}
    </>
  );
};

export default CandidateModal;
