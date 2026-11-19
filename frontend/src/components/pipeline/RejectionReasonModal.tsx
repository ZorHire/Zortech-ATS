import { useEffect, useId, useState } from "react";
import { getStage } from "../../lib/stages";
import { Button, Modal } from "../ui";

const MAX_LENGTH = 1000;

interface RejectionReasonModalProps {
  open: boolean;
  stage: string;
  candidateName?: string;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/** Asks for an optional reason when a candidate is disqualified or declines an offer. */
export default function RejectionReasonModal({
  open,
  stage,
  candidateName,
  saving = false,
  onCancel,
  onConfirm,
}: RejectionReasonModalProps) {
  const [reason, setReason] = useState("");
  const fieldId = useId();
  const label = getStage(stage).label;

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = () => onConfirm(reason.trim());

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      preventClose={saving}
      title={`Move to ${label}`}
      description={candidateName ? `${candidateName} will be marked as ${label.toLowerCase()}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant={stage === "disqualified" ? "danger" : "primary"} onClick={submit} loading={saving}>
            Move to {label}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={fieldId} className="zh-label">
          Reason <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={fieldId}
          data-autofocus
          rows={3}
          maxLength={MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={stage === "offer_rejected" ? "e.g. Accepted a counter-offer" : "e.g. Skills mismatch, notice period too long"}
          className="zh-input resize-y"
        />
      </form>
    </Modal>
  );
}
