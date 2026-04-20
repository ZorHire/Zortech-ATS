import React from 'react';
import { X, Mail, Phone, MapPin, Clock, Calendar, Download, Eye, FileText, Send, Trash2, ChevronRight, Loader2, Upload } from 'lucide-react';
import { Candidate } from '../../types';
import api from '../../lib/api';

const RESUME_API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

interface CandidateModalProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdate: (candidate: Candidate) => void;
  onDelete: (id: string) => void;
}

const FORWARD_STAGES = [
  "new", "sourced", "screened", "shortlisted", "submitted_to_client",
  "client_interview_scheduled", "interview_completed", "selected",
  "offer_extended", "offer_accepted", "joined",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  sourced: "Sourced",
  screened: "Screening",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to Client",
  client_interview_scheduled: "Interview Scheduled",
  interview_completed: "Interview Completed",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  joined: "Joined",
  disqualified: "Disqualified",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  sourced: "bg-blue-50 text-blue-700",
  screened: "bg-amber-100 text-amber-700",
  shortlisted: "bg-violet-100 text-violet-700",
  submitted_to_client: "bg-indigo-100 text-indigo-700",
  client_interview_scheduled: "bg-cyan-100 text-cyan-700",
  interview_completed: "bg-teal-100 text-teal-700",
  selected: "bg-emerald-100 text-emerald-700",
  offer_extended: "bg-orange-100 text-orange-700",
  offer_accepted: "bg-green-100 text-green-700",
  joined: "bg-green-200 text-green-800",
  disqualified: "bg-red-100 text-red-600",
};

