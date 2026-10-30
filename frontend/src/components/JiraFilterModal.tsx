import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Filter,
  X,
  Check,
  ChevronDown,
  Plus,
  Sparkles,
  Shapes,
  User as UserIcon,
  UserX,
  Tag,
  FolderTree,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Project, Issue, IssueType, PriorityLevel, Label } from "../types";
import { PriorityIcon } from "./PriorityIcon";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { LabelBadge } from "./LabelBadge";
import { t } from "../lib/i18n";

export type FilterFieldType = "priority" | "status" | "type" | "assignee" | "labels" | "parent";

export interface JiraFilterState {
  priorities: PriorityLevel[];
  statusIds: string[];
  types: IssueType[];
  assigneeId: string | null; // "me" | "unassigned" | userId | null
  labels: string[]; // label IDs
  parentId: string | null;
}

interface JiraFilterModalProps {
  project: Project;
  issues: Issue[];
  currentUserId?: string;
  filters: JiraFilterState;
  onChangeFilters: (filters: JiraFilterState) => void;
  onResetFilters: () => void;
  className?: string;
}

export function JiraFilterModal({
  project,
  issues,
  currentUserId,
  filters,
  onChangeFilters,
  onResetFilters,
  className = "",
}: JiraFilterModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "advanced">("basic");
  const [selectedField, setSelectedField] = useState<FilterFieldType | null>("priority");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Extract all unique labels from issues
  const allLabels = useMemo(() => {
    const map = new Map<string, Label>();
    issues.forEach((issue) => {
      issue.labels?.forEach((l) => {
        if (!map.has(l.id)) map.set(l.id, l);
      });
    });
    return Array.from(map.values());
  }, [issues]);

  // Extract all potential parent issues (Epics or issues with children)
  const parentIssues = useMemo(() => {
    return issues.filter(
      (i) => i.type === "EPIC" || (i.children && i.children.length > 0)
    );
  }, [issues]);

  // Project members list
  const members = useMemo(() => {
    return project.members?.map((m) => m.user).filter(Boolean) || [];
  }, [project.members]);

  // Count active filters in each field
  const fieldCounts = useMemo(() => {
    return {
      priority: filters.priorities.length,
      status: filters.statusIds.length,
      type: filters.types.length,
      assignee: filters.assigneeId ? 1 : 0,
      labels: filters.labels.length,
      parent: filters.parentId ? 1 : 0,
    };
  }, [filters]);

  const totalActiveCount =
    fieldCounts.priority +
    fieldCounts.status +
    fieldCounts.type +
    fieldCounts.assignee +
    fieldCounts.labels +
    fieldCounts.parent;

  // Toggle helper for priority
  const togglePriority = (prio: PriorityLevel) => {
    const exists = filters.priorities.includes(prio);
    const updated = exists
      ? filters.priorities.filter((p) => p !== prio)
      : [...filters.priorities, prio];
    onChangeFilters({ ...filters, priorities: updated });
  };

  // Toggle helper for status
  const toggleStatus = (statusId: string) => {
    const exists = filters.statusIds.includes(statusId);
    const updated = exists
      ? filters.statusIds.filter((s) => s !== statusId)
      : [...filters.statusIds, statusId];
    onChangeFilters({ ...filters, statusIds: updated });
  };

  // Toggle helper for type
  const toggleType = (typeKey: IssueType) => {
    const exists = filters.types.includes(typeKey);
    const updated = exists
      ? filters.types.filter((t) => t !== typeKey)
      : [...filters.types, typeKey];
    onChangeFilters({ ...filters, types: updated });
  };

  // Toggle helper for labels
  const toggleLabel = (labelId: string) => {
    const exists = filters.labels.includes(labelId);
    const updated = exists
      ? filters.labels.filter((l) => l !== labelId)
      : [...filters.labels, labelId];
    onChangeFilters({ ...filters, labels: updated });
  };

  // Priority count calculation
  const getPriorityCount = (prio: PriorityLevel) => {
    return issues.filter((i) => i.priority === prio).length;
  };

  // Status count calculation
  const getStatusCount = (statusId: string) => {
    return issues.filter((i) => i.statusId === statusId).length;
  };

  // Type count calculation
  const getTypeCount = (typeKey: IssueType) => {
    return issues.filter((i) => i.type === typeKey).length;
  };

  // Quick preset apply
  const applyPreset = (presetName: string) => {
    if (presetName === "urgent_bugs") {
      onChangeFilters({
        ...filters,
        types: ["BUG"],
        priorities: ["HIGHEST", "HIGH"],
      });
    } else if (presetName === "my_pending") {
      onChangeFilters({
        ...filters,
        assigneeId: "me",
        statusIds: project.statuses
          .filter((s) => s.category !== "DONE")
          .map((s) => s.id),
      });
    } else if (presetName === "active_epics") {
      onChangeFilters({
        ...filters,
        types: ["EPIC"],
      });
    } else if (presetName === "unassigned") {
      onChangeFilters({
        ...filters,
        assigneeId: "unassigned",
      });
    }
    setActiveTab("basic");
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-jira-dark-border shadow-xs bg-white dark:bg-jira-dark-surface overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            totalActiveCount > 0
              ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
              : "text-gray-700 dark:text-jira-dark-text hover:bg-gray-50 dark:hover:bg-jira-dark-card hover:text-gray-900 dark:hover:text-white"
          }`}
          title="Open advanced filters"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Filter
            size={14}
            className={totalActiveCount > 0 ? "text-jira-blue dark:text-blue-400" : "text-gray-500 dark:text-jira-dark-subtle"}
          />
          <span>Filter</span>
          {totalActiveCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-jira-blue text-white text-[11px] font-bold rounded-full tabular-nums leading-none">
              {totalActiveCount}
            </span>
          )}
          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            } ${totalActiveCount > 0 ? "text-jira-blue dark:text-blue-400" : "text-gray-400 dark:text-jira-dark-subtle"}`}
          />
        </button>

        {totalActiveCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResetFilters();
            }}
            className="px-1.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-jira-blue dark:text-blue-400 border-l border-blue-200 dark:border-blue-900/50 transition-colors"
            title="Clear all filter criteria"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Popover Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[590px] rounded-xl bg-white dark:bg-jira-dark-surface shadow-2xl border border-gray-200 dark:border-jira-dark-border z-50 overflow-hidden divide-y divide-gray-100 dark:divide-jira-dark-border animate-in fade-in zoom-in-95 duration-100">
          {/* Top Bar with Tabs (Basic, Advanced) */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-jira-dark-card flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-jira-dark-column p-0.5 rounded-lg border border-slate-300/60 dark:border-jira-dark-border">
              <button
                type="button"
                onClick={() => setActiveTab("basic")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "basic"
                    ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 shadow-xs border border-slate-200 dark:border-jira-dark-border"
                    : "text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Basic
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("advanced")}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "advanced"
                    ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 shadow-xs border border-slate-200 dark:border-jira-dark-border"
                    : "text-slate-600 dark:text-jira-dark-subtle hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Advanced
              </button>
            </div>

            <div className="flex items-center gap-2">
              {totalActiveCount > 0 && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-jira-dark-subtle hover:text-rose-600 dark:hover:text-rose-400 transition"
                >
                  <RotateCcw size={11} />
                  <span>Reset filters</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-jira-dark-column transition"
                title="Close dialog"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* TAB 1: BASIC (2-Column Layout) */}
          {activeTab === "basic" && (
            <div className="flex h-[310px]">
              {/* Left Column: Field Selection */}
              <div className="w-48 bg-slate-50/70 dark:bg-jira-dark-column border-r border-slate-200 dark:border-jira-dark-border p-2 flex flex-col justify-between">
                <div className="space-y-0.5">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-jira-dark-subtle">
                    Filter fields
                  </p>

                  {/* Parent */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("parent")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "parent"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderTree size={13} className="text-slate-400 dark:text-jira-dark-subtle" />
                      <span>Parent</span>
                    </span>
                    {fieldCounts.parent > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.parent}
                      </span>
                    )}
                  </button>

                  {/* Status */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("status")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "status"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-jira-blue/60" />
                      <span>Status</span>
                    </span>
                    {fieldCounts.status > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.status}
                      </span>
                    )}
                  </button>

                  {/* Work type */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("type")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "type"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Shapes size={13} className="text-slate-400 dark:text-jira-dark-subtle" />
                      <span>Work type</span>
                    </span>
                    {fieldCounts.type > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.type}
                      </span>
                    )}
                  </button>

                  {/* Priority */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("priority")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "priority"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal size={13} className="text-slate-400 dark:text-jira-dark-subtle" />
                      <span>Priority</span>
                    </span>
                    {fieldCounts.priority > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.priority}
                      </span>
                    )}
                  </button>

                  {/* Assignee */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("assignee")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "assignee"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <UserIcon size={13} className="text-slate-400 dark:text-jira-dark-subtle" />
                      <span>Assignee</span>
                    </span>
                    {fieldCounts.assignee > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.assignee}
                      </span>
                    )}
                  </button>

                  {/* Labels */}
                  <button
                    type="button"
                    onClick={() => setSelectedField("labels")}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      selectedField === "labels"
                        ? "bg-white dark:bg-jira-dark-card text-jira-blue dark:text-blue-400 font-semibold shadow-xs border border-slate-200 dark:border-jira-dark-border"
                        : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-400 dark:text-jira-dark-subtle" />
                      <span>Labels</span>
                    </span>
                    {fieldCounts.labels > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 bg-jira-blue text-white rounded-full text-[10px] font-bold tabular-nums leading-none">
                        {fieldCounts.labels}
                      </span>
                    )}
                  </button>
                </div>

                {/* + Add field */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-jira-dark-border">
                  <button
                    type="button"
                    onClick={() => setSelectedField(null)}
                    className="w-full flex items-center gap-1.5 px-2 py-1 text-slate-500 dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 text-xs font-medium rounded hover:bg-slate-200/50 dark:hover:bg-jira-dark-card transition"
                  >
                    <Plus size={13} />
                    <span>+ add field</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Values configuration */}
              <div className="flex-1 p-3.5 overflow-y-auto">
                {/* Placeholder state */}
                {selectedField === null && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-jira-dark-subtle">
                    <Filter size={32} className="mb-2 text-slate-300 dark:text-jira-dark-border stroke-[1.2]" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-jira-dark-text">
                      Select a field to start creating a filter.
                    </p>
                    <p className="text-xs text-slate-400 dark:text-jira-dark-subtle mt-1 max-w-xs">
                      Select a column on the left (Parent, Status, Work type, Priority, Assignee, Labels) to configure filter criteria.
                    </p>
                  </div>
                )}

                {/* FIELD: Priority */}
                {selectedField === "priority" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Priority</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Select task urgency level:</p>
                      </div>
                      {filters.priorities.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, priorities: [] })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as PriorityLevel[]).map((prio) => {
                        const isChecked = filters.priorities.includes(prio);
                        const count = getPriorityCount(prio);
                        const labelMap: Record<PriorityLevel, string> = {
                          HIGHEST: "Highest",
                          HIGH: "High",
                          MEDIUM: "Medium",
                          LOW: "Low",
                          LOWEST: "Lowest",
                        };

                        return (
                          <label
                            key={prio}
                            onClick={() => togglePriority(prio)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded text-jira-blue focus:ring-0 cursor-pointer"
                              />
                              <PriorityIcon priority={prio} size={15} />
                              <span className="text-xs">{labelMap[prio]}</span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-jira-dark-subtle">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FIELD: Status */}
                {selectedField === "status" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Status</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Select one or more status columns:</p>
                      </div>
                      {filters.statusIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, statusIds: [] })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {project.statuses.map((st) => {
                        const isChecked = filters.statusIds.includes(st.id);
                        const count = getStatusCount(st.id);

                        return (
                          <label
                            key={st.id}
                            onClick={() => toggleStatus(st.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded text-jira-blue focus:ring-0 cursor-pointer"
                              />
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  st.category === "DONE"
                                    ? "bg-emerald-500"
                                    : st.category === "IN_PROGRESS"
                                    ? "bg-blue-500"
                                    : "bg-slate-400"
                                }`}
                              />
                              <span className="text-xs">{st.name}</span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-jira-dark-subtle">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FIELD: Work type */}
                {selectedField === "type" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Work Type</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Select work item types:</p>
                      </div>
                      {filters.types.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, types: [] })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {(["EPIC", "STORY", "TASK", "BUG", "SUBTASK"] as IssueType[]).map((typeKey) => {
                        const isChecked = filters.types.includes(typeKey);
                        const count = getTypeCount(typeKey);

                        return (
                          <label
                            key={typeKey}
                            onClick={() => toggleType(typeKey)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded text-jira-blue focus:ring-0 cursor-pointer"
                              />
                              <IssueTypeIcon type={typeKey} size={14} />
                              <span className="text-xs">{t.issue.types[typeKey]}</span>
                            </div>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-jira-dark-subtle">
                              {count}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FIELD: Assignee */}
                {selectedField === "assignee" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Assignee</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Filter by responsible team member:</p>
                      </div>
                      {filters.assigneeId && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, assigneeId: null })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          All assignees
                        </button>
                      )}
                    </div>

                    <div className="space-y-1">
                      {/* My issues */}
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFilters({
                            ...filters,
                            assigneeId: filters.assigneeId === "me" ? null : "me",
                          })
                        }
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                          filters.assigneeId === "me"
                            ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                            : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserIcon size={15} className="text-jira-blue dark:text-blue-400" />
                          <span className="text-xs">Assigned to me</span>
                        </div>
                        {filters.assigneeId === "me" && (
                          <Check size={14} className="text-jira-blue dark:text-blue-400" />
                        )}
                      </button>

                      {/* Unassigned */}
                      <button
                        type="button"
                        onClick={() =>
                          onChangeFilters({
                            ...filters,
                            assigneeId:
                              filters.assigneeId === "unassigned" ? null : "unassigned",
                          })
                        }
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                          filters.assigneeId === "unassigned"
                            ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                            : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserX size={15} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-xs">Unassigned</span>
                        </div>
                        {filters.assigneeId === "unassigned" && (
                          <Check size={14} className="text-jira-blue dark:text-blue-400" />
                        )}
                      </button>

                      {/* Project Members */}
                      {members.map((m) => {
                        const isSelected = filters.assigneeId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              onChangeFilters({
                                ...filters,
                                assigneeId: isSelected ? null : m.id,
                              })
                            }
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                              isSelected
                                ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  m.avatarUrl ||
                                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                    m.name
                                  )}`
                                }
                                alt={m.name}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                              <span className="text-xs">{m.name}</span>
                            </div>
                            {isSelected && (
                              <Check size={14} className="text-jira-blue dark:text-blue-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FIELD: Labels */}
                {selectedField === "labels" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Labels</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Filter by project labels:</p>
                      </div>
                      {filters.labels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, labels: [] })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>

                    {allLabels.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-jira-dark-subtle py-6 text-center">
                        No labels found in this project.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {allLabels.map((lbl) => {
                          const isChecked = filters.labels.includes(lbl.id);
                          return (
                            <label
                              key={lbl.id}
                              onClick={() => toggleLabel(lbl.id)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                  : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-3.5 h-3.5 rounded text-jira-blue focus:ring-0 cursor-pointer"
                                />
                                <LabelBadge label={lbl} size="sm" />
                              </div>
                              {isChecked && (
                                <Check size={14} className="text-jira-blue dark:text-blue-400" />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* FIELD: Parent */}
                {selectedField === "parent" && (
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-jira-dark-border">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Parent / Epic</h4>
                        <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">Filter children of a specific parent:</p>
                      </div>
                      {filters.parentId && (
                        <button
                          type="button"
                          onClick={() => onChangeFilters({ ...filters, parentId: null })}
                          className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline"
                        >
                          All
                        </button>
                      )}
                    </div>

                    {parentIssues.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-jira-dark-subtle py-6 text-center">
                        No Parent/Epic items found in this project.
                      </p>
                    ) : (
                      <div className="space-y-1 max-h-[220px] overflow-y-auto">
                        {parentIssues.map((parent) => {
                          const isSelected = filters.parentId === parent.id;
                          return (
                            <button
                              key={parent.id}
                              type="button"
                              onClick={() =>
                                onChangeFilters({
                                  ...filters,
                                  parentId: isSelected ? null : parent.id,
                                })
                              }
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                                isSelected
                                  ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                                  : "hover:bg-slate-100 dark:hover:bg-jira-dark-card text-slate-700 dark:text-jira-dark-text"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <IssueTypeIcon type={parent.type} size={13} />
                                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-jira-dark-subtle">
                                  {parent.key}
                                </span>
                                <span className="text-xs text-slate-800 dark:text-jira-dark-text truncate max-w-[200px]">
                                  {parent.title}
                                </span>
                              </div>
                              {isSelected && (
                                <Check size={14} className="text-jira-blue dark:text-blue-400 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ADVANCED (Smart Presets) */}
          {activeTab === "advanced" && (
            <div className="p-4 h-[310px] overflow-y-auto">
              <div className="mb-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-jira-dark-text flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Smart Presets</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-jira-dark-subtle">
                  Apply popular filters in a single click:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => applyPreset("urgent_bugs")}
                  className="p-3 text-left rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition group"
                >
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 group-hover:text-rose-900 dark:group-hover:text-rose-200">
                    🚨 Urgent & High Bugs
                  </p>
                  <p className="text-[11px] text-rose-600/90 dark:text-rose-400 mt-0.5">
                    Only critical bugs needing immediate attention.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("my_pending")}
                  className="p-3 text-left rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition group"
                >
                  <p className="text-xs font-bold text-blue-800 dark:text-blue-300 group-hover:text-blue-900 dark:group-hover:text-blue-200">
                    👤 My Incomplete Work
                  </p>
                  <p className="text-[11px] text-blue-600/90 dark:text-blue-400 mt-0.5">
                    In-progress work items assigned to me.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("active_epics")}
                  className="p-3 text-left rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/30 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition group"
                >
                  <p className="text-xs font-bold text-purple-800 dark:text-purple-300 group-hover:text-purple-900 dark:group-hover:text-purple-200">
                    ⚡ All Project Epics
                  </p>
                  <p className="text-[11px] text-purple-600/90 dark:text-purple-400 mt-0.5">
                    Focus on major initiatives & milestones.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset("unassigned")}
                  className="p-3 text-left rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition group"
                >
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 group-hover:text-amber-900 dark:group-hover:text-amber-200">
                    ❓ Unassigned Work
                  </p>
                  <p className="text-[11px] text-amber-600/90 dark:text-amber-400 mt-0.5">
                    Work items without an assignee.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Footer Bar */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-jira-dark-card flex items-center justify-between border-t border-slate-200 dark:border-jira-dark-border">
            <div className="text-xs text-slate-600 dark:text-jira-dark-subtle">
              {totalActiveCount === 0 ? (
                <span className="text-slate-400 dark:text-jira-dark-subtle">No active filters</span>
              ) : (
                <span className="font-medium text-jira-blue dark:text-blue-400">
                  {totalActiveCount} filter criteria applied
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {totalActiveCount > 0 && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-jira-dark-subtle hover:text-rose-600 dark:hover:text-rose-400 transition"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 bg-jira-blue hover:bg-blue-600 text-white rounded-md text-xs font-semibold shadow-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
