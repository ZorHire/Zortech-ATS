import { useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { removeNotification } from "../../store/slices/notificationSlice";
import type { AppNotification } from "../../store/slices/notificationSlice";

const STYLES: Record<AppNotification["type"], { bar: string; icon: string; bg: string; border: string }> = {
  success: { bar: "bg-success-600", icon: "text-success-600", bg: "bg-white", border: "border-line" },
  error:   { bar: "bg-danger-600",  icon: "text-danger-600",  bg: "bg-white", border: "border-line" },
  warning: { bar: "bg-brand-500",   icon: "text-warning-600", bg: "bg-white", border: "border-line" },
  info:    { bar: "bg-navy-600",    icon: "text-navy-600",    bg: "bg-white", border: "border-line" },
};

const ICONS: Record<AppNotification["type"], React.ElementType> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const AUTO_DISMISS_MS = 5000;

function ToastItem({ notification }: { notification: AppNotification }) {
  const dispatch = useAppDispatch();
  const s = STYLES[notification.type];
  const Icon = ICONS[notification.type];

  useEffect(() => {
    const timer = setTimeout(() => dispatch(removeNotification(notification.id)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notification.id, dispatch]);

  return (
    <div
      role={notification.type === "error" ? "alert" : "status"}
      className={`relative flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-xl border py-3 pl-4 pr-3 shadow-pop ${s.bg} ${s.border}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-xl`} />
      <Icon size={17} className={`flex-shrink-0 mt-0.5 ${s.icon}`} />
      <p className="flex-1 text-sm font-medium leading-snug text-ink">{notification.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dispatch(removeNotification(notification.id))}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition-colors hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const queue = useAppSelector((state) => state.notifications.queue);
  if (queue.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[60] flex flex-col gap-2" aria-live="polite">
      {queue.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}
