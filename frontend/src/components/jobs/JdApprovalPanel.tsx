import { useState } from "react";
import { CheckCircle, XCircle, Clock, Send } from "lucide-react";
import {
  useGetJobApprovalQuery,
  useSubmitForReviewMutation,
  useApproveJobMutation,
  useRejectJobMutation,
  type JobApproval,
} from "../../store/api/jdLifecycleApi";

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

  const isApprover = userRole === "super_admin" || userRole === "accounts_manager";
  const canSubmit =
    jobStatus === "draft" &&
    ["super_admin", "accounts_manager", "recruiter", "vendor_manager"].includes(userRole);

  const handleSubmit = async () => {
    setActionError("");
    try {
      await submitForReview(jobId).unwrap();
    } catch (e: any) {
      setActionError(e?.data?.message ?? "Failed to submit for review.");
    }
  };

  const handleApprove = async () => {
    setActionError("");
    try {
      await approveJob({ jobId, notes: notes.trim() || undefined }).unwrap();
      setShowApproveModal(false);
      setNotes("");
    } catch (e: any) {
      setActionError(e?.data?.message ?? "Failed to approve.");
    }
  };

  const handleReject = async () => {
    setActionError("");
    try {
      await rejectJob({ jobId, notes: notes.trim() || undefined }).unwrap();
      setShowRejectModal(false);
      setNotes("");
    } catch (e: any) {
      setActionError(e?.data?.message ?? "Failed to reject.");
    }
  };

  if (isLoading) return null;

  return (
    <>
      {/* Modals */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" /> Approve Job Description
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Approving will set this job to <strong>Active</strong> and notify assigned vendors.
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Approval comment…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            {actionError && <p className="text-xs text-red-600 mt-2">{actionError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowApproveModal(false); setNotes(""); setActionError(""); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={approving}
                onClick={handleApprove}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {approving ? "Approving…" : "Confirm Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <XCircle size={18} className="text-red-500" /> Reject Job Description
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Rejecting will return this job to <strong>Draft</strong> for revision.
            </p>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What needs to be corrected?"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            {actionError && <p className="text-xs text-red-600 mt-2">{actionError}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setNotes(""); setActionError(""); }}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={rejecting}
                onClick={handleReject}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                {rejecting ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
          Approval Workflow
        </h3>

        {actionError && !showApproveModal && !showRejectModal && (
          <p className="text-xs text-red-600 mb-3 bg-red-50 px-3 py-2 rounded-lg">{actionError}</p>
        )}

        {/* Current approval status */}
        {approval && <ApprovalStatus approval={approval} />}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canSubmit && (
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <Send size={14} />
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          )}

          {isApprover && jobStatus === "pending_review" && (
            <>
              <button
                onClick={() => { setNotes(""); setActionError(""); setShowApproveModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                onClick={() => { setNotes(""); setActionError(""); setShowRejectModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <XCircle size={14} /> Reject
              </button>
            </>
          )}

          {!canSubmit && !(isApprover && jobStatus === "pending_review") && (
            <p className="text-xs text-gray-400">
              {jobStatus === "active"
                ? "This job has been approved and is active."
                : jobStatus === "pending_review"
                ? "Awaiting review by an admin."
                : "No actions available for the current status."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function ApprovalStatus({ approval }: { approval: JobApproval }) {
  const statusConfig = {
    pending: { icon: <Clock size={14} className="text-amber-500" />, label: "Pending Review", bg: "bg-amber-50 border-amber-200" },
    approved: { icon: <CheckCircle size={14} className="text-emerald-600" />, label: "Approved", bg: "bg-emerald-50 border-emerald-200" },
    rejected: { icon: <XCircle size={14} className="text-red-500" />, label: "Rejected", bg: "bg-red-50 border-red-200" },
  };
  const cfg = statusConfig[approval.status];

  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        {cfg.icon}
        <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
      </div>
      <p className="text-xs text-gray-500">
        Submitted by <span className="font-medium text-gray-700">{approval.submitter_name ?? "Unknown"}</span>
        {" "}on {formatDate(approval.submitted_at)}
        {approval.version_num != null && ` (v${approval.version_num})`}
      </p>
      {approval.reviewed_at && (
        <p className="text-xs text-gray-500 mt-0.5">
          {approval.status === "approved" ? "Approved" : "Rejected"} by{" "}
          <span className="font-medium text-gray-700">{approval.reviewer_name ?? "Unknown"}</span>
          {" "}on {formatDate(approval.reviewed_at)}
        </p>
      )}
      {approval.notes && (
        <p className="text-xs text-gray-600 mt-2 italic">&ldquo;{approval.notes}&rdquo;</p>
      )}
    </div>
  );
}
