import { useDroppable } from "@dnd-kit/core";
import { JobApplication, PipelineStage } from "../../types";
import CandidateCard from "./CandidateCard";

interface KanbanColumnProps {
  stage: PipelineStage;
  label: string;
  color: {
    header: string;
    border: string;
    bg: string;
    dot: string;
  };
  applications: JobApplication[];
}

export default function KanbanColumn({
  stage,
  label,
  color,
  applications,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col flex-shrink-0 w-64">
      {/* Sticky column header */}
      <div
        className={`sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${color.header} mb-0`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
          <span className="text-xs font-bold uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        <span className="text-xs font-semibold bg-white/60 px-2 py-0.5 rounded-full">
          {applications.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-b-xl border-x border-b transition-colors duration-150 p-2 space-y-2
          ${color.border} ${isOver ? "bg-blue-50/80 border-blue-300" : color.bg}
        `}
      >
        {applications.map((app) => (
          <CandidateCard key={app.id} application={app} />
        ))}

        {applications.length === 0 && (
          <div
            className={`flex items-center justify-center h-16 rounded-lg border-2 border-dashed transition-colors
              ${isOver ? "border-blue-300 bg-blue-50" : "border-gray-200"}
            `}
          >
            <p className="text-xs text-gray-400">
              {isOver ? "Drop here" : "No candidates"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
