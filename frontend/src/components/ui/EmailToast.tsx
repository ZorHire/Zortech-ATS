import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { EmailToast as EmailToastProps } from "../../hooks/useSendEmail";

export default function EmailToast({ message, type, showConfigLink }: EmailToastProps) {
  return (
    <div
      role={type === "success" ? "status" : "alert"}
      className="fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink shadow-pop"
    >
      {type === "success" ? (
        <CheckCircle2 size={18} className="shrink-0 text-success-600" />
      ) : (
        <XCircle size={18} className="shrink-0 text-danger-600" />
      )}
      <span>{message}</span>
      {showConfigLink && (
        <Link
          to="/settings/email"
          className="ml-1 flex items-center gap-1 whitespace-nowrap font-semibold text-navy-600 underline-offset-2 hover:underline"
        >
          Connect email <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
