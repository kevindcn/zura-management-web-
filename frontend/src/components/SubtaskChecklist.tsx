import React, { useState } from "react";
import { Issue, Status } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { Plus, Check, Loader2, CornerDownRight } from "lucide-react";

interface SubtaskChecklistProps {
  parentIssue: Issue;
  subtasks: Issue[];
  projectKey: string;
  statuses: Status[];
  canEdit: boolean;
  onSubtaskCreated: (newSubtask: Issue) => void;
  onSubtaskUpdated: (updatedSubtask: Issue) => void;
  onOpenSubtask: (subtaskKey: string) => void;
}

export const SubtaskChecklist: React.FC<SubtaskChecklistProps> = ({
  parentIssue,
  subtasks,
  projectKey,
  statuses,
  canEdit,
  onSubtaskCreated,
  onSubtaskUpdated,
  onOpenSubtask,
}) => {
  const toast = useToastStore();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [togglingSubtaskId, setTogglingSubtaskId] = useState<string | null>(null);

  // Subtask cannot have subtasks
  if (parentIssue.type === "SUBTASK") {
    return null;
  }

  // Find DONE status and initial TO_DO status
  const doneStatus = statuses.find((s) => s.category === "DONE") || statuses[statuses.length - 1];
  const todoStatus = statuses.find((s) => s.category === "TO_DO") || statuses[0];

  const total = subtasks.length;
  const completed = subtasks.filter((s) => s.status?.category === "DONE").length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Toggle status between DONE and TO_DO
  const handleToggleStatus = async (subtask: Issue) => {
    if (!canEdit || !doneStatus || !todoStatus) return;

    const isCurrentlyDone = subtask.status?.category === "DONE";
    const targetStatus = isCurrentlyDone ? todoStatus : doneStatus;

    try {
      setTogglingSubtaskId(subtask.id);
      const res = await api.issues.update(subtask.key, {
        statusId: targetStatus.id,
      });

      onSubtaskUpdated(res.issue);
      toast.success(
        isCurrentlyDone
          ? `${subtask.key} marked as incomplete`
          : `${subtask.key} marked as completed!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update subtask status");
    } finally {
      setTogglingSubtaskId(null);
    }
  };

  // Submit new subtask
  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setSubmitting(true);
      const res = await api.issues.createSubtask(parentIssue.key, {
        title: title.trim(),
        statusId: todoStatus?.id,
      });

      onSubtaskCreated(res.subtask);
      setTitle("");
      setIsAdding(false);
      toast.success(`Subtask '${res.subtask.key}' added successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create subtask");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-jira-dark-border">
      {/* Header & Progress Bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle tracking-wider">
              Subtasks
            </span>
            {total > 0 && (
              <span className="text-[11px] font-bold text-jira-text dark:text-jira-dark-text bg-slate-100 dark:bg-jira-dark-card px-2 py-0.2 rounded-full border border-slate-200 dark:border-jira-dark-border">
                {completed} of {total} completed
              </span>
            )}
          </div>

          {canEdit && !isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:text-jira-blue-hover transition"
            >
              <Plus size={13} />
              <span>Add subtask</span>
            </button>
          )}
        </div>

        {/* Progress bar if subtasks exist */}
        {total > 0 && (
          <div className="w-full bg-slate-100 dark:bg-jira-dark-column rounded-full h-1.5 overflow-hidden flex">
            <div
              style={{ width: `${percentage}%` }}
              className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
            />
          </div>
        )}
      </div>

      {/* Subtasks List */}
      <div className="space-y-1">
        {subtasks.map((subtask) => {
          const isDone = subtask.status?.category === "DONE";
          const isToggling = togglingSubtaskId === subtask.id;

          return (
            <div
              key={subtask.id}
              className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50/70 dark:bg-jira-dark-card/60 hover:bg-slate-100/80 dark:hover:bg-jira-dark-card rounded border border-slate-200/60 dark:border-jira-dark-border transition text-xs ${
                isDone ? "opacity-80" : ""
              }`}
            >
              {/* Checkbox & Details */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!canEdit || isToggling}
                  onClick={() => handleToggleStatus(subtask)}
                  className={`flex-shrink-0 transition ${
                    canEdit ? "cursor-pointer" : "cursor-default"
                  }`}
                  title={isDone ? "Mark as incomplete" : "Mark as completed"}
                >
                  {isToggling ? (
                    <Loader2 size={15} className="animate-spin text-jira-blue" />
                  ) : isDone ? (
                    <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded border-2 border-slate-300 dark:border-jira-dark-border hover:border-jira-blue bg-white dark:bg-jira-dark-surface transition" />
                  )}
                </button>

                <div className="flex-shrink-0">
                  <IssueTypeIcon type="SUBTASK" size={13} />
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSubtask(subtask.key)}
                  className="font-mono text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 transition flex-shrink-0"
                >
                  {subtask.key}
                </button>

                <span
                  onClick={() => onOpenSubtask(subtask.key)}
                  className={`truncate font-medium text-jira-text dark:text-jira-dark-text cursor-pointer hover:text-jira-blue dark:hover:text-blue-400 transition ${
                    isDone ? "line-through text-slate-400 dark:text-jira-dark-subtle" : ""
                  }`}
                >
                  {subtask.title}
                </span>
              </div>

              {/* Status Lozenge & Assignee */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {subtask.assignee && (
                  <img
                    src={
                      subtask.assignee.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        subtask.assignee.name
                      )}`
                    }
                    alt={subtask.assignee.name}
                    title={subtask.assignee.name}
                    className="w-4 h-4 rounded-full object-cover border border-slate-200 dark:border-jira-dark-border"
                  />
                )}

                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider border ${
                    isDone
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-jira-dark-column text-slate-600 dark:text-jira-dark-subtle border-slate-200 dark:border-jira-dark-border"
                  }`}
                >
                  {subtask.status?.name || "To Do"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline Create Input */}
      {isAdding && (
        <form onSubmit={handleCreateSubtask} className="pt-1">
          <div className="p-2.5 bg-slate-50 dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <CornerDownRight size={14} className="text-jira-blue dark:text-blue-400 flex-shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setTitle("");
                  }
                }}
                placeholder="What needs to be done? (Press Enter to save)"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-xs text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setTitle("");
                }}
                disabled={submitting}
                className="px-2.5 py-1 text-xs font-semibold text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card rounded transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="px-3 py-1 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded transition shadow-sm flex items-center gap-1 disabled:opacity-50"
              >
                {submitting && <Loader2 size={12} className="animate-spin" />}
                <span>Add</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {total === 0 && !isAdding && (
        <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle italic">
          No subtasks yet. Add subtasks to break down this work into smaller steps.
        </p>
      )}
    </div>
  );
};
