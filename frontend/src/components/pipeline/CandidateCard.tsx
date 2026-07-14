import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Briefcase, MapPin, Clock, Send } from "lucide-react";
import { JobApplication } from "../../types";

interface CandidateCardProps {
  application: JobApplication;
  isOverlay?: boolean;
  onScreeningInvite?: (application: JobApplication) => void;
}

export default function CandidateCard({
  application,
  isOverlay = false,
  onScreeningInvite,
}: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: application.id });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const candidate = application.candidate;
  const fullName = candidate
    ? `${candidate.first_name} ${candidate.last_name}`
    : "Unknown";

  const skills: string[] = candidate?.skills ?? [];
  const experience = candidate?.experience_years ?? 0;
  const title = candidate?.current_title ?? "";
  const location = candidate?.current_location ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-xl p-3.5 select-none transition-all group
        ${isDragging && !isOverlay ? "opacity-30 border-blue-300 shadow-none" : ""}
        ${isOverlay ? "shadow-2xl border-blue-400 rotate-1 cursor-grabbing ring-2 ring-blue-300/50" : "border-gray-200 hover:border-blue-300 hover:shadow-md cursor-grab shadow-sm"}
      `}
    >
      {/* Drag handle + name */}
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors cursor-grab active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Avatar + Name + AI score */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-bold">
                {candidate?.first_name?.[0] ?? "?"}
                {candidate?.last_name?.[0] ?? ""}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight flex-1 min-w-0">
              {fullName}
            </p>
            {application.ai_score != null && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  application.ai_score >= 75
                    ? "bg-emerald-50 text-emerald-700"
                    : application.ai_score >= 50
                      ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                }`}
                title={application.ai_match_breakdown?.rationale}
              >
                {application.ai_score}/100
              </span>
            )}
          </div>

          {/* Title */}
          {title && (
            <div className="flex items-center gap-1 mb-1.5">
              <Briefcase size={11} className="text-gray-400 flex-shrink-0" />
              <span className="text-xs text-gray-500 truncate">{title}</span>
            </div>
          )}

          {/* Location + Experience */}
          <div className="flex items-center gap-3 mb-2.5">
            {location && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} />
                {location}
              </span>
            )}
            {experience > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={11} />
                {experience}y exp
              </span>
            )}
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-medium"
                >
                  {skill}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                  +{skills.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Screening invite trigger — dark by default (SCREENING_CHAT_ENABLED gate) */}
          {onScreeningInvite && !isOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScreeningInvite(application);
              }}
              className="mt-2.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Send size={10} />
              Send Screening Invite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
