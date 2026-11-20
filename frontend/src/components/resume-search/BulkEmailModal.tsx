import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import api, { ApiError } from "../../lib/api";
import type { Candidate } from "../../types";
import { useNotify } from "../../hooks/useNotify";
import { Button, Modal } from "../ui";

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
    <Modal
      open
      onClose={onClose}
      size="sm"
      preventClose={sending}
      title={
        <span className="flex items-center gap-2">
          <Mail size={16} className="text-navy-600" aria-hidden="true" />
          {phase === "done" ? "Email results" : `Send to ${n} candidate${n === 1 ? "" : "s"}?`}
        </span>
      }
      footer={
        phase === "done" ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} loading={sending}>
              Send {n} email{n === 1 ? "" : "s"}
            </Button>
          </>
        )
      }
    >
      <div className="text-sm">
        {phase === "done" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            {failures.length === 0 ? (
              <CheckCircle2 size={36} className="text-success-600" aria-hidden="true" />
            ) : (
              <AlertCircle size={36} className="text-warning-600" aria-hidden="true" />
            )}
            <p className="font-semibold text-ink">
              Sent {sent}, failed {failures.length}
            </p>
            {notConfigured && (
              <p className="text-xs text-muted">
                Your email account is not connected.{" "}
                <Link to="/settings/email" className="font-medium text-navy-600 hover:underline" onClick={onClose}>
                  Connect email
                </Link>
              </p>
            )}
            {failures.length > 0 && (
              <ul className="max-h-40 w-full space-y-1 overflow-y-auto rounded-lg bg-danger-50 p-3 text-left text-xs text-danger-700">
                {failures.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium">{f.name}</span>: {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Subject</p>
              <p className="text-ink">{BULK_EMAIL_SUBJECT}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Recipients</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface p-3 text-xs text-ink-soft">
                {candidates.map((c) => (
                  <li key={c.id} className="break-words">
                    {fullName(c)} <span className="text-muted">{c.email || "(no email)"}</span>
                  </li>
                ))}
              </ul>
            </div>
            {sending && (
              <p className="flex items-center gap-2 text-xs text-muted" role="status">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Sending {progress} of {n}…
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
