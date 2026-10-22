import React, { useState } from "react";
import { Project, IssueType, PriorityLevel } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { t } from "../lib/i18n";
import { X, Loader2 } from "lucide-react";

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
  }) => Promise<void>;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  project,
  onIssueCreated,
  onSubmitCreate,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<IssueType>("TASK");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");
  const [storyPoints, setStoryPoints] = useState<string>("");
  const [statusId, setStatusId] = useState<string>(
    project.statuses[0]?.id || ""
  );
  const [assigneeId, setAssigneeId] = useState<string>("");
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
      });
      setTitle("");
      setDescription("");
      setStoryPoints("");
      onIssueCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal membuat item.");
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
        className="bg-white rounded-lg shadow-jira-modal border border-jira-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-jira-border flex items-center justify-between">
          <h2 className="text-base font-bold text-jira-text">{t.nav.createIssue}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-jira-subtle hover:text-jira-text hover:bg-slate-100 transition"
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
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Project
              </label>
              <div className="flex items-center gap-2 p-2 bg-slate-100 border border-jira-border rounded text-sm text-jira-text font-medium">
                <span
                  className={`w-5 h-5 rounded bg-gradient-to-tr ${theme.bg} text-white flex items-center justify-center text-[10px] font-bold`}
                >
                  {initials}
                </span>
                <span className="truncate">{project.name}</span>
                <span className="text-xs text-jira-subtle font-mono">
                  ({project.key})
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Issue Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as IssueType)}
                  className="w-full p-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
                >
                  {issueTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement user authentication workflow"
              className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, acceptance criteria, or context..."
              className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue resize-y"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Status
              </label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full p-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              >
                {project.statuses.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full p-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Story Points & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="e.g. 3, 5, 8"
                className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full p-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              >
                <option value="">Unassigned</option>
                {project.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name} ({m.user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-jira-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-jira-subtle hover:text-jira-text hover:bg-slate-100 rounded-md transition"
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
