import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { STAGES, getStage } from "../../lib/stages";
import type { PipelineStage } from "../../types";
import { useStageMove } from "./useStageMove";

interface StageSelectProps {
  /** Current stage of the application. */
  value: string;
  /**
   * Application to move. Used when `onChange` is not given: the select then
   * saves through the RTK mutation itself (with the reason prompt for
   * "Disqualified" / "Offer declined").
   */
  applicationId?: string;
  /** Take over saving (e.g. the pipeline board does optimistic updates). */
  onChange?: (stage: PipelineStage) => void;
  /** Called after a successful self-managed save. */
  onMoved?: (stage: PipelineStage) => void;
  /** Reports while the reason modal is open, so a parent modal can ignore Esc. */
  onPromptingChange?: (prompting: boolean) => void;
  candidateName?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Accessible label; defaults to "Stage". */
  label?: string;
  className?: string;
}

/** Dropdown of every pipeline stage (from lib/stages) with the current one selected. */
export default function StageSelect({
  value,
  applicationId,
  onChange,
  onMoved,
  onPromptingChange,
  candidateName,
  size = "md",
  disabled = false,
  label = "Stage",
  className = "",
}: StageSelectProps) {
  const { move, savingId, prompting, reasonModal } = useStageMove();
  // Show the chosen stage straight away; fall back to the prop once saved/failed.
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const saving = !!applicationId && savingId === applicationId;

  useEffect(() => {
    onPromptingChange?.(prompting);
  }, [prompting, onPromptingChange]);

  useEffect(() => {
    setOptimistic(null);
  }, [value]);

  const current = optimistic ?? value;
  const known = STAGES.some((s) => s.key === current);

  const handleChange = async (next: PipelineStage) => {
    if (next === value) return;
    if (onChange) {
      onChange(next);
      return;
    }
    if (!applicationId) return;
    setOptimistic(next);
    const ok = await move(applicationId, next, { candidateName });
    if (ok) onMoved?.(next);
    else setOptimistic(null);
  };

  const sizeClasses = size === "sm" ? "h-7 py-0 pl-5 pr-6 text-xs" : "h-9 py-1.5 pl-7 pr-8 text-sm";
  const tone = getStage(current);

  return (
    <>
      <div className={`relative inline-flex min-w-0 items-center ${className}`}>
        <span
          className={`pointer-events-none absolute ${size === "sm" ? "left-2" : "left-3"} h-2 w-2 rounded-full ${tone.dot}`}
          aria-hidden="true"
        />
        <select
          aria-label={candidateName ? `${label} for ${candidateName}` : label}
          value={current}
          disabled={disabled || saving}
          onChange={(e) => handleChange(e.target.value as PipelineStage)}
          // Don't let a surrounding clickable card open on clicks / Enter here.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
          className={`w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-line bg-white font-medium text-ink hover:border-line-strong focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100 disabled:cursor-wait disabled:opacity-60 ${sizeClasses}`}
        >
          {!known && <option value={current}>{getStage(current).label}</option>}
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        {saving ? (
          <Loader2
            size={size === "sm" ? 12 : 14}
            className={`pointer-events-none absolute animate-spin text-muted ${size === "sm" ? "right-1.5" : "right-2.5"}`}
            aria-hidden="true"
          />
        ) : (
          <ChevronDown
            size={size === "sm" ? 12 : 14}
            className={`pointer-events-none absolute text-muted ${size === "sm" ? "right-1.5" : "right-2.5"}`}
            aria-hidden="true"
          />
        )}
      </div>
      {reasonModal}
    </>
  );
}
