import React, { useState } from "react";
import { Project, Sprint } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { t } from "../lib/i18n";
import { X, CheckCircle2, AlertCircle, ArrowRight, Loader2, Layers, Check } from "lucide-react";

interface CompleteSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  sprint: Sprint | null;
  futureSprints: Sprint[];
  onSprintCompleted: (sprintId?: string) => void;
}

export const CompleteSprintModal: React.FC<CompleteSprintModalProps> = ({
  isOpen,
  onClose,
  project,
  sprint,
  futureSprints,
  onSprintCompleted,
}) => {
  const toast = useToastStore();
  const [targetDestination, setTargetDestination] = useState<string>("BACKLOG");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (futureSprints.length > 0) {
        setTargetDestination(futureSprints[0].id);
      } else {
        setTargetDestination("BACKLOG");
      }
      setError(null);
    }
  }, [isOpen, futureSprints]);

  if (!isOpen || !sprint) return null;

  const issues = sprint.issues || [];
  const completedIssues = issues.filter((i) => i.status?.category === "DONE");
  const incompleteIssues = issues.filter((i) => i.status?.category !== "DONE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      let destinationId: string | null = null;

      if (incompleteIssues.length > 0) {
        if (targetDestination === "NEW_SPRINT") {
          const nextSprintNumber = futureSprints.length + 2;
          const newSprintRes = await api.sprints.create(project.key, {
            name: `${project.key} Sprint ${nextSprintNumber}`,
          });
          destinationId = newSprintRes.sprint.id;
        } else if (targetDestination === "BACKLOG") {
          destinationId = null;
        } else {
          destinationId = targetDestination;
        }
      }

      // Execute atomic complete sprint transaction
      await api.sprints.complete(project.key, sprint.id, {
        targetSprintId: destinationId,
      });

      toast.success(`Sprint '${sprint.name}' completed successfully!`);
      onSprintCompleted(sprint.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to complete sprint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-jira-dark-surface rounded-xl shadow-2xl border border-jira-border dark:border-jira-dark-border max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-jira-text dark:text-jira-dark-text"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-border dark:border-jira-dark-border bg-[#FAFBFC] dark:bg-jira-dark-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/60">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {t.backlog.completeSprintTitle}
              </h2>
              <p className="text-[11px] text-jira-subtle dark:text-slate-400 mt-0.5">
                {sprint.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white p-1.5 rounded hover:bg-slate-100 dark:hover:bg-jira-dark-hover transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-300 rounded-lg text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Sprint Performance Summary */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                <Check size={14} />
              </div>
              <div>
                <span className="font-bold text-jira-text dark:text-jira-dark-text block text-sm">
                  {completedIssues.length}
                </span>
                <span className="text-[11px] text-jira-subtle dark:text-slate-400">
                  Completed work items
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                {incompleteIssues.length}
              </div>
              <div>
                <span className="font-bold text-jira-text dark:text-jira-dark-text block text-sm">
                  {incompleteIssues.length}
                </span>
                <span className="text-[11px] text-jira-subtle dark:text-slate-400">
                  Incomplete work items
                </span>
              </div>
            </div>
          </div>

          {/* Incomplete Issues Handling */}
          {incompleteIssues.length > 0 ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text">
                {t.backlog.moveIncompleteTo}
              </label>
              <select
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition font-medium"
              >
                {futureSprints.map((fs) => (
                  <option key={fs.id} value={fs.id}>
                    {fs.name} (Future Sprint)
                  </option>
                ))}
                <option value="BACKLOG">Backlog (Main backlog pool)</option>
                <option value="NEW_SPRINT">+ Create New Sprint</option>
              </select>
              <p className="text-[11px] text-jira-subtle dark:text-slate-400 leading-relaxed">
                {incompleteIssues.length} incomplete issues will be moved to the destination above.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Great job! All work items in this sprint were completed (100%).</span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded-lg transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              <CheckCircle2 size={13} />
              <span>{t.backlog.completeSprint}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
