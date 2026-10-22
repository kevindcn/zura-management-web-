import React, { useState } from "react";
import { useNotificationStore, NotificationItem } from "../store/notifications";
import { CheckCheck, Bell, ExternalLink, Inbox } from "lucide-react";
import { t } from "../lib/i18n";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenIssue?: (key: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onOpenIssue,
}) => {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) =>
    filter === "all" ? true : !n.isRead
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = (notif: NotificationItem) => {
    markAsRead(notif.id);
    if (notif.issueKey && onOpenIssue) {
      onOpenIssue(notif.issueKey);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-jira-dropdown border border-jira-border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3.5 border-b border-jira-border flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-jira-blue" />
          <h3 className="text-xs font-bold text-jira-text uppercase tracking-wider">
            {t.nav.notifications}
          </h3>
          {unreadCount > 0 && (
            <span className="bg-jira-blue text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-[11px] font-semibold text-jira-blue hover:underline flex items-center gap-1"
          >
            <CheckCheck size={13} />
            <span>{t.nav.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-3 pt-2 gap-2 text-xs">
        <button
          onClick={() => setFilter("all")}
          className={`pb-2 px-1 font-semibold border-b-2 transition ${
            filter === "all"
              ? "border-jira-blue text-jira-blue"
              : "border-transparent text-jira-subtle hover:text-jira-text"
          }`}
        >
          {t.nav.allNotifications} ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`pb-2 px-1 font-semibold border-b-2 transition ${
            filter === "unread"
              ? "border-jira-blue text-jira-blue"
              : "border-transparent text-jira-subtle hover:text-jira-text"
          }`}
        >
          {t.nav.unreadNotifications} ({unreadCount})
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
        {filteredNotifs.length === 0 ? (
          <div className="p-6 text-center">
            <Inbox size={26} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-jira-subtle font-medium">
              {t.nav.noNotifications}
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`p-3 flex items-start gap-3 cursor-pointer transition hover:bg-blue-50/40 relative ${
                !notif.isRead ? "bg-blue-50/20" : ""
              }`}
            >
              {/* Unread dot */}
              {!notif.isRead && (
                <span className="w-2 h-2 rounded-full bg-jira-blue absolute left-1.5 top-4" />
              )}

              {/* Avatar */}
              <img
                src={
                  notif.actorAvatar ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    notif.actorName
                  )}`
                }
                alt={notif.actorName}
                className="w-7 h-7 rounded-full border border-slate-200 object-cover flex-shrink-0 mt-0.5 ml-1"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-jira-text leading-snug">
                  <span className="font-bold">{notif.actorName}</span>{" "}
                  {notif.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-jira-subtle font-medium">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                  {notif.issueKey && (
                    <span className="text-[10px] font-mono font-semibold text-jira-blue flex items-center gap-0.5 hover:underline">
                      {notif.issueKey}
                      <ExternalLink size={10} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
