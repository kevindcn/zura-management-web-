import React, { useState, useMemo } from "react";
import { useNotificationStore, NotificationItem } from "../store/notifications";
import {
  CheckCheck,
  Bell,
  ExternalLink,
  Inbox,
  UserPlus,
  MessageSquare,
  ArrowRightLeft,
  Zap,
  Trash2,
  Loader2,
} from "lucide-react";
import { t } from "../lib/i18n";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenIssue?: (key: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

function getNotificationTypeIcon(type: string) {
  switch (type) {
    case "ASSIGNED":
      return <UserPlus size={11} className="text-blue-600 dark:text-blue-400" />;
    case "COMMENT":
      return <MessageSquare size={11} className="text-indigo-600 dark:text-indigo-400" />;
    case "STATUS_CHANGED":
      return <ArrowRightLeft size={11} className="text-emerald-600 dark:text-emerald-400" />;
    case "SPRINT":
      return <Zap size={11} className="text-amber-600 dark:text-amber-400" />;
    default:
      return <Bell size={11} className="text-jira-blue dark:text-blue-400" />;
  }
}

// Clean structural and noisy HTML tags while preserving rich formatting tags
function cleanNotificationRaw(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(div|p)[^>]*>\s*<br\s*\/?>\s*<\/\1>/gi, " ")
    .replace(/<\/?(div|p|pre|table|tbody|tr|td|ul|ol|li)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/"\s+"/g, '""')
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, '"');
}

// Convert DOM node to safe React elements supporting bold, colors, code, and mentions
function domNodeToReact(node: Node, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map((child, idx) =>
      domNodeToReact(child, `${key}-${idx}`)
    );

    // 1. Bold (<b>, <strong>)
    if (tagName === "b" || tagName === "strong") {
      return (
        <strong key={key} className="font-bold text-jira-text dark:text-jira-dark-text">
          {children}
        </strong>
      );
    }

    // 2. Italic (<i>, <em>)
    if (tagName === "i" || tagName === "em") {
      return (
        <em key={key} className="italic text-jira-text dark:text-jira-dark-text">
          {children}
        </em>
      );
    }

    // 3. Code (inline code and pre blocks)
    if (tagName === "code") {
      return (
        <code
          key={key}
          className="font-mono bg-slate-100 dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 dark:border-jira-dark-border inline-block mx-0.5 font-semibold"
        >
          {children}
        </code>
      );
    }

    // 4. Color / Span / Font
    if (tagName === "span" || tagName === "font") {
      const color = el.style.color || el.getAttribute("color") || "";
      const bg = el.style.backgroundColor || "";
      const isMention = el.className?.includes("bg-blue-50") || el.textContent?.trim().startsWith("@");

      if (isMention) {
        return (
          <span
            key={key}
            className="inline-flex items-center px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/50 text-jira-blue dark:text-blue-400 font-semibold text-[11px] border border-blue-200 dark:border-blue-900/50 mx-0.5"
          >
            {children}
          </span>
        );
      }

      const styleObj: React.CSSProperties = {};
      if (color && !color.includes("javascript:") && !color.includes("url(")) {
        styleObj.color = color;
      }
      if (bg && !bg.includes("javascript:") && !bg.includes("url(")) {
        styleObj.backgroundColor = bg;
      }

      return (
        <span key={key} style={styleObj} className="font-medium">
          {children}
        </span>
      );
    }

    // 5. Image replacement
    if (tagName === "img") {
      return (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 dark:bg-jira-dark-card rounded text-[10px] text-jira-subtle dark:text-jira-dark-subtle border border-slate-200 dark:border-jira-dark-border mx-0.5 font-medium"
        >
          📷 [Image]
        </span>
      );
    }

    // 6. Underline / Strike
    if (tagName === "u") {
      return (
        <span key={key} className="underline">
          {children}
        </span>
      );
    }
    if (tagName === "s" || tagName === "strike" || tagName === "del") {
      return (
        <span key={key} className="line-through text-slate-400 dark:text-slate-500">
          {children}
        </span>
      );
    }

    return <React.Fragment key={key}>{children}</React.Fragment>;
  }

  return null;
}

