import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { BookOpen, X } from "lucide-react";
import HelpAssistant from "./HelpAssistant";
import { useHelp } from "./HelpContext";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser } from "../../store/slices/authSlice";

/** Slide-over help assistant, opened from the top bar on any page. */
export default function HelpPanel() {
  const { open, setOpen } = useHelp();
  const user = useAppSelector(selectCurrentUser);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/20" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-panel-title"
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 id="help-panel-title" className="text-base font-semibold text-ink">Aruna · ZorHire Help</h2>
            <p className="text-xs text-muted">Your help assistant. Ask how to do anything in ZorHire.</p>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/help" onClick={close} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface">
              <BookOpen size={14} aria-hidden="true" /> All help topics
            </Link>
            <button type="button" onClick={close} aria-label="Close help" className="rounded-lg p-1.5 text-ink-soft hover:bg-surface">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <HelpAssistant role={user?.role} compact onNavigate={close} />
      </div>
    </div>
  );
}
