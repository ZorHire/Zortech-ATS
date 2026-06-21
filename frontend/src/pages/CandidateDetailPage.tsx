import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  DollarSign,
  Calendar,
  Video,
  PhoneCall,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import Header from "../components/layout/Header";
import {
  useGetCandidateByIdQuery,
  useGetCandidateTimelineQuery,
} from "../store/api/candidateApi";
import type { ApplicationEntry, InterviewEntry } from "../store/api/candidateApi";

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  sourced: "Sourced",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to Client",
  client_interview_scheduled: "Client Interview Scheduled",
  interview_completed: "Interview Completed",
  selected: "Selected",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  offer_rejected: "Offer Rejected",
  joined: "Joined",
  disqualified: "Disqualified",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  sourced: "bg-blue-100 text-blue-700",
  screened: "bg-indigo-100 text-indigo-700",
  shortlisted: "bg-violet-100 text-violet-700",
  submitted_to_client: "bg-purple-100 text-purple-700",
  client_interview_scheduled: "bg-orange-100 text-orange-700",
  interview_completed: "bg-amber-100 text-amber-700",
  selected: "bg-emerald-100 text-emerald-700",
  offer_extended: "bg-teal-100 text-teal-700",
  offer_accepted: "bg-green-100 text-green-700",
  offer_rejected: "bg-red-100 text-red-700",
  joined: "bg-green-200 text-green-800",
  disqualified: "bg-red-100 text-red-600",
};

const INTERVIEW_TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video size={12} />,
  phone: <PhoneCall size={12} />,
  face_to_face: <Users size={12} />,
};

const INTERVIEW_STATUS_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  scheduled: { color: "text-blue-600", icon: <Clock size={11} /> },
  completed: { color: "text-emerald-600", icon: <CheckCircle2 size={11} /> },
  cancelled: { color: "text-gray-400", icon: <XCircle size={11} /> },
  no_show: { color: "text-red-500", icon: <AlertCircle size={11} /> },
};

function InterviewRow({ interview }: { interview: InterviewEntry }) {
  const typeIcon = INTERVIEW_TYPE_ICONS[interview.type] ?? <Users size={12} />;
  const statusStyle = INTERVIEW_STATUS_STYLES[interview.status] ?? INTERVIEW_STATUS_STYLES.scheduled;
  return (
    <div className="flex items-center gap-3 py-2 text-xs text-gray-600">
      <span className="text-gray-400">{typeIcon}</span>
      <span className="capitalize">{interview.type.replace(/_/g, " ")}</span>
      <span className="text-gray-300">·</span>
      <span>
        {new Date(interview.scheduled_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
        {" "}
        {new Date(interview.scheduled_at).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      {interview.interviewer_name && (
        <>
          <span className="text-gray-300">·</span>
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

function ApplicationCard({ entry }: { entry: ApplicationEntry }) {
  const stageColor = STAGE_COLORS[entry.stage] ?? "bg-gray-100 text-gray-600";
  const stageLabel = STAGE_LABELS[entry.stage] ?? entry.stage;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{entry.job_title}</p>
          {entry.job_location && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} />
              {entry.job_location}
            </p>
          )}
        </div>
        <span className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${stageColor}`}>
          {stageLabel}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-gray-400 mb-3">
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          Applied {new Date(entry.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        {entry.ai_score != null && (
          <span className="flex items-center gap-1 text-violet-500 font-medium">
            AI Match: {Math.round(entry.ai_score)}%
          </span>
        )}
      </div>

      {entry.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-3 italic">
          {entry.notes}
        </p>
      )}

      {entry.interviews.length > 0 && (
        <div className="border-t border-gray-50 pt-3 mt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Interviews ({entry.interviews.length})
          </p>
          {entry.interviews.map((iv) => (
            <InterviewRow key={iv.id} interview={iv} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: candidate, isLoading: candidateLoading } = useGetCandidateByIdQuery(id!);
  const { data: timeline = [], isLoading: timelineLoading } = useGetCandidateTimelineQuery(id!);

  const isLoading = candidateLoading || timelineLoading;

  const avatarInitials = candidate
    ? `${candidate.first_name.charAt(0)}${candidate.last_name.charAt(0)}`
    : "?";

  const AVATAR_COLORS = [
    "from-blue-400 to-blue-600",
    "from-violet-400 to-violet-600",
    "from-emerald-400 to-emerald-600",
    "from-orange-400 to-orange-600",
    "from-pink-400 to-pink-600",
  ];
  const avatarColor = candidate
    ? AVATAR_COLORS[candidate.first_name.charCodeAt(0) % AVATAR_COLORS.length]
    : AVATAR_COLORS[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Candidate Profile" subtitle="Full profile and application history" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Candidates
          </button>

          {isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !candidate ? (
            <div className="text-center py-24 text-gray-400 text-sm">
              Candidate not found.
            </div>
          ) : (
            <>
              {/* Identity card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start gap-5">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-xl font-bold text-white">{avatarInitials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">
                      {candidate.first_name} {candidate.last_name}
                    </h2>
                    {candidate.current_title && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {candidate.current_title}
                        {candidate.current_company && ` @ ${candidate.current_company}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(candidate.skills ?? []).slice(0, 8).map((skill: string) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-medium rounded-full"
                        >
                          {skill}
                        </span>
                      ))}
                      {(candidate.skills ?? []).length > 8 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-medium rounded-full">
                          +{(candidate.skills ?? []).length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                  {candidate.resume_url && (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0"
                    >
                      <FileText size={12} />
                      Resume
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Contact */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact</h3>
                  {candidate.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{candidate.email}</span>
                    </div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Phone size={13} className="text-gray-400 flex-shrink-0" />
                      {candidate.phone}
                    </div>
                  )}
                  {candidate.current_location && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                      {candidate.current_location}
                    </div>
                  )}
                </div>

                {/* Career */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Career</h3>
                  {candidate.experience_years != null && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Briefcase size={13} className="text-gray-400 flex-shrink-0" />
                      {candidate.experience_years} yrs experience
                    </div>
                  )}
                  {candidate.notice_period_days != null && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock size={13} className="text-gray-400 flex-shrink-0" />
                      {candidate.notice_period_days} days notice
                    </div>
                  )}
                  {(candidate.current_ctc != null || candidate.expected_ctc != null) && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <DollarSign size={13} className="text-gray-400 flex-shrink-0" />
                      {candidate.current_ctc != null && `Current: ₹${candidate.current_ctc}L`}
                      {candidate.current_ctc != null && candidate.expected_ctc != null && " · "}
                      {candidate.expected_ctc != null && `Expected: ₹${candidate.expected_ctc}L`}
                    </div>
                  )}
                  {candidate.source && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                      Source: <span className="capitalize">{candidate.source}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {candidate.summary && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{candidate.summary}</p>
                </div>
              )}

              {/* Application timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Application History
                  {timeline.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ({timeline.length} job{timeline.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </h3>
                {timeline.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
                    No job applications yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((entry) => (
                      <ApplicationCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
