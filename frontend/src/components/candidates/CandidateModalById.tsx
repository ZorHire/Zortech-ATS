import { useGetCandidateByIdQuery } from "../../store/api/candidateApi";
import { ErrorState, Modal, Skeleton } from "../ui";
import CandidateModal from "./CandidateModal";

interface CandidateModalByIdProps {
  candidateId: string;
  /** Preselect this application (e.g. the pipeline card that was clicked). */
  applicationId?: string;
  /** Shown in the title while the full profile loads. */
  name?: string;
  onClose: () => void;
}

/**
 * Loads the full candidate profile, then shows CandidateModal. Used where only
 * a partial candidate row is at hand (pipeline cards).
 */
export default function CandidateModalById({ candidateId, applicationId, name, onClose }: CandidateModalByIdProps) {
  const { data: candidate, isLoading, error, refetch, isFetching } = useGetCandidateByIdQuery(candidateId);

  if (candidate) {
    return <CandidateModal key={candidate.id} candidate={candidate} applicationId={applicationId} onClose={onClose} />;
  }

  return (
    <Modal open onClose={onClose} size="xl" closeOnBackdrop title={name ?? "Candidate"}>
      {isLoading || (!error && isFetching) ? (
        <div className="space-y-3" role="status" aria-label="Loading candidate">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <ErrorState error={error} title="Couldn't load this candidate" onRetry={refetch} retrying={isFetching} compact />
      )}
    </Modal>
  );
}
