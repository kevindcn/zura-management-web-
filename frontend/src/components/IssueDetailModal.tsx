import React, { useState, useEffect } from "react";
import { Issue, Status, PriorityLevel, IssueType, User } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { ConfirmDialog } from "./ConfirmDialog";
import { DetailSkeleton } from "./Skeleton";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import {
  X,
  Trash2,
  Send,
  Clock,
  History,
  MessageSquare,
  Loader2,
  Check,
} from "lucide-react";

interface IssueDetailModalProps {
  issueKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  availableStatuses: Status[];
  projectMembers: User[];
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issueKey,
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
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Editable fields state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch full issue details
  useEffect(() => {
    if (!issueKey || !isOpen) return;

    let isMounted = true;
    setLoading(true);

    api.issues
      .get(issueKey)
      .then((res) => {
        if (isMounted) {
          setIssue(res.issue);
          setTitle(res.issue.title);
          setDescription(res.issue.description || "");
        }
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
  }, [issueKey, isOpen]);

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

  // Handle inline updates
  const handleUpdate = async (field: keyof Issue, value: any) => {
    if (!issue) return;
    try {
      setSavingField(field);
      const res = await api.issues.update(issue.key, { [field]: value });
      setIssue(res.issue);
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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !issue || submittingComment) return;

    try {
      setSubmittingComment(true);
      const res = await api.comments.add(issue.key, commentText.trim());
      setIssue({
        ...issue,
        comments: [res.comment, ...(issue.comments || [])],
        _count: { comments: (issue._count?.comments || 0) + 1 },
      });
      setCommentText("");
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
        className="bg-white rounded-lg shadow-jira-modal border border-jira-border w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top bar */}
        <div className="px-6 py-3.5 border-b border-jira-border flex items-center justify-between bg-white select-none">
          {/* Breadcrumb + Issue Key */}
          <div className="flex items-center gap-2">
            {issue && (
              <div className="flex items-center gap-2">
                <select
                  value={issue.type}
                  onChange={(e) =>
                    handleUpdate("type", e.target.value as IssueType)
                  }
                  className="bg-transparent border border-transparent hover:border-jira-border rounded p-1 text-xs font-semibold cursor-pointer outline-none transition"
                >
                  {issueTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span className="text-sm font-semibold text-jira-subtle uppercase tracking-tight">
                  {issue.key}
                </span>

                {savingField ? (
                  <span className="text-[11px] text-jira-subtle flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded ml-2">
                    <Loader2 size={11} className="animate-spin text-jira-blue" />
                    <span>{t.common.saving}</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium opacity-70 ml-2">
                    <Check size={11} />
                    <span>{t.common.saved}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="p-1.5 text-jira-subtle hover:text-red-600 hover:bg-red-50 rounded transition"
              title="Hapus work item"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-jira-subtle hover:text-jira-text hover:bg-slate-100 rounded transition"
              title="Tutup modal (Esc)"
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
            <div className="flex-1 overflow-y-auto p-6 border-r border-jira-border">
              {/* Editable Title */}
              <div className="mb-6">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  className="w-full text-xl font-bold text-jira-text hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-jira-blue rounded px-2 py-1 -ml-2 border border-transparent focus:border-jira-blue outline-none transition"
                />
              </div>

              {/* Description */}
              <div className="mb-8">
                <h4 className="text-xs font-bold uppercase text-jira-subtle mb-2">
                  Description
                </h4>
                {isEditingDesc ? (
                  <div>
                    <textarea
                      rows={5}
                      autoFocus
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a detailed description..."
                      className="w-full p-3 border border-jira-blue rounded text-sm text-jira-text outline-none focus:ring-1 focus:ring-jira-blue resize-y"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleSaveDescription}
                        className="px-3 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded shadow-sm transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setDescription(issue.description || "");
                          setIsEditingDesc(false);
                        }}
                        className="px-3 py-1.5 text-jira-subtle hover:text-jira-text text-xs font-semibold rounded transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingDesc(true)}
                    className="min-h-[60px] p-2.5 rounded hover:bg-slate-100/70 border border-transparent hover:border-jira-border text-sm text-jira-text cursor-pointer transition whitespace-pre-wrap"
                  >
                    {issue.description || (
                      <span className="text-jira-subtle italic">
                        Click to add a description...
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Section (Comments / History) */}
              <div>
                <div className="flex items-center justify-between border-b border-jira-border pb-2 mb-4">
                  <h4 className="text-xs font-bold uppercase text-jira-subtle">
                    Activity
                  </h4>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded">
                    <button
                      onClick={() => setActiveTab("comments")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        activeTab === "comments"
                          ? "bg-white text-jira-blue shadow-sm"
                          : "text-jira-subtle hover:text-jira-text"
                      }`}
                    >
                      <MessageSquare size={13} />
                      <span>Comments ({issue.comments?.length || 0})</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                        activeTab === "activity"
                          ? "bg-white text-jira-blue shadow-sm"
                          : "text-jira-subtle hover:text-jira-text"
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
                    <form onSubmit={handleAddComment} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-jira-blue text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
                        U
                      </div>
                      <div className="flex-1">
                        <textarea
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment... (Type to collaborate)"
                          className="w-full p-2.5 bg-slate-50 border border-jira-border rounded text-xs text-jira-text outline-none focus:bg-white focus:border-jira-blue transition resize-none"
                        />
                        {commentText.trim() && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="submit"
                              disabled={submittingComment}
                              className="px-3 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition"
                            >
                              <Send size={13} />
                              <span>Save comment</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-3 pt-2">
                      {issue.comments && issue.comments.length > 0 ? (
                        issue.comments.map((c) => (
                          <div
                            key={c.id}
                            className="flex gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded"
                          >
                            <img
                              src={
                                c.author.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  c.author.name
                                )}`
                              }
                              alt={c.author.name}
                              className="w-7 h-7 rounded-full border border-jira-border object-cover flex-shrink-0"
                            />
                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-jira-text">
                                  {c.author.name}
                                </span>
                                <span className="text-[10px] text-jira-subtle flex items-center gap-1">
                                  <Clock size={11} />
                                  {new Date(c.createdAt).toLocaleDateString()}{" "}
                                  {new Date(c.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className="text-xs text-jira-text whitespace-pre-wrap leading-relaxed">
                                {c.body}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-jira-subtle py-4 text-center">
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
                          className="flex items-start gap-2.5 py-1.5 text-xs text-jira-text"
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
                            <span className="text-jira-subtle">
                              {act.action === "CREATED"
                                ? "created this work item"
                                : act.action === "STATUS_CHANGED"
                                ? `moved status from "${act.oldValue}" to "${act.newValue}"`
                                : act.action === "COMMENTED"
                                ? "commented"
                                : `updated ${act.field || "details"}`}
                            </span>
                            <span className="text-[10px] text-jira-subtle ml-2">
                              {new Date(act.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-jira-subtle py-4 text-center">
                        No history records yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (1/3 width): Status, Assignee, Priority, Story Points */}
            <div className="w-full md:w-80 bg-slate-50/60 p-5 space-y-5 overflow-y-auto select-none">
              {/* Status Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle mb-1.5">
                  Status
                </label>
                <select
                  value={issue.statusId}
                  onChange={(e) => handleUpdate("statusId", e.target.value)}
                  className="w-full p-2 bg-white border border-jira-border rounded text-xs font-bold text-jira-text shadow-sm outline-none focus:border-jira-blue transition"
                >
                  {availableStatuses.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle mb-1.5">
                  Assignee
                </label>
                <select
                  value={issue.assigneeId || ""}
                  onChange={(e) =>
                    handleUpdate("assigneeId", e.target.value || null)
                  }
                  className="w-full p-2 bg-white border border-jira-border rounded text-xs text-jira-text shadow-sm outline-none focus:border-jira-blue transition"
                >
                  <option value="">Unassigned</option>
                  {projectMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle mb-1.5">
                  Priority
                </label>
                <select
                  value={issue.priority}
                  onChange={(e) =>
                    handleUpdate("priority", e.target.value as PriorityLevel)
                  }
                  className="w-full p-2 bg-white border border-jira-border rounded text-xs text-jira-text shadow-sm outline-none focus:border-jira-blue transition"
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Story Points */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-jira-subtle mb-1.5">
                  Story Points
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={issue.storyPoints ?? ""}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    handleUpdate("storyPoints", val);
                  }}
                  placeholder="None"
                  className="w-full p-2 bg-white border border-jira-border rounded text-xs text-jira-text shadow-sm outline-none focus:border-jira-blue transition"
                />
              </div>

              {/* Reporter */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-[11px] font-bold uppercase text-jira-subtle mb-1">
                  Reporter
                </label>
                <div className="flex items-center gap-2 text-xs text-jira-text">
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
              <div className="pt-2 border-t border-slate-200 text-[11px] text-jira-subtle space-y-1">
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
