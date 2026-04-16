import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { EmailToast as EmailToastProps } from "../../hooks/useSendEmail";

export default function EmailToast({ message, type, showConfigLink }: EmailToastProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300 ${
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 size={18} className="shrink-0" />
      ) : (
        <XCircle size={18} className="shrink-0" />
      )}
      <span>{message}</span>
      {showConfigLink && (
        <Link
          to="/settings/email"
          className="ml-1 flex items-center gap-1 underline underline-offset-2 opacity-90 hover:opacity-100 whitespace-nowrap"
        >
          Connect email <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
