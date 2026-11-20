import React, { useRef, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "../../store/api/notificationsApi";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectServerUnreachable } from "../../store/slices/connectionSlice";
import type { NotificationItem } from "../../store/api/notificationsApi";

const TYPE_STYLES: Record<
  NotificationItem["type"],
  { icon: React.ReactNode; bar: string; iconColor: string }
> = {
  info: {
    icon: <Info size={13} />,
    bar: "bg-blue-500",
    iconColor: "text-navy-500",
  },
  success: {
    icon: <CheckCircle2 size={13} />,
    bar: "bg-emerald-500",
    iconColor: "text-success-600",
  },
  warning: {
    icon: <AlertTriangle size={13} />,
    bar: "bg-amber-500",
    iconColor: "text-warning-600",
  },
  error: {
    icon: <XCircle size={13} />,
    bar: "bg-red-500",
    iconColor: "text-danger-600",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Don't keep polling a server that is down; resume once it's reachable.
  const serverDown = useAppSelector(selectServerUnreachable);
  const { data: notifications = [], isLoading } = useGetNotificationsQuery(
    undefined,
    { pollingInterval: serverDown ? 0 : 30_000 },
  );
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleMarkRead = (id: string) => {
    markRead(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-800">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:text-navy-800"
              >
                <CheckCheck size={13} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-muted" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto mb-2 text-line-strong" aria-hidden="true" />
                <p className="text-sm text-muted">You're all caught up</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
                const isUnread = !n.read_at;
                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => isUnread && handleMarkRead(n.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isUnread ? "bg-navy-50/60 hover:bg-navy-50" : "hover:bg-surface"
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${style.iconColor}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-ink" : "text-ink-soft"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                      )}
                      <p className="mt-1 text-xs text-muted/80">{timeAgo(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
