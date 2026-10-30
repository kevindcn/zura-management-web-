import React, { useState, useEffect, useMemo } from "react";
import { Project, Issue, User, IssueType, PriorityLevel } from "../types";
import { t } from "../lib/i18n";
import { api } from "../lib/api";
import {
  Kanban,
  Table as TableIcon,
  Layers,
  Globe,
  Plus,
  CheckCircle2,
  Edit3,
  FilePlus2,
  Clock,
  ExternalLink,
  Zap,
  Users,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";
import { IssueTypeIcon } from "../components/IssueTypeIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { JiraFilterModal } from "../components/JiraFilterModal";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { CreateIssueModal } from "../components/CreateIssueModal";

interface SummaryPageProps {
  project: Project;
  issues: Issue[];
  onSwitchView: (view: "summary" | "board" | "list" | "backlog" | "settings") => void;
  onSubmitCreateIssue: (data: any) => Promise<void>;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  initialSelectedIssueKey?: string | null;
  onClearInitialIssueKey?: () => void;
}

export const SummaryPage: React.FC<SummaryPageProps> = ({
  project,
  issues,
  onSwitchView,
  onSubmitCreateIssue,
  onIssueUpdated,
  onIssueDeleted,
  initialSelectedIssueKey,
  onClearInitialIssueKey,
}) => {
  // Activity feed state
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Filter state
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<PriorityLevel[]>([]);
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<IssueType[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Detail Modal & Create Modal State
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [presetCreateType, setPresetCreateType] = useState<IssueType | undefined>(undefined);

  // Open detail if initialSelectedIssueKey is provided
  useEffect(() => {
    if (initialSelectedIssueKey) {
      setSelectedIssueKey(initialSelectedIssueKey);
      const found = issues.find((i) => i.key === initialSelectedIssueKey);
      setSelectedIssue(found || null);
      setIsDetailModalOpen(true);
      onClearInitialIssueKey?.();
    }
  }, [initialSelectedIssueKey, issues, onClearInitialIssueKey]);

  const handleOpenDetail = (issueOrKey: Issue | string) => {
    if (typeof issueOrKey === "string") {
      setSelectedIssueKey(issueOrKey);
      const found = issues.find((i) => i.key === issueOrKey);
      setSelectedIssue(found || null);
    } else {
      setSelectedIssueKey(issueOrKey.key);
      setSelectedIssue(issueOrKey);
    }
    setIsDetailModalOpen(true);
  };

  // Fetch project activities
  useEffect(() => {
    let isMounted = true;
    const fetchActivities = async () => {
      try {
        setLoadingActivities(true);
        const res = await api.projects.activities(project.key);
        if (isMounted && res.activities) {
          setActivities(res.activities);
        }
      } catch (err) {
        console.warn("Could not fetch project activities, using fallback", err);
      } finally {
        if (isMounted) setLoadingActivities(false);
      }
    };

    fetchActivities();
    return () => {
      isMounted = false;
    };
  }, [project.key]);

  // Calculate filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (selectedAssigneeId) {
        if (selectedAssigneeId === "unassigned") {
          if (issue.assigneeId) return false;
        } else if (issue.assigneeId !== selectedAssigneeId) {
          return false;
        }
      }
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(issue.priority)) {
        return false;
      }
      if (selectedStatusIds.length > 0 && !selectedStatusIds.includes(issue.statusId)) {
        return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(issue.type)) {
        return false;
      }
      if (selectedLabels.length > 0) {
        const issueLabelIds = issue.labels?.map((l) => l.id) || [];
        if (!selectedLabels.some((lid) => issueLabelIds.includes(lid))) {
          return false;
        }
      }
      if (selectedParentId && issue.parentId !== selectedParentId) {
        return false;
      }
      return true;
    });
  }, [
    issues,
    selectedAssigneeId,
    selectedPriorities,
    selectedStatusIds,
    selectedTypes,
    selectedLabels,
    selectedParentId,
  ]);

  const hasActiveFilters =
    selectedAssigneeId !== null ||
    selectedPriorities.length > 0 ||
    selectedStatusIds.length > 0 ||
    selectedTypes.length > 0 ||
    selectedLabels.length > 0 ||
    selectedParentId !== null;

  const clearFilters = () => {
    setSelectedAssigneeId(null);
    setSelectedPriorities([]);
    setSelectedStatusIds([]);
    setSelectedTypes([]);
    setSelectedLabels([]);
    setSelectedParentId(null);
  };

  // KPI Calculations (7 days window)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const completedCount = useMemo(() => {
    return filteredIssues.filter((i) => {
      const isDone = i.status?.category === "DONE" || i.status?.name?.toLowerCase().includes("done") || i.status?.name?.toLowerCase().includes("selesai");
      if (!isDone) return false;
      const updated = new Date(i.updatedAt);
      return updated >= sevenDaysAgo;
    }).length;
  }, [filteredIssues, sevenDaysAgo]);

  const updatedCount = useMemo(() => {
    return filteredIssues.filter((i) => {
      const updated = new Date(i.updatedAt);
      return updated >= sevenDaysAgo;
    }).length;
  }, [filteredIssues, sevenDaysAgo]);

  const createdCount = useMemo(() => {
    return filteredIssues.filter((i) => {
      const created = new Date(i.createdAt);
      return created >= sevenDaysAgo;
    }).length;
  }, [filteredIssues, sevenDaysAgo]);

  const dueSoonCount = useMemo(() => {
    return filteredIssues.filter((i) => {
      if (!i.dueDate) return false;
      const isDone = i.status?.category === "DONE" || i.status?.name?.toLowerCase().includes("done") || i.status?.name?.toLowerCase().includes("selesai");
      if (isDone) return false;
      const due = new Date(i.dueDate);
      return due >= now && due <= sevenDaysFromNow;
    }).length;
  }, [filteredIssues, now, sevenDaysFromNow]);

  // Status breakdown
  const statusStats = useMemo(() => {
    const total = filteredIssues.length;
    const stats = project.statuses.map((s) => {
      const count = filteredIssues.filter((i) => i.statusId === s.id).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        count,
        percentage,
      };
    });
    return { total, stats };
  }, [project.statuses, filteredIssues]);

  // Color mapping for status category
  const getStatusColor = (category: string, index: number, name?: string) => {
    if (category === "DONE") return "#10B981"; // Emerald green
    if (name && /review/i.test(name)) return "#8B5CF6"; // Purple for In Review
    if (category === "IN_PROGRESS") return "#0C66E4"; // Jira blue
    if (category === "TO_DO") return "#94A3B8"; // Slate
    const colors = ["#0C66E4", "#8B5CF6", "#F59E0B", "#10B981", "#64748B"];
    return colors[index % colors.length];
  };

  // Priority breakdown
  const priorityStats = useMemo(() => {
    const priorities: PriorityLevel[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];
    const labels: Record<PriorityLevel, string> = {
      HIGHEST: "Tertinggi",
      HIGH: "Tinggi",
      MEDIUM: "Sedang",
      LOW: "Rendah",
      LOWEST: "Terendah",
    };
    const counts = priorities.map((p) => {
      const count = filteredIssues.filter((i) => i.priority === p).length;
      return { priority: p, label: labels[p], count };
    });
    const maxCount = Math.max(...counts.map((c) => c.count), 1);
    return { counts, maxCount };
  }, [filteredIssues]);

  // Types of work breakdown
  const typeStats = useMemo(() => {
    const types: IssueType[] = ["EPIC", "TASK", "BUG", "STORY", "SUBTASK"];
    const total = filteredIssues.length;
    return types.map((t) => {
      const count = filteredIssues.filter((i) => i.type === t).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { type: t, count, percentage };
    });
  }, [filteredIssues]);

  // Team workload breakdown
  const teamWorkload = useMemo(() => {
    const total = filteredIssues.length;
    const membersWork = project.members.map((m) => {
      const count = filteredIssues.filter((i) => i.assigneeId === m.userId).length;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        user: m.user,
        count,
        percentage,
      };
    });

    const unassignedCount = filteredIssues.filter((i) => !i.assigneeId).length;
    const unassignedPercentage = total > 0 ? Math.round((unassignedCount / total) * 100) : 0;

    return {
      membersWork,
      unassigned: {
        count: unassignedCount,
        percentage: unassignedPercentage,
      },
    };
  }, [project.members, filteredIssues]);

  // Epics and their progress
  const epicsWithProgress = useMemo(() => {
    const epics = issues.filter((i) => i.type === "EPIC");
    return epics.map((epic) => {
      // Find all issues with parentId === epic.id
      const children = issues.filter((i) => i.parentId === epic.id);
      const totalChildren = children.length;
      const doneChildren = children.filter(
        (c) => c.status?.category === "DONE" || c.status?.name?.toLowerCase().includes("done") || c.status?.name?.toLowerCase().includes("selesai")
      ).length;
      const percentage = totalChildren > 0 ? Math.round((doneChildren / totalChildren) * 100) : 0;
      return {
        epic,
        totalChildren,
        doneChildren,
        percentage,
      };
    });
  }, [issues]);

  // Helper for relative time in English
  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Helper for human-readable activity message
  const getActivityDescription = (act: any) => {
    switch (act.action) {
      case "CREATED":
        return "created work item";
      case "STATUS_CHANGED":
        return `changed status to "${act.newValue}"`;
      case "ASSIGNEE_CHANGED":
        return act.newValue ? `assigned to ${act.newValue}` : "unassigned";
      case "COMMENTED":
        return "commented on";
      case "UPDATED":
        return act.field ? `updated ${act.field} on` : "updated";
      default:
        return "updated";
    }
  };

  // Combined activity feed: use real activities or fallback to recent issues
  const displayActivities = useMemo(() => {
    if (activities.length > 0) return activities.slice(0, 8);
    // Fallback: generate from recent issues
    const sorted = [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted.slice(0, 6).map((item) => ({
      id: item.id,
      action: "UPDATED",
      field: "status",
      newValue: item.status?.name,
      createdAt: item.updatedAt,
      user: item.reporter || { name: "Pengguna", email: "" },
      issue: {
        id: item.id,
        key: item.key,
        title: item.title,
        type: item.type,
        status: item.status,
      },
    }));
  }, [activities, issues]);

  const projectMembersList: User[] = project.members.map((m) => m.user);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text">
      {/* Summary Header - Jira Space Layout */}
      <div className="px-6 pt-4 border-b border-jira-border dark:border-jira-dark-border bg-white dark:bg-jira-dark-bg flex-shrink-0 shadow-2xs">
        {/* Breadcrumb */}
        <div className="text-[11px] font-medium text-jira-subtle dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
          <span>{t.nav.projects}</span>
          <span>/</span>
          <span className="font-semibold text-jira-text dark:text-jira-dark-text">{project.name}</span>
        </div>

        {/* Space Title row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
              {project.key.slice(0, 2).toUpperCase()}
            </div>
            <h1 className="text-xl font-bold text-jira-text dark:text-jira-dark-text tracking-tight">
              {project.name}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-xs text-jira-subtle dark:text-slate-400 font-medium bg-slate-100 dark:bg-jira-dark-surface px-2.5 py-1 rounded-full border border-slate-200 dark:border-jira-dark-border">
              {hasActiveFilters
                ? `Showing ${filteredIssues.length} of ${issues.length} items`
                : `${issues.length} items`}
            </span>

            <button
              onClick={() => {
                setPresetCreateType(undefined);
                setIsCreateModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-jira-blue text-white rounded-md text-xs font-semibold hover:bg-jira-blue-hover transition shadow-sm"
            >
              <Plus size={14} />
              <span>{t.common.create}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Tabs (Jira Layout: Summary, Board, List, Backlog) */}
        {onSwitchView && (
          <div className="flex items-center gap-1 -mb-px">
            <button
              onClick={() => onSwitchView("summary")}
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 border-jira-blue text-jira-blue transition-colors"
              title="Project Summary (Active)"
            >
              <Globe size={14} />
              <span>{t.summary.title}</span>
            </button>
            <button
              onClick={() => onSwitchView("board")}
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-medium border-b-2 border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              title="Switch to Kanban Board"
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => onSwitchView("list")}
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-medium border-b-2 border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              title="Switch to List View"
            >
              <TableIcon size={14} />
              <span>List</span>
            </button>
            <button
              onClick={() => onSwitchView("backlog")}
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-medium border-b-2 border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              title="Switch to Backlog & Sprint Planning"
            >
              <Layers size={14} />
              <span>Backlog</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="px-6 py-2.5 border-b border-jira-border/60 dark:border-jira-dark-border bg-white dark:bg-jira-dark-bg flex flex-wrap items-center gap-2.5 text-xs flex-shrink-0">
        {/* Member Avatar Chips Filter */}
        <div className="flex items-center -space-x-1.5 pl-1">
          {projectMembersList.map((m) => {
            const isSelected = selectedAssigneeId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedAssigneeId(isSelected ? null : m.id)}
                className={`relative rounded-full transition-all hover:scale-110 hover:z-10 focus:outline-none ${
                  isSelected
                    ? "ring-2 ring-jira-blue ring-offset-2 z-10 scale-105"
                    : "opacity-85 hover:opacity-100"
                }`}
                title={`Filter berdasarkan: ${m.name}`}
              >
                <div className="w-6 h-6 rounded-full bg-jira-blue text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs">
                  {m.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              </button>
            );
          })}
        </div>

        {/* Jira Filter Modal */}
        <JiraFilterModal
          project={project}
          issues={issues}
          currentUserId={undefined}
          filters={{
            priorities: selectedPriorities,
            statusIds: selectedStatusIds,
            types: selectedTypes,
            assigneeId: selectedAssigneeId,
            labels: selectedLabels,
            parentId: selectedParentId,
          }}
          onChangeFilters={(f) => {
            setSelectedPriorities(f.priorities);
            setSelectedStatusIds(f.statusIds);
            setSelectedTypes(f.types);
            setSelectedAssigneeId(f.assigneeId);
            setSelectedLabels(f.labels);
            setSelectedParentId(f.parentId);
          }}
          onResetFilters={clearFilters}
        />

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-jira-blue hover:underline flex items-center gap-1 font-semibold text-xs ml-1 transition"
          >
            <X size={13} />
            <span>{t.common.clearFilter}</span>
          </button>
        )}
      </div>

      {/* Main Scrollable Content: Summary Dashboard */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ======================================================== */}
        {/* 1. 4 TOP KPI METRICS CARDS */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Completed */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-4 shadow-card flex items-start gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-600">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/80 dark:border-emerald-800/60 flex-shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {completedCount} {t.summary.completedLast7Days}
              </div>
              <div className="text-xs text-jira-subtle dark:text-slate-400 mt-1">{t.summary.last7DaysDesc}</div>
            </div>
          </div>

          {/* Metric 2: Updated */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-4 shadow-card flex items-start gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-600">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100/80 dark:border-blue-800/60 flex-shrink-0">
              <Edit3 size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {updatedCount} {t.summary.updatedLast7Days}
              </div>
              <div className="text-xs text-jira-subtle dark:text-slate-400 mt-1">{t.summary.last7DaysDesc}</div>
            </div>
          </div>

          {/* Metric 3: Created */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-4 shadow-card flex items-start gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-600">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/80 dark:border-indigo-800/60 flex-shrink-0">
              <FilePlus2 size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {createdCount} {t.summary.createdLast7Days}
              </div>
              <div className="text-xs text-jira-subtle dark:text-slate-400 mt-1">{t.summary.last7DaysDesc}</div>
            </div>
          </div>

          {/* Metric 4: Due Soon */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-4 shadow-card flex items-start gap-3.5 transition hover:border-slate-300 dark:hover:border-slate-600">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100/80 dark:border-amber-800/60 flex-shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-base font-bold text-jira-text dark:text-jira-dark-text leading-tight">
                {dueSoonCount} {t.summary.dueSoonNext7Days}
              </div>
              <div className="text-xs text-jira-subtle dark:text-slate-400 mt-1">{t.summary.next7DaysDesc}</div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. MAIN 2-COLUMN DASHBOARD GRID */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ---------------------------------------------------- */}
          {/* Card 1: Status Overview */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.statusOverview}</h2>
                  <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">
                    {t.summary.statusOverviewDesc}{" "}
                    <button
                      onClick={() => onSwitchView("list")}
                      className="text-jira-blue dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-0.5"
                    >
                      {t.summary.viewAllWorkItems}
                      <ChevronRight size={12} />
                    </button>
                  </p>
                </div>
              </div>

              {/* Donut Chart & Legend Container */}
              <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4 mt-2">
                {/* SVG Donut Chart */}
                <div className="relative w-48 h-48 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
                    {/* Background ring */}
                    <circle
                      cx="90"
                      cy="90"
                      r="70"
                      fill="transparent"
                      stroke="#F1F5F9"
                      strokeWidth="18"
                      className="dark:stroke-slate-800"
                    />

                    {/* Donut Segments */}
                    {statusStats.total === 0 ? (
                      <circle
                        cx="90"
                        cy="90"
                        r="70"
                        fill="transparent"
                        stroke="#E2E8F0"
                        strokeWidth="18"
                      />
                    ) : (
                      (() => {
                        const radius = 70;
                        const circumference = 2 * Math.PI * radius;
                        let accumulatedCount = 0;

                        return statusStats.stats.map((s, idx) => {
                          if (s.count === 0) return null;
                          const sliceLength = (s.count / statusStats.total) * circumference;
                          const strokeDasharray = `${sliceLength} ${circumference}`;
                          const strokeDashoffset = -((accumulatedCount / statusStats.total) * circumference);
                          accumulatedCount += s.count;

                          return (
                            <circle
                              key={s.id}
                              cx="90"
                              cy="90"
                              r={radius}
                              fill="transparent"
                              stroke={getStatusColor(s.category, idx, s.name)}
                              strokeWidth="18"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-500 ease-out"
                            />
                          );
                        });
                      })()
                    )}
                  </svg>

                  {/* Centered Total Label - Clean, spacious, and non-overlapping */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3 select-none">
                    <span className="text-3xl font-extrabold text-jira-text leading-tight tracking-tight">
                      {statusStats.total}
                    </span>
                    <span
                      className="text-xs font-semibold text-slate-500 mt-1 max-w-[125px] truncate leading-normal"
                      title="Total work item..."
                    >
                      Total work item...
                    </span>
                  </div>
                </div>

                {/* Status Legend Breakdown */}
                <div className="flex-1 w-full max-w-xs space-y-2">
                  {statusStats.stats.map((s, idx) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getStatusColor(s.category, idx, s.name) }}
                        />
                        <span className="font-medium text-jira-text">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-jira-subtle font-medium tabular-nums">
                        <span>{s.count}</span>
                        <span className="text-[11px] text-slate-400">({s.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* Card 2: Recent Activity */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.recentActivity}</h2>
              <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">{t.summary.recentActivityDesc}</p>
            </div>

            {/* Activity Stream */}
            <div className="flex-1 overflow-y-auto max-h-[260px] pr-1 space-y-3.5 divide-y divide-slate-100 dark:divide-jira-dark-border">
              {displayActivities.length === 0 ? (
                <div className="text-center py-8 text-xs text-jira-subtle dark:text-slate-400">
                  No recent activity in this workspace.
                </div>
              ) : (
                displayActivities.map((act) => (
                  <div key={act.id} className="pt-3 first:pt-0 flex items-start gap-3">
                    {/* User Avatar */}
                    <div className="w-6 h-6 rounded-full bg-jira-blue text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                      {act.user?.name
                        ? act.user.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "U"}
                    </div>

                    <div className="flex-1 text-xs leading-relaxed">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-jira-text dark:text-jira-dark-text">{act.user?.name || "User"}</span>
                        <span className="text-jira-subtle dark:text-slate-400">{getActivityDescription(act)}</span>
                        {act.issue && (
                          <button
                            onClick={() => {
                              setSelectedIssueKey(act.issue.key);
                              setIsDetailModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-jira-blue dark:text-blue-400 hover:underline bg-blue-50/80 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/50 dark:border-blue-800/60"
                          >
                            <IssueTypeIcon type={act.issue.type} size={12} />
                            <span>{act.issue.key}</span>
                          </button>
                        )}
                        {act.issue?.status && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-jira-dark-card text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-jira-dark-border">
                            {act.issue.status.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-jira-subtle dark:text-slate-400 mt-0.5">
                        {formatTimeAgo(act.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* Card 3: Priority Breakdown */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.priorityBreakdown}</h2>
              <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">{t.summary.priorityBreakdownDesc}</p>

              {/* Priority Bar Chart */}
              <div className="mt-6 pt-2">
                <div className="h-36 flex items-end justify-between gap-3 px-3 border-b border-slate-200 dark:border-jira-dark-border">
                  {priorityStats.counts.map((item) => {
                    const heightPercent =
                      item.count > 0 ? Math.max(Math.round((item.count / priorityStats.maxCount) * 100), 12) : 4;

                    const barColor =
                      item.priority === "HIGHEST"
                        ? "bg-[#DE350B]"
                        : item.priority === "HIGH"
                        ? "bg-[#FF5630]"
                        : item.priority === "MEDIUM"
                        ? "bg-[#FFAB00]"
                        : item.priority === "LOW"
                        ? "bg-[#36B37E]"
                        : "bg-[#0065FF]";

                    return (
                      <div key={item.priority} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[11px] font-bold text-jira-text dark:text-jira-dark-text tabular-nums">
                          {item.count}
                        </span>
                        <div
                          className={`w-full max-w-[42px] rounded-t-md transition-all duration-500 ease-out ${barColor}`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Labels */}
                <div className="flex items-center justify-between gap-2 px-1 pt-2.5">
                  {priorityStats.counts.map((item) => (
                    <div
                      key={item.priority}
                      className="flex-1 flex items-center justify-center gap-1 text-[11px] text-jira-subtle dark:text-slate-400 font-medium text-center truncate"
                    >
                      <PriorityIcon priority={item.priority} size={13} />
                      <span className="hidden sm:inline truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* Card 4: Types of Work */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.typesOfWork}</h2>
              <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">{t.summary.typesOfWorkDesc}</p>

              {/* Types Breakdown List */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-jira-subtle dark:text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-jira-dark-border">
                  <span>Type</span>
                  <span>Distribution</span>
                </div>

                {typeStats.map((item) => (
                  <div key={item.type} className="flex items-center gap-3 text-xs">
                    <div className="w-24 flex items-center gap-2 flex-shrink-0 font-medium text-jira-text dark:text-jira-dark-text">
                      <IssueTypeIcon type={item.type} size={14} />
                      <span className="capitalize">{item.type.toLowerCase()}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-3.5 bg-slate-100 dark:bg-jira-dark-card rounded-full overflow-hidden p-0.5 border border-slate-200/60 dark:border-jira-dark-border">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${item.percentage}%`,
                            backgroundColor:
                              item.type === "EPIC"
                                ? "#904EE2"
                                : item.type === "TASK"
                                ? "#0C66E4"
                                : item.type === "BUG"
                                ? "#DE350B"
                                : item.type === "STORY"
                                ? "#00875A"
                                : "#00A3BF",
                          }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold text-jira-text dark:text-jira-dark-text tabular-nums">
                        {item.count} <span className="text-[10px] text-jira-subtle dark:text-slate-400 font-normal">({item.percentage}%)</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* Card 5: Team Workload */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.teamWorkload}</h2>
              <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">{t.summary.teamWorkloadDesc}</p>

              {/* Workload Bars */}
              <div className="mt-5 space-y-3.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-jira-subtle dark:text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-jira-dark-border">
                  <span>Assignee</span>
                  <span>Work Distribution</span>
                </div>

                {/* Team Members */}
                {teamWorkload.membersWork.map((item) => (
                  <div key={item.user.id} className="flex items-center gap-3 text-xs">
                    <div className="w-28 flex items-center gap-2 flex-shrink-0">
                      <div className="w-5 h-5 rounded-full bg-jira-blue text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {item.user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <span className="font-medium text-jira-text dark:text-jira-dark-text truncate">{item.user.name}</span>
                    </div>

                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 h-3 bg-slate-100 dark:bg-jira-dark-card rounded-full overflow-hidden border border-slate-200/60 dark:border-jira-dark-border">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold text-jira-text dark:text-jira-dark-text tabular-nums">
                        {item.count} <span className="text-[10px] text-jira-subtle dark:text-slate-400 font-normal">({item.percentage}%)</span>
                      </span>
                    </div>
                  </div>
                ))}

                {/* Unassigned */}
                <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-100 dark:border-jira-dark-border">
                  <div className="w-28 flex items-center gap-2 flex-shrink-0 text-slate-500 dark:text-slate-400">
                    <Users size={16} className="text-slate-400" />
                    <span className="truncate">{t.summary.unassigned}</span>
                  </div>

                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-jira-dark-card rounded-full overflow-hidden border border-slate-200/60 dark:border-jira-dark-border">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${teamWorkload.unassigned.percentage}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-semibold text-jira-text dark:text-jira-dark-text tabular-nums">
                      {teamWorkload.unassigned.count}{" "}
                      <span className="text-[10px] text-jira-subtle dark:text-slate-400 font-normal">
                        ({teamWorkload.unassigned.percentage}%)
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* Card 6: Epic Progress */}
          {/* ---------------------------------------------------- */}
          <div className="bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl p-5 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text">{t.summary.epicProgress}</h2>
                  <p className="text-xs text-jira-subtle dark:text-slate-400 mt-0.5">{t.summary.epicProgressDesc}</p>
                </div>

                <button
                  onClick={() => {
                    setPresetCreateType("EPIC");
                    setIsCreateModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-jira-blue dark:text-blue-400 hover:text-jira-blue-hover transition"
                >
                  <Plus size={13} />
                  <span>{t.summary.createEpic}</span>
                </button>
              </div>

              {/* Epics List or Empty State */}
              <div className="mt-5 space-y-3">
                {epicsWithProgress.length === 0 ? (
                  <div className="text-center py-7 px-4 bg-slate-50/70 dark:bg-jira-dark-card/50 border border-dashed border-slate-200 dark:border-jira-dark-border rounded-xl flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5 border border-purple-100 dark:border-purple-800/60">
                      <Zap size={20} />
                    </div>
                    <div className="text-xs font-bold text-jira-text dark:text-jira-dark-text mb-1">{t.summary.noEpics}</div>
                    <p className="text-[11px] text-jira-subtle dark:text-slate-400 max-w-xs mb-3">
                      {t.summary.epicProgressDesc}
                    </p>
                    <button
                      onClick={() => {
                        setPresetCreateType("EPIC");
                        setIsCreateModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span>{t.summary.createEpic}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {epicsWithProgress.map(({ epic, totalChildren, doneChildren, percentage }) => (
                      <div
                        key={epic.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-slate-600 transition bg-slate-50/40 dark:bg-jira-dark-card/60"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <button
                            onClick={() => handleOpenDetail(epic)}
                            className="font-semibold text-xs text-jira-text dark:text-jira-dark-text hover:text-jira-blue dark:hover:text-blue-400 flex items-center gap-1.5 truncate text-left"
                          >
                            <IssueTypeIcon type="EPIC" size={13} />
                            <span className="text-jira-blue dark:text-blue-400 font-bold">{epic.key}</span>
                            <span className="truncate">{epic.title}</span>
                          </button>

                          <span className="text-[10px] font-semibold text-jira-subtle dark:text-slate-400 bg-white dark:bg-jira-dark-surface px-2 py-0.5 rounded border border-slate-200 dark:border-jira-dark-border flex-shrink-0">
                            {doneChildren}/{totalChildren} completed ({percentage}%)
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-200 dark:bg-jira-dark-card rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issueKey={selectedIssueKey}
        initialIssue={selectedIssue}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedIssueKey(null);
          setSelectedIssue(null);
        }}
        onIssueUpdated={(updated) => {
          setSelectedIssue(updated);
          onIssueUpdated(updated);
        }}
        onIssueDeleted={(key) => {
          setSelectedIssue(null);
          onIssueDeleted(key);
        }}
        availableStatuses={project.statuses}
        projectMembers={projectMembersList}
      />

      {/* Create Issue Modal */}
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setPresetCreateType(undefined);
        }}
        project={project}
        initialType={presetCreateType}
        onIssueCreated={() => {}}
        onSubmitCreate={onSubmitCreateIssue}
      />
    </div>
  );
};
