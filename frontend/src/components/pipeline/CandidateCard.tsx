import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Briefcase, MapPin, Clock, Send, Loader2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { JobApplication, PipelineStage } from "../../types";
import { Badge, useConfirm } from "../ui";
import { Avatar } from "../jobs/jobBadges";
import StageSelect from "./StageSelect";

interface CandidateCardProps {
  application: JobApplication;
  isOverlay?: boolean;
  /** May return a promise; the button shows a pending state until it settles. */
  onScreeningInvite?: (application: JobApplication) => void | Promise<unknown>;
  /** Open the candidate (card click or Enter). */
  onOpen?: (application: JobApplication) => void;
  /** Move to another stage from the card's stage dropdown. */
  onStageChange?: (application: JobApplication, stage: PipelineStage) => void;
}

/** Clicks on the card's own controls (or inside a portal, e.g. a modal) don't open it. */
function isOwnControl(e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): boolean {
  const target = e.target as HTMLElement;
  if (!e.currentTarget.contains(target)) return true;
  return !!target.closest("button, a, select, input, textarea, label");
}

export default function CandidateCard({
  application,
  isOverlay = false,
  onScreeningInvite,
  onOpen,
  onStageChange,
}: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: application.id });
  const [sendingInvite, setSendingInvite] = useState(false);
  const confirm = useConfirm();

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

  const interactive = !!onOpen && !isOverlay;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(interactive
        ? {
            tabIndex: 0,
            role: "group",
            title: "Open candidate (Enter)",
            "aria-label": `${fullName}, open candidate`,
            onClick: (e: MouseEvent<HTMLDivElement>) => {
              if (isOwnControl(e)) return;
              onOpen?.(application);
            },
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key !== "Enter" || e.target !== e.currentTarget) return;
              e.preventDefault();
              onOpen?.(application);
            },
          }
        : {})}
      className={`group select-none rounded-lg border bg-white p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 ${
        isDragging && !isOverlay ? "border-navy-300 opacity-30 shadow-none" : ""
      } ${
        isOverlay
          ? "rotate-1 cursor-grabbing border-navy-400 shadow-pop ring-2 ring-navy-200"
          : `${interactive ? "cursor-pointer" : "cursor-grab"} border-line shadow-card hover:border-line-strong hover:shadow-md`
      }`}
    >
      {/* Drag handle + name */}
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 flex-shrink-0 cursor-grab rounded text-line-strong transition-colors hover:text-muted active:cursor-grabbing"
          aria-label="Drag to move"
        >
          <GripVertical size={14} />
        </button>

        <div className="flex-1 min-w-0">
          {/* Avatar + Name + AI score */}
          <div className="flex items-center gap-2 mb-1">
            <Avatar name={fullName} size="xs" />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-ink">
              {fullName}
            </p>
            {application.ai_score != null && (
              <span className="flex-shrink-0" title={application.ai_match_breakdown?.rationale}>
                <Badge tone={application.ai_score >= 75 ? "success" : application.ai_score >= 50 ? "warning" : "neutral"}>
                  {application.ai_score}/100
                </Badge>
              </span>
            )}
            {typeof application.ai_shortlist?.score === "number" && (
              <span
                className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  application.ai_shortlist.score >= 75
                    ? "bg-success-50 text-success-700 ring-emerald-100"
                    : application.ai_shortlist.score >= 50
                      ? "bg-warning-50 text-warning-700 ring-brand-100"
                      : "bg-surface-sunken text-ink-soft ring-line"
                }`}
                title={`AI shortlist score ${Math.round(application.ai_shortlist.score)}/100${
                  application.ai_shortlist.decision === "review" || application.ai_shortlist.decision === "not_a_fit"
                    ? " · needs review"
                    : ""
                }`}
                aria-label={`AI shortlist score ${Math.round(application.ai_shortlist.score)} out of 100`}
              >
                AI {Math.round(application.ai_shortlist.score)}
              </span>
            )}
          </div>

          {/* Title */}
          {title && (
            <div className="flex items-center gap-1 mb-1.5">
              <Briefcase size={11} className="flex-shrink-0 text-muted" />
              <span className="truncate text-xs text-muted">{title}</span>
            </div>
          )}

          {/* Location + Experience */}
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {location && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
                <MapPin size={11} />
                {location}
              </span>
            )}
            {experience > 0 && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
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
                  className="max-w-full truncate rounded-md bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-700"
                >
                  {skill}
                </span>
              ))}
              {skills.length > 3 && (
                <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs text-muted">
                  +{skills.length - 3}
                </span>
              )}
            </div>
          )}

          {onStageChange && !isOverlay && (
            <StageSelect
              size="sm"
              value={application.stage}
              candidateName={fullName}
              onChange={(stage) => onStageChange(application, stage)}
              className="mt-2 w-full"
            />
          )}

          {/* Screening invite trigger — dark by default (SCREENING_CHAT_ENABLED gate) */}
          {onScreeningInvite && !isOverlay && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (sendingInvite) return;
                const ok = await confirm({
                  title: "Send screening invite?",
                  message: `${fullName} will get a screening invite email.`,
                  confirmText: "Send invite",
                });
                if (!ok) return;
                setSendingInvite(true);
                try {
                  await onScreeningInvite(application);
                } finally {
                  setSendingInvite(false);
                }
              }}
              disabled={sendingInvite}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-navy-600 disabled:cursor-wait disabled:opacity-60"
            >
              {sendingInvite ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              {sendingInvite ? "Sending…" : "Send screening invite"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
