import { useDroppable } from "@dnd-kit/core";
import { JobApplication, PipelineStage } from "../../types";
import { getStage } from "../../lib/stages";
import CandidateCard from "./CandidateCard";

interface KanbanColumnProps {
  stage: PipelineStage;
  /** Defaults to the shared stage label from lib/stages. */
  label?: string;
  applications: JobApplication[];
  onScreeningInvite?: (application: JobApplication) => void | Promise<unknown>;
  onOpen?: (application: JobApplication) => void;
  onStageChange?: (application: JobApplication, stage: PipelineStage) => void;
}

export default function KanbanColumn({
  stage,
  label,
  applications,
  onScreeningInvite,
  onOpen,
  onStageChange,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const s = getStage(stage);
  const count = applications.length;

  return (
    <section aria-label={`${label ?? s.label}: ${count}`} className="flex w-60 flex-shrink-0 flex-col">
      {/* Sticky column header: stays visible while the board scrolls vertically. */}
      <div className="sticky top-0 z-10 bg-surface pb-2">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 shadow-card">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
            <span className="truncate text-sm font-semibold text-ink">{label ?? s.label}</span>
          </div>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              count > 0 ? s.badge.replace(/ring-\S+/g, "") : "bg-surface-sunken text-muted"
            }`}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-xl border p-1.5 transition-colors duration-150 ${
          isOver ? "border-navy-300 bg-navy-50" : "border-transparent bg-surface-sunken/60"
        }`}
      >
        {applications.map((app) => (
          <CandidateCard
            key={app.id}
            application={app}
            onScreeningInvite={onScreeningInvite}
            onOpen={onOpen}
            onStageChange={onStageChange}
          />
        ))}

        {count === 0 && (
          <div
            className={`flex h-14 items-center justify-center rounded-lg text-xs transition-colors ${
              isOver ? "border border-dashed border-navy-300 text-navy-600" : "text-muted/70"
            }`}
          >
            {isOver ? "Drop here" : "No candidates"}
          </div>
        )}
      </div>
    </section>
  );
}
