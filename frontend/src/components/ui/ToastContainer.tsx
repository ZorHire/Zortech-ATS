import { useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { removeNotification } from "../../store/slices/notificationSlice";
import type { AppNotification } from "../../store/slices/notificationSlice";

const STYLES: Record<AppNotification["type"], { bar: string; icon: string; bg: string; border: string }> = {
  success: { bar: "bg-emerald-500", icon: "text-emerald-500", bg: "bg-white", border: "border-emerald-100" },
  error:   { bar: "bg-red-500",     icon: "text-red-500",     bg: "bg-white", border: "border-red-100"     },
  warning: { bar: "bg-amber-500",   icon: "text-amber-500",   bg: "bg-white", border: "border-amber-100"   },
  info:    { bar: "bg-blue-500",    icon: "text-blue-500",    bg: "bg-white", border: "border-blue-100"    },
};

const ICONS: Record<AppNotification["type"], React.ElementType> = {
  success: CheckCircle2,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const AUTO_DISMISS_MS = 4000;

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
      className={`relative flex items-start gap-3 w-80 rounded-xl border shadow-lg overflow-hidden pr-3 py-3 pl-4 ${s.bg} ${s.border}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar} rounded-l-xl`} />
      <Icon size={17} className={`flex-shrink-0 mt-0.5 ${s.icon}`} />
      <p className="flex-1 text-sm text-gray-800 font-medium leading-snug">{notification.message}</p>
      <button
        onClick={() => dispatch(removeNotification(notification.id))}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
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
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {queue.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}
