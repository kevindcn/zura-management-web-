import React, { useState, useEffect, useRef, useMemo } from "react";
import { Issue, Status, PriorityLevel, IssueType, User } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { DetailSkeleton } from "./Skeleton";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import { useAuthStore } from "../store/auth";
import { usePermission } from "../lib/permissions";
import {
  X,
  Trash2,
  Send,
  Clock,
  History,
  MessageSquare,
  Loader2,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToastStore } from "../store/toast";
import { SubtaskChecklist } from "./SubtaskChecklist";
import { LabelSelector } from "./LabelSelector";
import { DatePickerField } from "./DatePickerField";
import {
  PrioritySelect,
  AssigneeSelect,
  StatusSelect,
  IssueTypeSelect,
} from "./CustomSelect";
import { RichDescriptionEditor, sanitizeHtml, normalizeToHtml } from "./RichDescriptionEditor";

interface IssueDetailModalProps {
  issueKey: string | null;
  initialIssue?: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  availableStatuses: Status[];
  projectMembers: User[];
}

interface MemoizedCommentProps {
  comment: {
    id: string;
    body: string;
    createdAt: string;
    author: {
      name: string;
      avatarUrl?: string | null;
    };
  };
}

const MemoizedCommentItem = React.memo<MemoizedCommentProps>(({ comment }) => {
  const formattedHtml = useMemo(
    () => sanitizeHtml(normalizeToHtml(comment.body)),
    [comment.body]
  );

  const formattedDate = useMemo(() => {
    try {
      const d = new Date(comment.createdAt);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return "";
    }
  }, [comment.createdAt]);

  return (
    <div className="flex gap-3 p-3 bg-slate-50/50 dark:bg-jira-dark-card/60 border border-slate-100 dark:border-jira-dark-border rounded">
      <img
        src={
          comment.author.avatarUrl ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            comment.author.name
          )}`
        }
        alt={comment.author.name}
        className="w-7 h-7 rounded-full border border-jira-border dark:border-jira-dark-border object-cover flex-shrink-0"
        loading="lazy"
        decoding="async"
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-jira-text dark:text-jira-dark-text">
            {comment.author.name}
          </span>
          <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle flex items-center gap-1">
            <Clock size={11} />
            {formattedDate}
          </span>
        </div>
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-xs text-jira-text dark:text-jira-dark-text leading-relaxed break-words comment-rich-content"
          dangerouslySetInnerHTML={{
            __html: formattedHtml,
          }}
        />
      </div>
    </div>
  );
});

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issueKey,
  initialIssue,
  isOpen,
  onClose,
  onIssueUpdated,
  onIssueDeleted,
  availableStatuses,
  projectMembers,
}) => {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "activity">("comments");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Editable fields state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [watcherCount, setWatcherCount] = useState(0);
  const [isWatchLoading, setIsWatchLoading] = useState(false);

  // Stable references for polling to eliminate re-rendering & timer thrashing
  const issueRef = useRef<Issue | null>(issue);
  useEffect(() => {
    issueRef.current = issue;
  }, [issue]);

  const onIssueUpdatedRef = useRef(onIssueUpdated);
  useEffect(() => {
    onIssueUpdatedRef.current = onIssueUpdated;
  }, [onIssueUpdated]);

  const isEditingDescRef = useRef(isEditingDesc);
  useEffect(() => {
    isEditingDescRef.current = isEditingDesc;
  }, [isEditingDesc]);

  const toast = useToastStore();

  const { user } = useAuthStore();
  const { isAllowed: canEditIssue, isViewer, isAdmin, isMember } = usePermission("issue:edit");
  const { isAllowed: canComment } = usePermission("comment:create");

  const canDeleteIssue = isAdmin || (isMember && !!issue?.reporterId && issue.reporterId === user?.id);

  // Lock background scroll when modal is active to prevent page jumping
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Initial issue load & sync (Zero latency when initialIssue is provided)
  useEffect(() => {
    if (!issueKey || !isOpen) {
      setIssue(null);
      setTitle("");
      setDescription("");
      setIsEditingDesc(false);
      return;
    }

    let isMounted = true;

    if (initialIssue && initialIssue.key === issueKey) {
      // INSTANT RENDER: populate state immediately, 0ms latency, zero skeleton flash!
      setIssue(initialIssue);
      setTitle(initialIssue.title);
      setDescription(initialIssue.description || "");
      setIsWatching(initialIssue.isWatching || false);
      setWatcherCount(initialIssue.watcherCount || (initialIssue as any)._count?.watchers || 0);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Always fetch full details & relations (comments, activities, subtasks, watchers)
    api.issues
      .get(issueKey)
      .then((res) => {
        if (!isMounted) return;
        setIssue((prev) => ({
          ...(prev || {}),
          ...res.issue,
          comments: res.issue.comments || prev?.comments || [],
          activities: res.issue.activities || prev?.activities || [],
          watchers: res.issue.watchers || prev?.watchers || [],
          children: res.issue.children || prev?.children || [],
        }));
        setTitle((prevTitle) => (prevTitle ? prevTitle : res.issue.title));
        setDescription((prevDesc) => (prevDesc ? prevDesc : res.issue.description || ""));
        setIsWatching(res.issue.isWatching || false);
        setWatcherCount(res.issue.watcherCount || 0);
      })
      .catch((err) => {
        console.error("Failed to load issue:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [issueKey, isOpen, initialIssue?.id]);

  // Realtime Polling: silently poll issue every 3s without re-render glitching
  useEffect(() => {
    if (!isOpen || !issueKey) return;

    let isSubscribed = true;

    const interval = setInterval(async () => {
      try {
        const res = await api.issues.get(issueKey);
        if (!isSubscribed) return;

        const prev = issueRef.current;
        if (!prev) return;

        // Accurate timestamp comparison avoids ISO timezone differences
        const prevStart = prev.startDate ? new Date(prev.startDate).getTime() : null;
        const nextStart = res.issue.startDate ? new Date(res.issue.startDate).getTime() : null;
        const startDateChanged = prevStart !== nextStart;

        const prevDue = prev.dueDate ? new Date(prev.dueDate).getTime() : null;
        const nextDue = res.issue.dueDate ? new Date(res.issue.dueDate).getTime() : null;
        const dueDateChanged = prevDue !== nextDue;

        const prevCommentsSig = (prev.comments || []).map((c) => `${c.id}:${c.updatedAt || c.createdAt}`).join(",");
        const nextCommentsSig = (res.issue.comments || []).map((c) => `${c.id}:${c.updatedAt || c.createdAt}`).join(",");
        const commentsChanged = prevCommentsSig !== nextCommentsSig;

        const prevActivitiesSig = (prev.activities || []).map((a) => a.id).join(",");
        const nextActivitiesSig = (res.issue.activities || []).map((a) => a.id).join(",");
        const activitiesChanged = prevActivitiesSig !== nextActivitiesSig;

        const statusChanged = prev.statusId !== res.issue.statusId;
        const priorityChanged = prev.priority !== res.issue.priority;
        const assigneeChanged = prev.assigneeId !== res.issue.assigneeId;
        const pointsChanged = prev.storyPoints !== res.issue.storyPoints;
        const typeChanged = prev.type !== res.issue.type;

        const prevLabels = (prev.labels || []).map((l) => l.name).sort().join(",");
        const nextLabels = (res.issue.labels || []).map((l) => l.name).sort().join(",");
        const labelsChanged = prevLabels !== nextLabels;

        const watchersChanged = (prev.watcherCount ?? 0) !== (res.issue.watcherCount ?? 0);

        const prevSubtasks = (prev.children || []).map((c) => `${c.id}:${c.statusId}:${c.title}`).join(",");
        const nextSubtasks = (res.issue.children || []).map((c) => `${c.id}:${c.statusId}:${c.title}`).join(",");
        const subtasksChanged = prevSubtasks !== nextSubtasks;

        const titleChanged = prev.title !== res.issue.title;
        const descChanged = prev.description !== res.issue.description;

        if (
          commentsChanged ||
          activitiesChanged ||
          statusChanged ||
          priorityChanged ||
          assigneeChanged ||
          startDateChanged ||
          dueDateChanged ||
          pointsChanged ||
          typeChanged ||
          labelsChanged ||
          watchersChanged ||
          subtasksChanged ||
          titleChanged ||
          descChanged
        ) {
          setIssue(res.issue);
          onIssueUpdatedRef.current?.(res.issue);

          if (!isEditingDescRef.current && descChanged) {
            setDescription(res.issue.description || "");
          }

          if (document.activeElement?.tagName !== "INPUT" && titleChanged) {
            setTitle(res.issue.title);
          }

          setIsWatching(res.issue.isWatching || false);
          setWatcherCount(res.issue.watcherCount || 0);
        }
      } catch (err) {
        // Silently swallow background polling errors
      }
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [isOpen, issueKey]);

  // Smooth navigation to parent or subtask without full skeleton flicker
  const handleNavigateIssue = async (targetKey: string) => {
    try {
      setSavingField("navigating");
      const res = await api.issues.get(targetKey);
      setIssue(res.issue);
      setTitle(res.issue.title);
      setDescription(res.issue.description || "");
      setIsWatching(res.issue.isWatching || false);
      setWatcherCount(res.issue.watcherCount || 0);
      onIssueUpdatedRef.current?.(res.issue);
    } catch (err) {
      console.error("Failed to navigate to issue:", err);
      toast.error("Failed to load target work item");
    } finally {
      setSavingField(null);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !issueKey) return null;

  // Toggle watching issue
  const handleToggleWatch = async () => {
    if (!issue) return;
    try {
      setIsWatchLoading(true);
      const res = await api.issues.watch(issue.key);
      setIsWatching(res.isWatching);
      setWatcherCount(res.watcherCount);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Failed to update watcher status.");
    } finally {
      setIsWatchLoading(false);
    }
  };

  // Handle inline updates with safe state preservation
  const handleUpdate = async (field: keyof Issue, value: any) => {
    if (!issue) return;
    try {
      setSavingField(field);
      const res = await api.issues.update(issue.key, { [field]: value });
      setIssue((prev) => {
        if (!prev) return res.issue;
        return {
          ...prev,
          ...res.issue,
          comments: res.issue.comments ?? prev.comments,
          activities: res.issue.activities ?? prev.activities,
          watchers: res.issue.watchers ?? prev.watchers,
          isWatching: res.issue.isWatching ?? prev.isWatching,
          watcherCount: res.issue.watcherCount ?? prev.watcherCount,
        };
      });
      onIssueUpdated(res.issue);
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    } finally {
      setSavingField(null);
    }
  };

  const handleTitleBlur = () => {
    if (issue && title.trim() && title !== issue.title) {
      handleUpdate("title", title.trim());
    }
  };

  const handleSaveDescription = async () => {
    if (!issue) return;
    await handleUpdate("description", description.trim() || null);
    setIsEditingDesc(false);
  };

  const handleAddComment = async (commentHtml: string) => {
    const trimmed = (commentHtml || "").trim();
    const hasContent =
      trimmed.replace(/<[^>]*>/g, "").trim().length > 0 || /<img\b[^>]*>/i.test(trimmed);

    if (!hasContent || !issue || submittingComment) return;

    try {
      setSubmittingComment(true);
      const res = await api.comments.add(issue.key, trimmed);
      const updatedIssue = {
        ...issue,
        comments: [res.comment, ...(issue.comments || [])],
        _count: { comments: (issue._count?.comments || 0) + 1 },
      };
      setIssue(updatedIssue);
      onIssueUpdated(updatedIssue);
      setIsAddingComment(false);
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue) return;
    try {
      setIsDeleting(true);
      await api.issues.delete(issue.key);
      setIsConfirmDeleteOpen(false);
      onIssueDeleted(issue.key);
      onClose();
    } catch (err) {
      console.error("Failed to delete issue:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const issueTypes: IssueType[] = ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"];
  const priorities: PriorityLevel[] = [
    "HIGHEST",
    "HIGH",
    "MEDIUM",
    "LOW",
    "LOWEST",
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-3 lg:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-modal border border-jira-border dark:border-jira-dark-border w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top bar */}
        <div className="px-6 py-3.5 border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between bg-white dark:bg-jira-dark-surface select-none">
          {/* Breadcrumb + Issue Key */}
          <div className="flex items-center gap-2">
            {issue && (
              <div className="flex items-center gap-2">
                <IssueTypeSelect
                  value={issue.type}
                  disabled={!canEditIssue}
                  variant="ghost"
                  onChange={(val) => handleUpdate("type", val)}
                />
                {issue.parent && (
                  <button
                    type="button"
                    onClick={() => handleNavigateIssue(issue.parent!.key)}
                    className="text-xs text-jira-blue hover:underline flex items-center gap-1 font-semibold mr-1"
                    title={`Parent: ${issue.parent.title}`}
                  >
                    <ChevronLeft size={13} />
                    <span>{issue.parent.key}</span>
                    <span>/</span>
                  </button>
                )}
                <span className="text-sm font-semibold text-jira-subtle dark:text-jira-dark-subtle uppercase tracking-tight">
                  {issue.key}
                </span>

                {savingField ? (
                  <span className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle flex items-center gap-1 font-medium bg-slate-100 dark:bg-jira-dark-card px-2 py-0.5 rounded ml-2">
                    <Loader2 size={11} className="animate-spin text-jira-blue" />
                    <span>{t.common.saving}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium opacity-70 ml-2">
                    <Check size={11} />
                    <span>{t.common.saved}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Watcher / Follower Button */}
            {issue && (
              <button
                type="button"
                onClick={handleToggleWatch}
                disabled={isWatchLoading}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition border shadow-sm ${
                  isWatching
                    ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/60"
                    : "bg-white dark:bg-jira-dark-card text-gray-700 dark:text-jira-dark-text border-gray-200 dark:border-jira-dark-border hover:bg-gray-50 dark:hover:bg-jira-dark-column"
                }`}
                title={
                  isWatching
                    ? "You are watching this work item. Click to stop watching."
                    : "Watch this work item to receive notifications for updates or comments"
                }
              >
                {isWatchLoading ? (
                  <Loader2 size={13} className="animate-spin text-jira-blue" />
                ) : isWatching ? (
                  <Eye size={13} className="text-jira-blue dark:text-blue-400" />
                ) : (
                  <EyeOff size={13} className="text-gray-400 dark:text-jira-dark-subtle" />
                )}
                <span>{isWatching ? "Watching" : "Watch"}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold tabular-nums leading-none ${
                    isWatching ? "bg-blue-200/70 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200" : "bg-gray-100 dark:bg-jira-dark-surface text-gray-600 dark:text-jira-dark-subtle"
                  }`}
                >
                  {watcherCount}
                </span>
              </button>
            )}

            <button
              disabled={!canDeleteIssue}
              onClick={() => canDeleteIssue && setIsConfirmDeleteOpen(true)}
              className={`p-1.5 rounded transition ${
                canDeleteIssue
                  ? "text-jira-subtle dark:text-jira-dark-subtle hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  : "text-slate-300 dark:text-jira-dark-border cursor-not-allowed opacity-50"
              }`}
              title={
                canDeleteIssue
                  ? "Delete work item"
                  : isViewer
                  ? "Viewer role cannot delete work items"
                  : "You can only delete work items you created"
              }
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded transition"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Main Content */}
        {loading || !issue ? (
          <div className="flex-1 overflow-y-auto">
            <DetailSkeleton />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column (2/3 width): Title, Description, Activity */}
            <div className="flex-1 overflow-y-auto p-6 border-r border-jira-border dark:border-jira-dark-border">
              {/* Editable Title */}
              <div className="mb-6">
                <input
                  type="text"
                  value={title}
                  disabled={!canEditIssue}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  title={!canEditIssue ? "Viewer role cannot edit title" : undefined}
                  className={`w-full text-xl font-bold text-jira-text dark:text-jira-dark-text rounded px-2 py-1 -ml-2 border border-transparent outline-none transition bg-transparent dark:bg-transparent ${
                    canEditIssue
                      ? "hover:bg-slate-100/70 dark:hover:bg-jira-dark-card/60 focus:bg-white dark:focus:bg-jira-dark-surface focus:ring-2 focus:ring-jira-blue dark:focus:ring-blue-500 focus:border-jira-blue cursor-text"
                      : "cursor-not-allowed opacity-80"
                  }`}
                />
              </div>

              {/* Description */}
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-jira-dark-text mb-2">
                  Description
                </h4>
                <RichDescriptionEditor
                  value={description}
                  onSave={async (newDesc) => {
                    setDescription(newDesc);
                    if (issue) {
                      await handleUpdate("description", newDesc.trim() || null);
                    }
                  }}
                  onCancel={() => {
                    setDescription(issue?.description || "");
                  }}
                  isEditing={isEditingDesc}
                  setIsEditing={setIsEditingDesc}
                  canEdit={canEditIssue}
                  projectMembers={projectMembers}
                  placeholder="Type @ to mention and notify someone."
                />
              </div>

              {/* Subtasks Checklist */}
              <div className="mb-8">
                <SubtaskChecklist
                  parentIssue={issue}
                  subtasks={issue.children || []}
                  projectKey={issue.project?.key || issue.key.split("-")[0]}
                  statuses={availableStatuses}
                  canEdit={canEditIssue}
                  onSubtaskCreated={(newSubtask) => {
                    const updated = {
                      ...issue,
                      children: [...(issue.children || []), newSubtask],
                    };
                    setIssue(updated);
                    onIssueUpdated(updated);
                  }}
                  onSubtaskUpdated={(updatedSubtask) => {
                    const updated = {
                      ...issue,
                      children: (issue.children || []).map((c) =>
                        c.id === updatedSubtask.id ? updatedSubtask : c
                      ),
                    };
                    setIssue(updated);
                    onIssueUpdated(updated);
                  }}
                  onOpenSubtask={(subtaskKey) => handleNavigateIssue(subtaskKey)}
                />
              </div>

              {/* Activity Section (Comments / History) */}
              <div>
                <div className="flex items-center justify-between border-b border-jira-border dark:border-jira-dark-border pb-2 mb-4">
                  <h4 className="text-xs font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle">
                    Activity
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-jira-dark-column p-0.5 rounded">
                    <button
                      onClick={() => setActiveTab("comments")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        activeTab === "comments"
                          ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 shadow-sm"
                          : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
                      }`}
                    >
                      <MessageSquare size={13} />
                      <span>Comments ({issue.comments?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        activeTab === "activity"
                          ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 shadow-sm"
                          : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
                      }`}
                    >
                      <History size={13} />
                      <span>History ({issue.activities?.length || 0})</span>
                    </button>
                  </div>
                </div>

                {/* Tab: Comments */}
                {activeTab === "comments" && (
                  <div className="space-y-4">
                    {/* Add Comment Input */}
                    {canComment ? (
                      <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-jira-blue text-white flex-shrink-0 flex items-center justify-center font-bold text-xs mt-0.5">
                          {user?.name ? user.name[0].toUpperCase() : "U"}
                        </div>
                        <div className="flex-1">
                          <RichDescriptionEditor
                            mode="comment"
                            value=""
                            placeholder="Add a comment... (Type to collaborate)"
                            isEditing={isAddingComment}
                            setIsEditing={setIsAddingComment}
                            canEdit={canComment}
                            projectMembers={projectMembers}
                            onSave={handleAddComment}
                            saveButtonText="Save"
                            clearOnSave={true}
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="p-3 bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded text-xs text-jira-subtle dark:text-jira-dark-subtle italic select-none"
                        title="Viewer role cannot write comments"
                      >
                        You have the Viewer role (read-only) and cannot post comments.
                      </div>
                    )}

                    {/* Comments List */}
                    <div className="space-y-3 pt-2">
                      {issue.comments && issue.comments.length > 0 ? (
                        issue.comments.map((c) => (
                          <MemoizedCommentItem key={c.id} comment={c} />
                        ))
                      ) : (
                        <div className="text-xs text-jira-subtle dark:text-jira-dark-subtle py-4 text-center">
                          No comments yet. Start the conversation!
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: History / Audit Log */}
                {activeTab === "activity" && (
                  <div className="space-y-2 pt-1">
                    {issue.activities && issue.activities.length > 0 ? (
                      issue.activities.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-2.5 py-1.5 text-xs text-jira-text dark:text-jira-dark-text"
                        >
                          <img
                            src={
                              act.user?.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                act.user?.name || "System"
                              )}`
                            }
                            alt=""
                            className="w-5 h-5 rounded-full mt-0.5"
                          />
                          <div>
                            <span className="font-semibold">{act.user?.name || "User"}</span>{" "}
                            <span className="text-jira-subtle dark:text-jira-dark-subtle">
                              {act.action === "CREATED"
                                ? "created this work item"
                                : act.action === "STATUS_CHANGED"
                                ? `moved status from "${act.oldValue}" to "${act.newValue}"`
                                : act.action === "COMMENTED"
                                ? "commented"
                                : `updated ${act.field || "details"}`}
                            </span>
                            <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle ml-2">
                              {new Date(act.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-jira-subtle dark:text-jira-dark-subtle py-4 text-center">
                        No history records yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (1/3 width): Status, Assignee, Priority, Story Points */}
            <div className="w-full md:w-80 bg-slate-50/60 dark:bg-jira-dark-column p-5 space-y-5 overflow-y-auto select-none border-t md:border-t-0 border-jira-border dark:border-jira-dark-border">
              {/* Status Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Status
                </label>
                <StatusSelect
                  value={issue.statusId}
                  statuses={availableStatuses}
                  disabled={!canEditIssue}
                  onChange={(val) => handleUpdate("statusId", val)}
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Assignee
                </label>
                <AssigneeSelect
                  value={issue.assigneeId}
                  members={projectMembers}
                  disabled={!canEditIssue}
                  onChange={(val) => handleUpdate("assigneeId", val)}
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Priority
                </label>
                <PrioritySelect
                  value={issue.priority}
                  disabled={!canEditIssue}
                  onChange={(val) => handleUpdate("priority", val)}
                />
              </div>

              {/* Story Points */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Story Points
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={issue.storyPoints ?? ""}
                  disabled={!canEditIssue}
                  title={!canEditIssue ? "Viewer role cannot edit story points" : undefined}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    handleUpdate("storyPoints", val);
                  }}
                  placeholder="None"
                  className={`w-full p-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-xs text-jira-text dark:text-jira-dark-text shadow-sm outline-none transition ${
                    canEditIssue
                      ? "focus:border-jira-blue cursor-text"
                      : "cursor-not-allowed opacity-80"
                  }`}
                />
              </div>

              {/* Start Date */}
              <DatePickerField
                label="Start Date"
                value={issue.startDate}
                disabled={!canEditIssue}
                placeholder="Add date"
                onChange={(val) => handleUpdate("startDate", val)}
              />

              {/* Due Date */}
              <DatePickerField
                label="Due Date"
                value={issue.dueDate}
                disabled={!canEditIssue}
                placeholder="Add date"
                onChange={(val) => handleUpdate("dueDate", val)}
              />

              {/* Labels */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Labels
                </label>
                <LabelSelector
                  labels={issue.labels || []}
                  projectKey={issue.project?.key || issue.key.split("-")[0]}
                  canEdit={canEditIssue}
                  onChange={(newLabelNames) => handleUpdate("labels", newLabelNames)}
                />
              </div>

              {/* Reporter */}
              <div className="pt-2 border-t border-slate-200 dark:border-jira-dark-border">
                <label className="block text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle mb-1">
                  Reporter
                </label>
                <div className="flex items-center gap-2 text-xs text-jira-text dark:text-jira-dark-text">
                  <img
                    src={
                      issue.reporter?.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        issue.reporter?.name || "Reporter"
                      )}`
                    }
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                  <span>{issue.reporter?.name || "Reporter"}</span>
                </div>
              </div>

              {/* Dates */}
              <div className="pt-2 border-t border-slate-200 dark:border-jira-dark-border text-[11px] text-jira-subtle dark:text-jira-dark-subtle space-y-1">
                <div>
                  Created: {new Date(issue.createdAt).toLocaleDateString()}
                </div>
                <div>
                  Updated: {new Date(issue.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title={t.dialog.deleteIssueTitle}
        description={t.dialog.deleteIssueDesc(issue?.key || "")}
        confirmLabel={t.dialog.deleteConfirmButton}
        isLoading={isDeleting}
        onConfirm={handleDeleteIssue}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
};
