import React, { useState, useEffect } from "react";
import { Project, IssueType, PriorityLevel } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { t } from "../lib/i18n";
import { X, Loader2 } from "lucide-react";
import { DatePickerField } from "./DatePickerField";
import {
  PrioritySelect,
  AssigneeSelect,
  StatusSelect,
  IssueTypeSelect,
} from "./CustomSelect";

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onIssueCreated: () => void;
  onSubmitCreate: (data: {
    title: string;
    description?: string;
    type: IssueType;
    priority: PriorityLevel;
    storyPoints?: number;
    statusId?: string;
    assigneeId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
  }) => Promise<void>;
  initialType?: IssueType;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  project,
  onIssueCreated,
  onSubmitCreate,
  initialType,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>(initialType || "TASK");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");

  useEffect(() => {
    if (isOpen) {
      if (initialType) setType(initialType);
    }
  }, [isOpen, initialType]);
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [statusId, setStatusId] = useState<string>(
    project.statuses[0]?.id || ""
  );
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = getProjectTheme(project.key);
  const initials = getProjectInitials(project.name, project.key);

  // Close modal on Escape key
  React.useEffect(() => {
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul item tidak boleh kosong");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmitCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        storyPoints: storyPoints ? parseInt(storyPoints, 10) : undefined,
        statusId: statusId || undefined,
        assigneeId: assigneeId ? assigneeId : null,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      });
      setTitle("");
      setDescription("");
      setStoryPoints("");
      setStartDate(null);
      setDueDate(null);
      onIssueCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create work item.");
    } finally {
      setLoading(false);
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
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-modal border border-jira-border dark:border-jira-dark-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-jira-text dark:text-jira-dark-text"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-jira-border dark:border-jira-dark-border flex items-center justify-between">
          <h2 className="text-base font-bold text-jira-text dark:text-jira-dark-text">{t.nav.createIssue}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>
          )}

          {/* Project & Issue Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-jira-dark-subtle uppercase mb-1">
                Project
              </label>
              <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-sm text-jira-text dark:text-jira-dark-text font-medium">
                <span
                  className={`w-5 h-5 rounded bg-gradient-to-tr ${theme.bg} text-white flex items-center justify-center text-[10px] font-bold`}
                >
                  {initials}
                </span>
                <span className="truncate">{project.name}</span>
                <span className="text-xs text-jira-subtle dark:text-jira-dark-subtle font-mono">
                  ({project.key})
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-jira-dark-subtle uppercase mb-1">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IssueTypeSelect value={type} onChange={setType} />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement user authentication workflow"
              className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-sm text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, acceptance criteria, or context..."
              className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-sm text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue resize-y"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
                Status
              </label>
              <StatusSelect
                value={statusId}
                statuses={project.statuses}
                onChange={setStatusId}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
                Priority
              </label>
              <PrioritySelect
                value={priority}
                onChange={setPriority}
              />
            </div>
          </div>

          {/* Story Points & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="e.g. 3, 5, 8"
                className="w-full px-3 py-2 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-sm text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle dark:text-slate-400 uppercase mb-1">
                Assignee
              </label>
              <AssigneeSelect
                value={assigneeId}
                members={project.members.map((m) => m.user)}
                onChange={(val) => setAssigneeId(val || "")}
              />
            </div>
          </div>

          {/* Start Date & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <DatePickerField
              label="Start Date"
              value={startDate}
              placeholder="Add date"
              onChange={(d) => setStartDate(d)}
            />
            <DatePickerField
              label="Due Date"
              value={dueDate}
              placeholder="Add date"
              onChange={(d) => setDueDate(d)}
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-jira-border dark:border-jira-dark-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded-md transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2 bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-2 transition"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              <span>{t.common.create}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
