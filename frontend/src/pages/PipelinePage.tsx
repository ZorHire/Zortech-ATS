import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { ArrowLeft, RefreshCw, Users, AlertCircle } from "lucide-react";
import Header from "../components/layout/Header";
import KanbanColumn from "../components/pipeline/KanbanColumn";
import CandidateCard from "../components/pipeline/CandidateCard";
import { JobApplication, PipelineStage, Job } from "../types";
import api from "../lib/api";

// All pipeline stages in order
const STAGES: {
  key: PipelineStage;
  label: string;
  color: { header: string; border: string; bg: string; dot: string };
}[] = [
  {
    key: "new",
    label: "New",
    color: {
      header: "bg-gray-100 text-gray-700 border-gray-200",
      border: "border-gray-200",
      bg: "bg-gray-50",
      dot: "bg-gray-400",
    },
  },
  {
    key: "sourced",
    label: "Sourced",
    color: {
      header: "bg-blue-50 text-blue-700 border-blue-200",
      border: "border-blue-200",
      bg: "bg-blue-50/40",
      dot: "bg-blue-400",
    },
  },
  {
    key: "screened",
    label: "Screened",
    color: {
      header: "bg-cyan-50 text-cyan-700 border-cyan-200",
      border: "border-cyan-200",
      bg: "bg-cyan-50/40",
      dot: "bg-cyan-400",
    },
  },
  {
    key: "shortlisted",
    label: "Shortlisted",
    color: {
      header: "bg-violet-50 text-violet-700 border-violet-200",
      border: "border-violet-200",
      bg: "bg-violet-50/40",
      dot: "bg-violet-400",
    },
  },
  {
    key: "submitted_to_client",
    label: "Submitted",
    color: {
      header: "bg-amber-50 text-amber-700 border-amber-200",
      border: "border-amber-200",
      bg: "bg-amber-50/40",
      dot: "bg-amber-400",
    },
  },
  {
    key: "client_interview_scheduled",
    label: "Interview",
    color: {
      header: "bg-orange-50 text-orange-700 border-orange-200",
      border: "border-orange-200",
      bg: "bg-orange-50/40",
      dot: "bg-orange-400",
    },
  },
  {
    key: "interview_completed",
    label: "Interviewed",
    color: {
      header: "bg-purple-50 text-purple-700 border-purple-200",
      border: "border-purple-200",
      bg: "bg-purple-50/40",
      dot: "bg-purple-400",
    },
  },
  {
    key: "selected",
    label: "Selected",
    color: {
      header: "bg-green-50 text-green-700 border-green-200",
      border: "border-green-200",
      bg: "bg-green-50/40",
      dot: "bg-green-500",
    },
  },
  {
    key: "offer_extended",
    label: "Offer Extended",
    color: {
      header: "bg-emerald-50 text-emerald-700 border-emerald-200",
      border: "border-emerald-200",
      bg: "bg-emerald-50/40",
      dot: "bg-emerald-500",
    },
  },
  {
    key: "offer_accepted",
    label: "Offer Accepted",
    color: {
      header: "bg-teal-50 text-teal-700 border-teal-200",
      border: "border-teal-200",
      bg: "bg-teal-50/40",
      dot: "bg-teal-500",
    },
  },
  {
    key: "joined",
    label: "Joined",
    color: {
      header: "bg-lime-50 text-lime-700 border-lime-200",
      border: "border-lime-200",
      bg: "bg-lime-50/40",
      dot: "bg-lime-500",
    },
  },
  {
    key: "disqualified",
    label: "Disqualified",
    color: {
      header: "bg-red-50 text-red-700 border-red-200",
      border: "border-red-200",
      bg: "bg-red-50/40",
      dot: "bg-red-400",
    },
  },
];

export default function PipelinePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeApplication, setActiveApplication] =
    useState<JobApplication | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [jobData, appsData] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/pipeline/jobs/${jobId}/applications`),
      ]);
      setJob(jobData);
      // Ensure applications is always an array
      setApplications(
        Array.isArray(appsData)
          ? appsData
          : appsData.data || appsData.applications || [],
      );
    } catch (err: any) {
      console.error("Pipeline fetch error:", err);
      setError(err.message || "Failed to load pipeline data");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDragStart = (event: DragStartEvent) => {
    const found = applications.find((a) => a.id === event.active.id);
    setActiveApplication(found ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveApplication(null);

    if (!over) return;

    const applicationId = active.id as string;
    const newStage = over.id as PipelineStage;
    const application = applications.find((a) => a.id === applicationId);

    if (!application || application.stage === newStage) return;

    const prevStage = application.stage;

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, stage: newStage } : a)),
    );
    setMovingId(applicationId);

    try {
      await api.patch(`/pipeline/applications/${applicationId}/stage`, {
        to_stage: newStage,
      });
      showToast(
        `Moved to ${STAGES.find((s) => s.key === newStage)?.label ?? newStage}`,
        "success",
      );
    } catch (err: any) {
      // Revert on failure
      setApplications((prev) =>
        prev.map((a) =>
          a.id === applicationId ? { ...a, stage: prevStage } : a,
        ),
      );
      showToast(err.message || "Failed to move candidate", "error");
    } finally {
      setMovingId(null);
    }
  };

  // Group applications by stage
  const byStage = (stage: PipelineStage) =>
    applications.filter((a) => a.stage === stage);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Pipeline" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading pipeline...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Pipeline" subtitle="Error" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
            <p className="text-gray-700 font-medium mb-1">
              Failed to load pipeline
            </p>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={job?.title ?? "Pipeline"}
        subtitle={`${applications.length} candidate${applications.length !== 1 ? "s" : ""} · Kanban View`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/jobs/${jobId}`}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={15} />
              Back to Job
            </Link>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      {/* Board — horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="flex gap-3 h-full pb-4"
            style={{ minWidth: "max-content" }}
          >
            {STAGES.map(({ key, label, color }) => (
              <KanbanColumn
                key={key}
                stage={key}
                label={label}
                color={color}
                applications={byStage(key)}
              />
            ))}
          </div>

          {/* Drag overlay — card preview while dragging */}
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
            {activeApplication && (
              <CandidateCard application={activeApplication} isOverlay />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Stage moving indicator */}
      {movingId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-50">
          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          Saving…
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium transition-all
            ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}
          `}
        >
          {toast.type === "success" ? (
            <Users size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