const CandidateModal: React.FC<CandidateModalProps> = ({ candidate, onClose, onDelete, onUpdate }) => {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'resume' | 'activity'>('overview');
  const [localCandidate, setLocalCandidate] = React.useState<Candidate>(candidate);
  const [resumeUploading, setResumeUploading] = React.useState(false);
  const [resumeBlobUrl, setResumeBlobUrl] = React.useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = React.useState(false);

  // Application state
  const [applications, setApplications] = React.useState<any[]>([]);
  const [appLoading, setAppLoading] = React.useState(true);
  const [selectedApp, setSelectedApp] = React.useState<any>(null);
  const [stageSaving, setStageSaving] = React.useState(false);

  // Email states
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailMsg, setEmailMsg] = React.useState("");

  // Schedule interview state
  const [showScheduler, setShowScheduler] = React.useState(false);
  const [interviewDate, setInterviewDate] = React.useState("");
  const [interviewTime, setInterviewTime] = React.useState("");
  const [interviewType, setInterviewType] = React.useState("video");
  const [scheduleSending, setScheduleSending] = React.useState(false);

  React.useEffect(() => {
    fetchApplications();
  }, [candidate.id]);

  const fetchApplications = async () => {
    setAppLoading(true);
    try {
      const data = await api.get(`/pipeline/candidates/${candidate.id}/applications`);
      setApplications(data);
      if (data.length > 0) setSelectedApp(data[0]);
    } catch {
      // candidate may not be in any pipeline yet
    } finally {
      setAppLoading(false);
    }
  };

  const currentStageIndex = selectedApp
    ? FORWARD_STAGES.indexOf(selectedApp.stage as any)
    : -1;

  const nextStage = currentStageIndex >= 0 && currentStageIndex < FORWARD_STAGES.length - 1
    ? FORWARD_STAGES[currentStageIndex + 1]
    : null;

  const progressPct = currentStageIndex >= 0
    ? Math.round(((currentStageIndex + 1) / FORWARD_STAGES.length) * 100)
    : 0;

  const handleMoveToNextStage = async () => {
    if (!selectedApp || !nextStage) return;
    setStageSaving(true);
    try {
      const updated = await api.patch(`/pipeline/applications/${selectedApp.id}/stage`, { to_stage: nextStage });
      setSelectedApp({ ...selectedApp, stage: updated.stage });
      setApplications(prev => prev.map(a => a.id === updated.id ? { ...a, stage: updated.stage } : a));
      setEmailMsg(`Moved to ${STAGE_LABELS[updated.stage]}`);
      setTimeout(() => setEmailMsg(""), 3000);
    } catch (err: any) {
      setEmailMsg(err?.message || "Failed to move stage");
      setTimeout(() => setEmailMsg(""), 4000);
    } finally {
      setStageSaving(false);
    }
  };

  const handleSendShortlistEmail = async () => {
    setEmailSending(true);
    setEmailMsg("");
    try {
      const jobTitle = selectedApp?.job?.title || candidate.current_title || "the position";
      const body = `Hi ${candidate.first_name},\n\nI hope you are doing well.\n\nAfter reviewing your profile, we are pleased to inform you that you have been shortlisted for the ${jobTitle} role. Your experience and skills are a great match for what we are looking for.\n\nWe would love to connect with you to discuss the opportunity in detail. Please reply to this email or let us know a convenient time for a call.\n\nLooking forward to hearing from you!\n\nBest regards,\nRecruitment Team`;
      await api.post('/email/send-single', {
        to: candidate.email,
        subject: `Shortlisted for ${jobTitle}`,
        body,
      });
      setEmailMsg("Shortlisting email sent!");
    } catch (err: any) {
      setEmailMsg(err?.message || "Failed to send email");
    } finally {
      setEmailSending(false);
      setTimeout(() => setEmailMsg(""), 4000);
    }
  };

  const handleScheduleInterview = async () => {
    if (!interviewDate || !interviewTime) {
      setEmailMsg("Please select date and time.");
      setTimeout(() => setEmailMsg(""), 3000);
      return;
    }
    setScheduleSending(true);
    setEmailMsg("");
    try {
      const jobTitle = selectedApp?.job?.title || candidate.current_title || "the position";
      const formattedDate = new Date(`${interviewDate}T${interviewTime}`).toLocaleString("en-IN", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const typeLabel = interviewType === "video" ? "Video Call" : interviewType === "phone" ? "Phone Interview" : "In-Person Interview";
      const body = `Hi ${candidate.first_name},\n\nThank you for your interest in the ${jobTitle} role.\n\nWe would like to schedule a ${typeLabel} with you on:\n\n📅 ${formattedDate}\n\nPlease confirm your availability by replying to this email. If this time does not work for you, kindly suggest an alternate slot.\n\nWe look forward to speaking with you!\n\nBest regards,\nRecruitment Team`;
      await api.post('/email/send-single', {
        to: candidate.email,
        subject: `Interview Invitation – ${jobTitle}`,
        body,
      });
      setEmailMsg("Interview invite sent!");
      setShowScheduler(false);
      setInterviewDate("");
      setInterviewTime("");
    } catch (err: any) {
      setEmailMsg(err?.message || "Failed to send interview invite");
    } finally {
      setScheduleSending(false);
      setTimeout(() => setEmailMsg(""), 4000);
    }
  };

  // Fetch resume blob whenever resume_url is set, so iframe, download, and full-screen all work with auth
  React.useEffect(() => {
    if (!localCandidate.resume_url) { setResumeBlobUrl(null); return; }
    let revoked = false;
    const load = async () => {
      setResumeLoading(true);
      try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${RESUME_API}${localCandidate.resume_url}`, {
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
  }, [localCandidate.resume_url]);

  // Revoke blob URL on unmount to free memory
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
    if (!resumeBlobUrl) window.open(`${RESUME_API}${localCandidate.resume_url}`, '_blank');
    else window.open(resumeBlobUrl, '_blank');
  };

  const handleUploadResume = async (file: File) => {
    setResumeUploading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const updated = await api.patch(`/candidates/${localCandidate.id}`, form);
      setLocalCandidate(updated);
      onUpdate(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to upload resume');
    } finally {
      setResumeUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-white to-blue-50/30">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">
              {candidate.first_name.charAt(0)}{candidate.last_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{candidate.first_name} {candidate.last_name}</h2>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100 uppercase tracking-wider">
                  {candidate.source}
                </span>
              </div>
              <p className="text-gray-500 font-medium mt-1">
                {candidate.current_title} at <span className="text-gray-900">{candidate.current_company}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onDelete(candidate.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
              <Trash2 size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-100 bg-white">
          <div className="flex gap-8">
            {(['overview', 'resume', 'activity'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-semibold border-b-2 transition-all capitalize ${
                  activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Mail size={18} className="text-blue-500" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Email</p>
                        <p className="text-sm text-gray-700 font-medium truncate">{candidate.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Phone size={18} className="text-emerald-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Phone</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.phone || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <MapPin size={18} className="text-red-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Location</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.current_location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <Clock size={18} className="text-amber-500" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Notice Period</p>
                        <p className="text-sm text-gray-700 font-medium">{candidate.notice_period_days} Days</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Professional Summary</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{candidate.summary || 'No summary provided.'}</p>
                  <div className="pt-4">
                    <h4 className="text-[10px] text-gray-400 font-bold uppercase mb-3">Core Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map(skill => (
                        <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">{skill}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column — Application Status */}
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Application Status</h3>
                    {applications.length > 1 && (
                      <select
                        value={selectedApp?.id || ""}
                        onChange={(e) => setSelectedApp(applications.find(a => a.id === e.target.value))}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {applications.map(a => (
                          <option key={a.id} value={a.id}>{a.job?.title || "Job"}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {appLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={18} className="animate-spin text-blue-500" />
                    </div>
                  ) : selectedApp ? (
                    <>
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-gray-500 font-medium">Current Stage</span>
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase ${STAGE_COLORS[selectedApp.stage] || "bg-gray-100 text-gray-600"}`}>
                            {STAGE_LABELS[selectedApp.stage] || selectedApp.stage}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        {selectedApp.job?.title && (
                          <p className="text-[10px] text-gray-400 mt-2 truncate">Job: {selectedApp.job.title}</p>
                        )}
                      </div>

                      <button
                        onClick={handleMoveToNextStage}
                        disabled={stageSaving || !nextStage}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {stageSaving ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
                        {nextStage ? `Move to ${STAGE_LABELS[nextStage]}` : "Final Stage"}
                      </button>
                    </>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-2xl text-center">
                      <p className="text-xs text-gray-400 font-medium">Not in any pipeline yet</p>
                    </div>
                  )}

                  <button
                    onClick={handleSendShortlistEmail}
                    disabled={emailSending}
                    className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {emailSending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    Send individual Email
                  </button>

                  <button
                    onClick={() => { setShowScheduler(!showScheduler); setEmailMsg(""); }}
                    className="w-full py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar size={16} />
                    Schedule Interview
                  </button>

                  {showScheduler && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Interview Details</p>
                      <div className="space-y-2">
                        <input
                          type="date"
                          value={interviewDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setInterviewDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <input
                          type="time"
                          value={interviewTime}
                          onChange={(e) => setInterviewTime(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <select
                          value={interviewType}
                          onChange={(e) => setInterviewType(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="video">Video Call</option>
                          <option value="phone">Phone Interview</option>
                          <option value="in_person">In-Person</option>
                        </select>
                      </div>
                      <button
                        onClick={handleScheduleInterview}
                        disabled={scheduleSending}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {scheduleSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send Invite
                      </button>
                    </div>
                  )}

                  {emailMsg && (
                    <p className={`text-xs font-medium text-center px-3 py-2 rounded-xl ${
                      emailMsg.includes("sent") || emailMsg.includes("Moved")
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                    }`}>
                      {emailMsg}
                    </p>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Financials</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Current CTC</span>
                      <span className="text-sm font-bold text-gray-900">₹{candidate.current_ctc ? (candidate.current_ctc / 100000).toFixed(1) + 'L' : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Expected CTC</span>
                      <span className="text-sm font-bold text-gray-900">₹{candidate.expected_ctc ? (candidate.expected_ctc / 100000).toFixed(1) + 'L' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="h-full flex flex-col space-y-4">
              {localCandidate.resume_url ? (
                <>
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Resume_{localCandidate.last_name}.pdf</p>
                        <p className="text-[10px] text-gray-400 font-medium">Uploaded resume</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownload}
                        disabled={!resumeBlobUrl || resumeLoading}
                        className="px-4 py-2 bg-gray-50 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={handleFullScreen}
                        disabled={resumeLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Eye size={14} /> Full Screen
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center" style={{ minHeight: '420px' }}>
                    {resumeLoading ? (
                      <Loader2 size={28} className="animate-spin text-blue-400" />
                    ) : resumeBlobUrl ? (
                      <iframe
                        src={resumeBlobUrl}
                        className="w-full h-full"
                        style={{ minHeight: '420px' }}
                        title="Resume Preview"
                      />
                    ) : (
                      <div className="text-center space-y-2">
                        <FileText size={36} className="mx-auto text-gray-300" />
                        <p className="text-sm text-gray-400">Preview unavailable</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 px-8">
                  <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-2xl flex items-center justify-center">
                    <Upload size={28} />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-gray-700">No resume uploaded</p>
                    <p className="text-sm text-gray-400 mt-1">Upload a PDF, DOCX, or DOC file (max 8 MB)</p>
                  </div>
                  <label className={`cursor-pointer px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 ${resumeUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                    {resumeUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {resumeUploading ? 'Uploading…' : 'Choose File'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
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

          {activeTab === 'activity' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Timeline</h3>
              </div>
              <div className="p-5 space-y-6">
                {applications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No pipeline activity yet</p>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="relative pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-[-24px] before:w-[2px] before:bg-gray-100 last:before:hidden">
                      <div className="absolute left-0 top-1.5 w-[24px] h-[24px] bg-white border-4 border-gray-50 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">{new Date(app.updated_at).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-800">
                          Application for <span className="font-bold text-blue-600">{app.job?.title || "a job"}</span>
                          {" "}— Stage: <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${STAGE_COLORS[app.stage] || "text-gray-600"}`}>{STAGE_LABELS[app.stage] || app.stage}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;
