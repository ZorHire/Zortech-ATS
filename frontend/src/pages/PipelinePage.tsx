import { useState, useEffect } from "react";
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
import { RefreshCw, Sparkles, Users } from "lucide-react";
import KanbanColumn from "../components/pipeline/KanbanColumn";
import CandidateCard from "../components/pipeline/CandidateCard";
import { JobApplication, PipelineStage } from "../types";
import { useGetJobQuery } from "../store/api/jobApi";
import { useGetPipelineApplicationsQuery, useUpdateApplicationStageMutation } from "../store/api/pipelineApi";
import api from "../lib/api";
import { useNotify } from "../hooks/useNotify";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { baseApi } from "../store/api/baseApi";
import { getErrorMessage } from "../lib/format";
import { STAGES as ALL_STAGES, getStage } from "../lib/stages";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, buttonClasses } from "../components/ui";

// Board columns: shared stage order/labels from lib/stages. "Offer declined"
// has never been a column on this board, so it stays out.
// Every stage gets a column, including "Offer declined", so no candidate is hidden from the board.
const STAGES = ALL_STAGES;

export default function PipelinePage() {
  const { jobId } = useParams<{ jobId: string }>();

  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
    refetch: refetchJob,
  } = useGetJobQuery(jobId!, { skip: !jobId });
  const {
    data: appsData = [],
    isLoading: appsLoading,
    error: appsError,
    isFetching: appsFetching,
    refetch: refetchPipeline,
  } = useGetPipelineApplicationsQuery(jobId!, { skip: !jobId });
  const [updateStage] = useUpdateApplicationStageMutation();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [activeApplication, setActiveApplication] = useState<JobApplication | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  // feat/agents: AI shortlisting state
  const [shortlisting, setShortlisting] = useState(false);
  const notify = useNotify();
  const dispatch = useAppDispatch();

  // origin/main: derived loading / error values from RTK Query
  const loading = jobLoading || appsLoading;
  const loadError = jobError || appsError;

  useEffect(() => {
    setApplications(Array.isArray(appsData) ? appsData : []);
  }, [appsData]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // feat/agents: run AI match-scoring and auto-shortlisting for all eligible candidates
  const handleRunShortlisting = async () => {
    if (!jobId) return;
    setShortlisting(true);
    try {
      const data = await api.post(`/jobs/${jobId}/shortlist`, {});
      notify.success(`Scored ${data.scored}/${data.total_eligible}, auto-shortlisted ${data.shortlisted}`);
      // Raw api call bypasses RTK Query — refresh this board and anything else showing stage counts.
      dispatch(baseApi.util.invalidateTags(["Pipeline", "Dashboard", "Candidates"]));
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to run AI shortlisting"));
    } finally {
      setShortlisting(false);
    }
  };

  // feat/agents: send a screening invite for a candidate in the pipeline
  const handleScreeningInvite = async (application: JobApplication) => {
    try {
      const data = await api.post(`/pipeline/applications/${application.id}/screening-invite`, {});
      if (data.emailSent) notify.success("Screening invite sent");
      else notify.warning("Screening invite created, but the email failed to send");
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to send screening invite"));
    }
  };

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
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, stage: newStage } : a)));
    setMovingId(applicationId);

    try {
      await updateStage({ applicationId, stage: newStage }).unwrap();
      notify.success(`Moved to ${getStage(newStage).label}`);
    } catch (err) {
      // Revert on failure. RTK unwrap() errors carry the server message in `data`, not `message`.
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, stage: prevStage } : a)));
      notify.error(getErrorMessage(err, "Could not move candidate"));
    } finally {
      setMovingId(null);
    }
  };

  const byStage = (stage: PipelineStage) => applications.filter((a) => a.stage === stage);

  const breadcrumbs = [
    { label: "Jobs", to: "/jobs" },
    { label: job?.title ?? "Job", to: `/jobs/${jobId}` },
    { label: "Pipeline" },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Pipeline" subtitle="Loading candidates…" breadcrumbs={breadcrumbs} />
        <div className="p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading pipeline">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-60 flex-shrink-0 space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Pipeline" breadcrumbs={breadcrumbs} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            <ErrorState
              error={loadError}
              title="Couldn't load this pipeline"
              retrying={appsFetching}
              onRetry={() => {
                if (jobError) refetchJob();
                refetchPipeline();
              }}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Pipeline"
        subtitle={`${job?.title ? `${job.title} · ` : ""}${applications.length} candidate${applications.length !== 1 ? "s" : ""} · drag cards between stages`}
        breadcrumbs={breadcrumbs}
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => refetchPipeline()}
              loading={appsFetching}
              icon={<RefreshCw size={16} />}
              aria-label="Refresh pipeline"
              title="Refresh"
            >
              <span className="sr-only sm:not-sr-only">Refresh</span>
            </Button>
            <Button onClick={handleRunShortlisting} loading={shortlisting} loadingText="Scoring…" icon={<Sparkles size={16} />}>
              Run AI shortlisting
            </Button>
          </>
        }
      />

      {applications.length === 0 ? (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            <EmptyState
              icon={<Users size={22} aria-hidden="true" />}
              title="No candidates in this pipeline yet"
              description="Candidates added to this job will appear here, grouped by stage."
              action={
                <Link to={`/jobs/${jobId}`} className={buttonClasses("secondary")}>
                  Open job
                </Link>
              }
            />
          </div>
        </div>
      ) : (
        <div className="min-h-[24rem] flex-1 overflow-auto px-4 pb-4 sm:px-6 lg:px-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex min-h-full gap-3 pb-2 pt-4" style={{ minWidth: "max-content" }}>
              {STAGES.map(({ key, label }) => (
                <KanbanColumn
                  key={key}
                  stage={key as PipelineStage}
                  label={label}
                  applications={byStage(key as PipelineStage)}
                  onScreeningInvite={handleScreeningInvite}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
              {activeApplication && <CandidateCard application={activeApplication} isOverlay />}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {movingId && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy-900 px-3 py-1.5 text-xs text-white shadow-pop"
        >
          <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
          Saving…
        </div>
      )}
    </div>
  );
}
