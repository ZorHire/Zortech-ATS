import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, X, CheckCircle2, AlertCircle } from "lucide-react";
import api, { ApiError } from "../../lib/api";
import type { Candidate } from "../../types";
import { useNotify } from "../../hooks/useNotify";

// Same default subject the single-send hook (useSendEmail) uses.
const BULK_EMAIL_SUBJECT = "Exciting Opportunity from ZorHire";

interface Failure {
  name: string;
  reason: string;
}

function fullName(c: Candidate) {
  return `${c.first_name} ${c.last_name}`.trim();
}

/**
 * Confirm-then-send bulk email. Sends one at a time (keeps SMTP rate limits
 * happy and gives progress), then reports per-candidate failures.
 */
export default function BulkEmailModal({
  candidates,
  onClose,
}: {
  candidates: Candidate[];
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "sending" | "done">("confirm");
  const [progress, setProgress] = useState(0);
  const [sent, setSent] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [notConfigured, setNotConfigured] = useState(false);
  const notify = useNotify();

  const sending = phase === "sending";

  // Close on Esc (not mid-send)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const handleSend = async () => {
    setPhase("sending");
    let ok = 0;
    const failed: Failure[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      setProgress(i + 1);
      if (!c.email) {
        failed.push({ name: fullName(c), reason: "No email address" });
        continue;
      }
      try {
        await api.post("/email/send-single", {
          to: c.email,
          firstName: c.first_name,
          subject: BULK_EMAIL_SUBJECT,
        });
        ok++;
      } catch (err) {
        const code = err instanceof ApiError ? (err.data?.code as string | undefined) : undefined;
        if (code === "EMAIL_NOT_CONFIGURED") {
          // Nothing else will succeed; stop and point the user to settings.
          setNotConfigured(true);
          candidates.slice(i).forEach((rest) =>
            failed.push({ name: fullName(rest), reason: "Email not configured" }),
          );
          break;
        }
        const msg =
          err instanceof ApiError
            ? (err.data?.message as string | undefined) ?? err.message
            : (err as Error)?.message;
        failed.push({ name: fullName(c), reason: msg || "Failed to send" });
      }
    }
    setSent(ok);
    setFailures(failed);
    setPhase("done");
    if (failed.length === 0) notify.success(`Email sent to ${ok} candidate${ok === 1 ? "" : "s"}`);
    else notify.error(`Sent ${ok}, failed ${failed.length}`);
  };

  const n = candidates.length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !sending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-email-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 id="bulk-email-title" className="font-semibold text-gray-900 flex items-center gap-2">
            <Mail size={16} className="text-blue-600" />
            {phase === "done" ? "Email results" : `Send to ${n} candidate${n === 1 ? "" : "s"}?`}
          </h3>
          <button onClick={onClose} disabled={sending} aria-label="Close" className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm">
          {phase === "done" ? (
            <div className="flex flex-col items-center gap-3 text-center">
              {failures.length === 0 ? (
                <CheckCircle2 size={36} className="text-emerald-500" />
              ) : (
                <AlertCircle size={36} className="text-amber-500" />
              )}
              <p className="font-semibold text-gray-900">Sent {sent}, failed {failures.length}</p>
              {notConfigured && (
                <p className="text-xs text-gray-600">
                  Your email account is not connected.{" "}
                  <Link to="/settings/email" className="text-blue-600 hover:underline" onClick={onClose}>
                    Connect email
                  </Link>
                </p>
              )}
              {failures.length > 0 && (
                <ul className="w-full text-left text-xs text-red-600 bg-red-50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {failures.map((f, i) => (
                    <li key={i}><span className="font-medium">{f.name}</span>: {f.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                <p className="text-gray-900">{BULK_EMAIL_SUBJECT}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Recipients</p>
                <ul className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 space-y-1 max-h-40 overflow-y-auto">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      {fullName(c)} <span className="text-gray-400">{c.email || "(no email)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {sending && (
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Sending {progress} of {n}…
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          {phase === "done" ? (
            <button onClick={onClose} className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
          ) : (
            <>
              <button onClick={onClose} disabled={sending} className="text-sm px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {sending && <Loader2 size={13} className="animate-spin" />}
                Send {n} email{n === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
