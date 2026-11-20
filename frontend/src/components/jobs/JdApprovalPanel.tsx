import { useState } from "react";
import { CheckCircle, XCircle, Clock, Send } from "lucide-react";
import {
  useGetJobApprovalQuery,
  useSubmitForReviewMutation,
  useApproveJobMutation,
  useRejectJobMutation,
  type JobApproval,
} from "../../store/api/jdLifecycleApi";
import { Button, Modal } from "../ui";
import { getErrorMessage } from "../../lib/format";

interface Props {
  jobId: string;
  jobStatus: string;
  userRole: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function JdApprovalPanel({ jobId, jobStatus, userRole }: Props) {
  const { data: approval, isLoading } = useGetJobApprovalQuery(jobId);
  const [submitForReview, { isLoading: submitting }] = useSubmitForReviewMutation();
  const [approveJob, { isLoading: approving }] = useApproveJobMutation();
  const [rejectJob, { isLoading: rejecting }] = useRejectJobMutation();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [notes, setNotes] = useState("");
  const [actionError, setActionError] = useState("");

  // Modal handles Esc (blocked mid-request). No backdrop-close: it holds a typed note.
  const closeModals = () => {
    setShowApproveModal(false); setShowRejectModal(false); setNotes(""); setActionError("");
  };

  const isApprover = userRole === "super_admin" || userRole === "accounts_manager";
  const canSubmit =
    jobStatus === "draft" &&
    ["super_admin", "accounts_manager", "recruiter", "vendor_manager"].includes(userRole);

  const handleSubmit = async () => {
    setActionError("");
    try {
      await submitForReview(jobId).unwrap();
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to submit for review."));
    }
  };

  const handleApprove = async () => {
    setActionError("");
    try {
      await approveJob({ jobId, notes: notes.trim() || undefined }).unwrap();
      setShowApproveModal(false);
      setNotes("");
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to approve."));
    }
  };

  const handleReject = async () => {
    setActionError("");
    try {
      await rejectJob({ jobId, notes: notes.trim() || undefined }).unwrap();
      setShowRejectModal(false);
      setNotes("");
    } catch (e) {
      setActionError(getErrorMessage(e, "Failed to reject."));
    }
  };

  if (isLoading) return null;

  const modalOpen = showApproveModal || showRejectModal;
  const isApprove = showApproveModal;
  const busy = approving || rejecting;

  return (
    <>
      <Modal
        open={modalOpen}
        onClose={closeModals}
        preventClose={busy}
        size="sm"
        title={isApprove ? "Approve job description" : "Reject job description"}
        description={
          isApprove ? (
            <>Approving will set this job to <strong>Active</strong> and notify assigned vendors.</>
          ) : (
            <>Rejecting will return this job to <strong>Draft</strong> for revision.</>
          )
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModals} disabled={busy}>Cancel</Button>
            {isApprove ? (
              <Button icon={<CheckCircle size={16} />} loading={approving} loadingText="Approving…" onClick={handleApprove}>
                Approve
              </Button>
            ) : (
              <Button variant="danger" icon={<XCircle size={16} />} loading={rejecting} loadingText="Rejecting…" onClick={handleReject}>
                Reject
              </Button>
            )}
          </>
        }
      >
        <label htmlFor="jd-approval-notes" className="zh-label">
          {isApprove ? "Note" : "Reason"} <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="jd-approval-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isApprove ? "Approval comment…" : "What needs to be corrected?"}
          aria-describedby={actionError ? "jd-approval-error" : undefined}
          className="zh-input resize-none"
        />
        {actionError && <p id="jd-approval-error" className="mt-1 text-xs text-danger-600">{actionError}</p>}
      </Modal>

      {/* Panel */}
      <section className="zh-card p-5">
        <h3 className="mb-4 text-base font-semibold text-ink">Approval workflow</h3>

        {actionError && !modalOpen && (
          <p role="alert" className="mb-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{actionError}</p>
        )}

        {/* Current approval status */}
        {approval && <ApprovalStatus approval={approval} />}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canSubmit && (
            <Button icon={<Send size={16} />} loading={submitting} loadingText="Submitting…" onClick={handleSubmit}>
              Submit for review
            </Button>
          )}

          {isApprover && jobStatus === "pending_review" && (
            <>
              <Button
                icon={<CheckCircle size={16} />}
                onClick={() => { setNotes(""); setActionError(""); setShowApproveModal(true); }}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                icon={<XCircle size={16} />}
                onClick={() => { setNotes(""); setActionError(""); setShowRejectModal(true); }}
              >
                Reject
              </Button>
            </>
          )}

          {!canSubmit && !(isApprover && jobStatus === "pending_review") && (
            <p className="text-sm text-muted">
              {jobStatus === "active"
                ? "This job has been approved and is active."
                : jobStatus === "pending_review"
                ? "Awaiting review by an admin."
                : "No actions available for the current status."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function ApprovalStatus({ approval }: { approval: JobApproval }) {
  const statusConfig = {
    pending: { icon: <Clock size={15} className="text-warning-600" />, label: "Pending review", bg: "bg-warning-50 border-brand-100" },
    approved: { icon: <CheckCircle size={15} className="text-success-600" />, label: "Approved", bg: "bg-success-50 border-emerald-100" },
    rejected: { icon: <XCircle size={15} className="text-danger-600" />, label: "Rejected", bg: "bg-danger-50 border-red-100" },
  };
  const cfg = statusConfig[approval.status];

  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        {cfg.icon}
        <span className="text-sm font-semibold text-ink">{cfg.label}</span>
      </div>
      <p className="text-xs text-muted">
        Submitted by <span className="font-medium text-ink">{approval.submitter_name ?? "Unknown"}</span>
        {" "}on {formatDate(approval.submitted_at)}
        {approval.version_num != null && ` (v${approval.version_num})`}
      </p>
      {approval.reviewed_at && (
        <p className="text-xs text-muted mt-0.5">
          {approval.status === "approved" ? "Approved" : "Rejected"} by{" "}
          <span className="font-medium text-ink">{approval.reviewer_name ?? "Unknown"}</span>
          {" "}on {formatDate(approval.reviewed_at)}
        </p>
      )}
      {approval.notes && (
        <p className="mt-2 text-xs italic text-ink-soft">&ldquo;{approval.notes}&rdquo;</p>
      )}
    </div>
  );
}