// Main Rich Notification Message Renderer
const NotificationMessageRenderer: React.FC<{ message: string }> = ({ message }) => {
  const content = useMemo(() => {
    if (!message) return null;

    // Normalize action text (translate common Indonesian notifications if needed)
    let normalized = message
      .replace(/^menambahkan komentar pada\s+/i, "added a comment on ")
      .replace(/^memindahkan\s+([A-Z0-9]+-\d+)\s+ke\s+/i, "moved $1 to ")
      .replace(/^menugaskan\s+([A-Z0-9]+-\d+)\s+'([^']+)'\s+kepada Anda/i, "assigned $1 '$2' to you")
      .replace(/^menugaskan\s+([A-Z0-9]+-\d+)\s+kepada Anda/i, "assigned $1 to you")
      .replace(/^memulai sprint\s+'([^']+)'\s+pada\s+([A-Z0-9]+)/i, "started sprint '$1' in $2")
      .replace(/telah menambahkan Anda ke project\s+'([^']+)'\s+\(([^)]+)\)\s+sebagai\s+([A-Z]+)\./i, "added you to project '$1' ($2) as $3.")
      .replace(/Peran Anda di project\s+'([^']+)'\s+\(([^)]+)\)\s+telah diubah menjadi\s+([A-Z]+)\s+oleh\s+([^.]+)\./i, "Your role in project '$1' ($2) was changed to $3 by $4.");

    const cleaned = cleanNotificationRaw(normalized);

    // If message contains HTML tags, parse them safely with DOMParser
    if (/<[a-z][\s\S]*>/i.test(cleaned) || cleaned.includes("&nbsp;")) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<body>${cleaned}</body>`, "text/html");
        return Array.from(doc.body.childNodes).map((node, i) =>
          domNodeToReact(node, `notif-${i}`)
        );
      } catch {
        // Fallback
      }
    }

    return cleaned;
  }, [message]);

  return <span className="inline">{content}</span>;
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  onOpenIssue,
}) => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) =>
    filter === "all" ? true : !n.isRead
  );

  const handleItemClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.issueKey && onOpenIssue) {
      onOpenIssue(notif.issueKey);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-dropdown border border-jira-border dark:border-jira-dark-border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3.5 border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between bg-slate-50/70 dark:bg-jira-dark-card">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-jira-blue dark:text-blue-400" />
          <h3 className="text-xs font-bold text-jira-text dark:text-jira-dark-text uppercase tracking-wider">
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
            className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline flex items-center gap-1 transition"
          >
            <CheckCheck size={13} />
            <span>{t.nav.markAllRead}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-jira-dark-border px-3 pt-2 gap-2 text-xs bg-white dark:bg-jira-dark-surface">
        <button
          onClick={() => setFilter("all")}
          className={`pb-2 px-1 font-semibold border-b-2 transition ${
            filter === "all"
              ? "border-jira-blue text-jira-blue dark:text-blue-400"
              : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
          }`}
        >
          {t.nav.allNotifications} ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`pb-2 px-1 font-semibold border-b-2 transition ${
            filter === "unread"
              ? "border-jira-blue text-jira-blue dark:text-blue-400"
              : "border-transparent text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
          }`}
        >
          {t.nav.unreadNotifications} ({unreadCount})
        </button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-jira-dark-border">
        {isLoading && notifications.length === 0 ? (
          <div className="p-6 text-center text-jira-subtle dark:text-jira-dark-subtle">
            <Loader2 size={20} className="animate-spin mx-auto text-jira-blue dark:text-blue-400 mb-2" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : filteredNotifs.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox size={28} className="mx-auto text-slate-300 dark:text-jira-dark-border mb-2" />
            <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle font-medium">
              {filter === "unread"
                ? "All notifications caught up!"
                : t.nav.noNotifications}
            </p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleItemClick(notif)}
              className={`p-3 flex items-start gap-3 cursor-pointer transition hover:bg-blue-50/40 dark:hover:bg-jira-dark-card relative group ${
                !notif.isRead ? "bg-blue-50/25 dark:bg-blue-950/20" : ""
              }`}
            >
              {/* Unread indicator dot */}
              {!notif.isRead && (
                <span className="w-2 h-2 rounded-full bg-jira-blue absolute left-1.5 top-4 shadow-xs" />
              )}

              {/* Avatar with type badge */}
              <div className="relative flex-shrink-0 mt-0.5 ml-1">
                <img
                  src={
                    notif.actorAvatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      notif.actorName
                    )}`
                  }
                  alt={notif.actorName}
                  className="w-7 h-7 rounded-full border border-slate-200 dark:border-jira-dark-border object-cover"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-jira-dark-surface rounded-full shadow-2xs border border-slate-200 dark:border-jira-dark-border flex items-center justify-center">
                  {getNotificationTypeIcon(notif.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-xs text-jira-text dark:text-jira-dark-text leading-snug">
                  <span className="font-bold">{notif.actorName}</span>{" "}
                  <NotificationMessageRenderer message={notif.message} />
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle font-medium">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                  {notif.issueKey && (
                    <span className="text-[10px] font-mono font-semibold text-jira-blue dark:text-blue-400 flex items-center gap-0.5 hover:underline">
                      {notif.issueKey}
                      <ExternalLink size={10} />
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNotification(notif.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 dark:text-jira-dark-subtle hover:text-red-500 dark:hover:text-red-400 rounded transition absolute right-2 top-3"
                title="Delete notification"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
