import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ClientPortalLayout from "../../components/client-portal/ClientPortalLayout";
import {
  useGetClientPortalCandidatesQuery,
  useSubmitClientFeedbackMutation,
} from "../../store/api/clientPortalApi";

type Decision = "approved" | "rejected" | "hold";

const DECISION_CONFIG: Record<Decision, { label: string; icon: React.ReactNode; active: string; inactive: string }> = {
  approved: {
    label: "Approve",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    active: "bg-green-600 text-white border-green-600",
    inactive: "bg-white text-green-600 border-green-300 hover:bg-green-50",
  },
  hold: {
    label: "Hold",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    active: "bg-amber-500 text-white border-amber-500",
    inactive: "bg-white text-amber-600 border-amber-300 hover:bg-amber-50",
  },
  rejected: {
    label: "Reject",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    active: "bg-red-500 text-white border-red-500",
    inactive: "bg-white text-red-500 border-red-300 hover:bg-red-50",
  },
};

export default function ClientCandidatesPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data: candidates = [], isLoading, isError } = useGetClientPortalCandidatesQuery(jobId!);
  const [submitFeedback, { isLoading: isSaving }] = useSubmitClientFeedbackMutation();

  const [pendingDecision, setPendingDecision] = useState<{
    applicationId: string;
    decision: Decision;
    notes: string;
  } | null>(null);

  const [savingId, setSavingId] = useState<string | null>(null);

  const handleFeedback = async (applicationId: string, decision: Decision, notes: string) => {
    setSavingId(applicationId);
    try {
      await submitFeedback({ applicationId, decision, notes }).unwrap();
    } catch {
      // error shows inline
    } finally {
      setSavingId(null);
      setPendingDecision(null);
    }
  };

  const pending = candidates.filter((c) => !c.client_decision);
  const reviewed = candidates.filter((c) => !!c.client_decision);

  return (
    <ClientPortalLayout>
      {/* Feedback modal */}
      {pendingDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              {DECISION_CONFIG[pendingDecision.decision].label} Candidate
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={pendingDecision.notes}
              onChange={(e) =>
                setPendingDecision((p) => p ? { ...p, notes: e.target.value } : null)
              }
              placeholder="Add any feedback or reasons…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPendingDecision(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={isSaving}
                onClick={() =>
                  handleFeedback(
                    pendingDecision.applicationId,
                    pendingDecision.decision,
                    pendingDecision.notes,
                  )
                }
                className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50
                  ${pendingDecision.decision === "approved" ? "bg-green-600 hover:bg-green-700" :
                    pendingDecision.decision === "rejected" ? "bg-red-500 hover:bg-red-600" :
                    "bg-amber-500 hover:bg-amber-600"}`}
              >
                {isSaving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-5xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate("/client-portal/jobs")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Positions
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Candidate Review</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pending.length} awaiting your decision · {reviewed.length} reviewed
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mr-3" />
            Loading candidates…
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-5 py-4 rounded-lg">
            Failed to load candidates.
          </div>
        )}

        {!isLoading && !isError && candidates.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-medium">No candidates submitted yet</p>
            <p className="text-sm mt-1">Your recruiter will share candidates here once they are ready for your review.</p>
          </div>
        )}

        {/* Pending review */}
        {pending.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Awaiting Review ({pending.length})
            </h2>
            <div className="space-y-4">
              {pending.map((c) => (
                <div key={c.application_id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base">{c.full_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1 flex-wrap">
                        {c.current_title && <span>{c.current_title}</span>}
                        {c.experience_years != null && <span>{c.experience_years} yrs exp</span>}
                        {c.current_location && (
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {c.current_location}
                          </span>
                        )}
                      </div>

                      {c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {c.skills.slice(0, 6).map((s) => (
                            <span key={s} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      )}

                      {c.summary && (
                        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{c.summary}</p>
                      )}

                      {c.resume_url && (
                        <a
                          href={c.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-indigo-600 text-sm mt-3 hover:text-indigo-800 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Resume
                        </a>
                      )}
                    </div>

                    {/* Decision buttons */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {(["approved", "hold", "rejected"] as Decision[]).map((d) => {
                        const cfg = DECISION_CONFIG[d];
                        return (
                          <button
                            key={d}
                            disabled={savingId === c.application_id}
                            onClick={() =>
                              setPendingDecision({
                                applicationId: c.application_id,
                                decision: d,
                                notes: "",
                              })
                            }
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${cfg.inactive}`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already reviewed */}
        {reviewed.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Already Reviewed ({reviewed.length})
            </h2>
            <div className="space-y-3">
              {reviewed.map((c) => {
                const cfg = DECISION_CONFIG[c.client_decision as Decision];
                return (
                  <div key={c.application_id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm opacity-80">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{c.full_name}</h3>
                          {c.current_title && (
                            <span className="text-sm text-gray-500">{c.current_title}</span>
                          )}
                        </div>
                        {c.client_notes && (
                          <p className="text-xs text-gray-500 mt-1">{c.client_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${cfg?.active ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {cfg?.icon}
                          {cfg?.label ?? c.client_decision}
                        </span>
                        <button
                          onClick={() =>
                            setPendingDecision({
                              applicationId: c.application_id,
                              decision: c.client_decision as Decision,
                              notes: c.client_notes ?? "",
                            })
                          }
                          className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ClientPortalLayout>
  );
}
