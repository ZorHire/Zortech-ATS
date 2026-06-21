import React, { useRef, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "../../store/api/notificationsApi";
import type { NotificationItem } from "../../store/api/notificationsApi";

const TYPE_STYLES: Record<
  NotificationItem["type"],
  { icon: React.ReactNode; bar: string; iconColor: string }
> = {
  info: {
    icon: <Info size={13} />,
    bar: "bg-blue-500",
    iconColor: "text-blue-500",
  },
  success: {
    icon: <CheckCircle2 size={13} />,
    bar: "bg-emerald-500",
    iconColor: "text-emerald-500",
  },
  warning: {
    icon: <AlertTriangle size={13} />,
    bar: "bg-amber-500",
    iconColor: "text-amber-500",
  },
  error: {
    icon: <XCircle size={13} />,
    bar: "bg-red-500",
    iconColor: "text-red-500",
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

  const { data: notifications = [], isLoading } = useGetNotificationsQuery(
    undefined,
    { pollingInterval: 30_000 },
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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
              >
                <CheckCheck size={11} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && handleMarkRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      isUnread ? "bg-blue-50/40 hover:bg-blue-50/70" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`mt-0.5 flex-shrink-0 ${style.iconColor}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${isUnread ? "font-semibold text-gray-900" : "font-medium text-gray-600"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {isUnread && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
