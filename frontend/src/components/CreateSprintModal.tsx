import React, { useState, useEffect } from "react";
import { Project, Sprint } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";
import { t } from "../lib/i18n";
import { X, Calendar, Flag, Loader2, Sparkles } from "lucide-react";

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  defaultSprintNumber: number;
  onSprintCreated: (newSprint: Sprint) => void;
}

export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({
  isOpen,
  onClose,
  project,
  defaultSprintNumber,
  onSprintCreated,
}) => {
  const toast = useToastStore();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState<"1_WEEK" | "2_WEEKS" | "3_WEEKS" | "4_WEEKS" | "CUSTOM">("2_WEEKS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates and default name
  useEffect(() => {
    if (isOpen) {
      setName(`${project.key} Sprint ${defaultSprintNumber}`);
      setGoal("");
      setDuration("2_WEEKS");

      const now = new Date();
      const startStr = now.toISOString().split("T")[0];
      const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const endStr = end.toISOString().split("T")[0];

      setStartDate(startStr);
      setEndDate(endStr);
      setError(null);
    }
  }, [isOpen, project.key, defaultSprintNumber]);

  // Recalculate end date on duration change
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

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama sprint wajib diisi");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await api.sprints.create(project.key, {
        name: name.trim(),
        goal: goal.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      });

      toast.success(`Sprint '${res.sprint.name}' created successfully!`);
      onSprintCreated(res.sprint);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create sprint");
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
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800/60">
              <Sparkles size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {t.backlog.createSprint}
              </h2>
              <p className="text-[11px] text-jira-subtle dark:text-slate-400 mt-0.5">
                {project.name} ({project.key})
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-300 rounded-lg text-xs leading-relaxed">
              {error}
            </div>
          )}

          {/* Sprint Name */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1">
              {t.backlog.sprintName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sprint 1 - MVP Release"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1">
              {t.backlog.duration}
            </label>
            <select
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

          {/* Start and End Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-jira-subtle dark:text-slate-400" />
                <span>{t.backlog.startDate}</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
                <Calendar size={13} className="text-jira-subtle dark:text-slate-400" />
                <span>{t.backlog.endDate}</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
              />
            </div>
          </div>

          {/* Sprint Goal */}
          <div>
            <label className="block text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1 flex items-center gap-1">
              <Flag size={13} className="text-jira-subtle dark:text-slate-400" />
              <span>{t.backlog.sprintGoal}</span>
              <span className="text-[11px] font-normal text-jira-subtle dark:text-slate-400">({t.common.optional})</span>
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Complete user authentication and board view integration..."
              className="w-full p-2.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-lg text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition resize-none"
            />
          </div>

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
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              <span>{t.common.create} Sprint</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
