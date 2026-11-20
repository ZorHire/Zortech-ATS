import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useUpdateApplicationStageMutation } from "../../store/api/pipelineApi";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";
import { getStage } from "../../lib/stages";
import type { PipelineStage } from "../../types";
import RejectionReasonModal from "./RejectionReasonModal";

/** Stages where we ask for an (optional) reason before saving. */
export const REASON_STAGES: readonly PipelineStage[] = ["disqualified", "offer_rejected"];
export const stageNeedsReason = (stage: string) => (REASON_STAGES as readonly string[]).includes(stage);

interface Pending {
  applicationId: string;
  stage: PipelineStage;
  candidateName?: string;
  resolve: (ok: boolean) => void;
}

export interface StageMoveOptions {
  candidateName?: string;
}

/**
 * Moves an application to any stage through the RTK mutation (so Pipeline,
 * Dashboard and Candidate caches refresh) and reports the result with toasts.
 * "Disqualified" / "Offer declined" first open a small modal for an optional
 * reason. `move()` resolves true when the stage was saved, false when the
 * user cancelled or the save failed. Render `reasonModal` once.
 */
export function useStageMove() {
  const [updateStage] = useUpdateApplicationStageMutation();
  const notify = useNotify();
  const [pending, setPending] = useState<Pending | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingReason, setSavingReason] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const save = useCallback(
    async (applicationId: string, stage: PipelineStage, rejectionReason?: string) => {
      setSavingId(applicationId);
      try {
        await updateStage({ applicationId, stage, rejectionReason: rejectionReason || undefined }).unwrap();
        notify.success(`Moved to ${getStage(stage).label}`);
        return true;
      } catch (err) {
        notify.error(getErrorMessage(err, "Could not move candidate"));
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [updateStage, notify],
  );

  const move = useCallback(
    (applicationId: string, stage: PipelineStage, opts: StageMoveOptions = {}): Promise<boolean> => {
      if (stageNeedsReason(stage)) {
        // A previous prompt that was never answered counts as cancelled.
        pendingRef.current?.resolve(false);
        return new Promise<boolean>((resolve) =>
          setPending({ applicationId, stage, candidateName: opts.candidateName, resolve }),
        );
      }
      return save(applicationId, stage);
    },
    [save],
  );

  const reasonModal: ReactNode = (
    <RejectionReasonModal
      open={!!pending}
      stage={pending?.stage ?? "disqualified"}
      candidateName={pending?.candidateName}
      saving={savingReason}
      onCancel={() => {
        pending?.resolve(false);
        setPending(null);
      }}
      onConfirm={async (reason) => {
        if (!pending) return;
        setSavingReason(true);
        const ok = await save(pending.applicationId, pending.stage, reason);
        setSavingReason(false);
        pending.resolve(ok);
        setPending(null);
      }}
    />
  );

  /** True while the reason modal is open (a parent modal should not close on Esc). */
  const prompting = !!pending;

  return { move, savingId, prompting, reasonModal };
}
