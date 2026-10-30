import React, { useState, useEffect } from "react";
import { Project, Sprint } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { t } from "../lib/i18n";
import { X, Play, Calendar, Flag, AlertTriangle, Loader2 } from "lucide-react";

interface StartSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  sprint: Sprint | null;
  hasOtherActiveSprint: boolean;
  activeSprintName?: string;
  onSprintStarted: (updatedSprint: Sprint) => void;
}

export const StartSprintModal: React.FC<StartSprintModalProps> = ({
  isOpen,
  onClose,
  project,
  sprint,
  hasOtherActiveSprint,
  activeSprintName,
  onSprintStarted,
}) => {
  const toast = useToastStore();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState<"1_WEEK" | "2_WEEKS" | "3_WEEKS" | "4_WEEKS" | "CUSTOM">("2_WEEKS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sprint) {
      setName(sprint.name);
      setGoal(sprint.goal || "");
      setDuration("2_WEEKS");

      const now = sprint.startDate ? new Date(sprint.startDate) : new Date();
      const startStr = now.toISOString().split("T")[0];

      let endStr = "";
      if (sprint.endDate) {
        endStr = new Date(sprint.endDate).toISOString().split("T")[0];
      } else {
        const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        endStr = end.toISOString().split("T")[0];
      }

      setStartDate(startStr);
      setEndDate(endStr);
      setError(null);
    }
  }, [isOpen, sprint]);

  const handleDurationChange = (newDur: "1_WEEK" | "2_WEEKS" | "3_WEEKS" | "4_WEEKS" | "CUSTOM") => {
    setDuration(newDur);
    if (newDur !== "CUSTOM") {
      const daysMap = {
        "1_WEEK": 7,
        "2_WEEKS": 14,
        "3_WEEKS": 21,
        "4_WEEKS": 28,
      };
      const days = daysMap[newDur];
      const base = startDate ? new Date(startDate) : new Date();
      const end = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
      setEndDate(end.toISOString().split("T")[0]);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (duration !== "CUSTOM" && val) {
      const daysMap = {
        "1_WEEK": 7,
        "2_WEEKS": 14,
        "3_WEEKS": 21,
        "4_WEEKS": 28,
      };
      const days = daysMap[duration];
      const end = new Date(new Date(val).getTime() + days * 24 * 60 * 60 * 1000);
      setEndDate(end.toISOString().split("T")[0]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sprint) return null;

  const totalIssues = sprint.issues?.length || sprint._count?.issues || 0;
  const totalStoryPoints = sprint.issues?.reduce((acc, i) => acc + (i.storyPoints || 0), 0) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasOtherActiveSprint) return;
    if (!name.trim()) {
      setError("Sprint name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await api.sprints.update(project.key, sprint.id, {
        name: name.trim(),
        goal: goal.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        state: "ACTIVE",
      });

      toast.success(`Sprint '${res.sprint.name}' started successfully!`);
      onSprintStarted(res.sprint);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to start sprint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-jira-dark-surface rounded-xl shadow-2xl border border-jira-border dark:border-jira-dark-border max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jira-border dark:border-jira-dark-border bg-[#FAFBFC] dark:bg-jira-dark-surface">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
              <Play size={16} className="fill-emerald-600 dark:fill-emerald-400 ml-0.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {t.backlog.startSprintTitle}
              </h2>
              <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle mt-0.5">
                {sprint.name} • {totalIssues} work items ({totalStoryPoints} points)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text p-1.5 rounded hover:bg-slate-100 dark:hover:bg-jira-dark-card transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning if another sprint is active */}
        {hasOtherActiveSprint && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-xs flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Only 1 sprint can be active at a time.</span> The sprint{" "}
              <span className="font-bold">'{activeSprintName}'</span> is currently active. Please complete it first.
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1">
              {t.backlog.sprintName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={hasOtherActiveSprint}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1">
              {t.backlog.duration}
            </label>
            <select
              disabled={hasOtherActiveSprint}
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition font-medium"
            >
              <option value="1_WEEK">{t.backlog.oneWeek} (7 days)</option>
              <option value="2_WEEKS">{t.backlog.twoWeeks} (14 days)</option>
              <option value="3_WEEKS">{t.backlog.threeWeeks} (21 days)</option>
              <option value="4_WEEKS">{t.backlog.fourWeeks} (28 days)</option>
              <option value="CUSTOM">{t.backlog.custom}</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-jira-subtle dark:text-jira-dark-subtle" />
                <span>{t.backlog.startDate}</span>
              </label>
              <input
                type="date"
                disabled={hasOtherActiveSprint}
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-jira-subtle dark:text-jira-dark-subtle" />
                <span>{t.backlog.endDate}</span>
              </label>
              <input
                type="date"
                disabled={hasOtherActiveSprint}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
              />
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
              <Flag size={13} className="text-jira-subtle dark:text-jira-dark-subtle" />
              <span>{t.backlog.sprintGoal}</span>
              <span className="text-[11px] font-normal text-jira-subtle dark:text-jira-dark-subtle">({t.common.optional})</span>
            </label>
            <textarea
              rows={3}
              disabled={hasOtherActiveSprint}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe the goals and deliverables for this sprint..."
              className="w-full p-2.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-card rounded-lg transition"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || hasOtherActiveSprint || !name.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              <Play size={13} className="fill-white" />
              <span>{t.backlog.startSprint}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
