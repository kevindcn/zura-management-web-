import React, { useState, useEffect, useMemo } from "react";
import { Project, Issue, Sprint, User, IssueType, PriorityLevel } from "../types";
import { api, isSessionExpired, isSessionExpiredError } from "../lib/api";
import { useToastStore } from "../store/toast";
import { useAuthStore } from "../store/auth";
import { can, getUserRole } from "../lib/permissions";
import { IssueTypeIcon } from "../components/IssueTypeIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { IssueTypeSelect } from "../components/CustomSelect";
import { CreateIssueModal } from "../components/CreateIssueModal";
import { CreateSprintModal } from "../components/CreateSprintModal";
import { StartSprintModal } from "../components/StartSprintModal";
import { CompleteSprintModal } from "../components/CompleteSprintModal";
import { EditSprintModal } from "../components/EditSprintModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { LabelBadge } from "../components/LabelBadge";
import { TypeFilterDropdown } from "../components/TypeFilterDropdown";
import { t } from "../lib/i18n";
import {
  Layers,
  Kanban,
  Table as TableIcon,
  Play,
  CheckCircle2,
  Calendar,
  Flag,
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Trash2,
  Edit3,
  ArrowRight,
  ArrowRightLeft,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Archive,
  CheckSquare,
  Globe,
  TrendingUp,
} from "lucide-react";

interface BacklogPageProps {
  project: Project;
  issues: Issue[];
  onSwitchView: (view: "summary" | "board" | "list" | "backlog" | "reports" | "settings", sprintReportId?: string) => void;
  onSubmitCreateIssue: (data: any) => Promise<void>;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  onRefreshIssues: () => Promise<void>;
  initialSelectedIssueKey?: string | null;
  onClearInitialIssueKey?: () => void;
}

export const BacklogPage: React.FC<BacklogPageProps> = ({
  project,
  issues,
  onSwitchView,
  onSubmitCreateIssue,
  onIssueUpdated,
  onIssueDeleted,
  onRefreshIssues,
  initialSelectedIssueKey,
  onClearInitialIssueKey,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();

  const userRole = getUserRole(project, user?.id);
  const canManageSprint = can(userRole, "sprint:manage");
  const canCreateIssue = can(userRole, "issue:create");
  const canEditIssue = can(userRole, "issue:edit");

  // Sprints state
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<"ALL" | "MY_ISSUES" | "UNASSIGNED">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Collapsed sections
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});
  const [isBacklogCollapsed, setIsBacklogCollapsed] = useState(false);
  const [isClosedSprintsCollapsed, setIsClosedSprintsCollapsed] = useState(true);

  // Modals state
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [startSprintTarget, setStartSprintTarget] = useState<Sprint | null>(null);
  const [completeSprintTarget, setCompleteSprintTarget] = useState<Sprint | null>(null);
  const [editSprintTarget, setEditSprintTarget] = useState<Sprint | null>(null);
  const [deleteSprintTarget, setDeleteSprintTarget] = useState<Sprint | null>(null);

  // Issue detail & create issue modal state
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(initialSelectedIssueKey || null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(() => {
    if (initialSelectedIssueKey) {
      return issues.find((i) => i.key === initialSelectedIssueKey) || null;
    }
    return null;
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(Boolean(initialSelectedIssueKey));
  const [isCreateIssueModalOpen, setIsCreateIssueModalOpen] = useState(false);
  const [createIssueSprintId, setCreateIssueSprintId] = useState<string | null>(null);

  // Inline issue creation
  const [inlineSprintId, setInlineSprintId] = useState<string | null>(null); // sprint id or "backlog"
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineType, setInlineType] = useState<IssueType>("TASK");
  const [inlineSubmitting, setInlineSubmitting] = useState(false);

  // Moving issue dropdown / popover state
  const [movingIssueId, setMovingIssueId] = useState<string | null>(null);

  // Fetch sprints
  const loadSprints = async () => {
    try {
      setLoadingSprints(true);
      const res = await api.sprints.list(project.key);
      setSprints(res.sprints);
    } catch (err: any) {
      if (isSessionExpired() || isSessionExpiredError(err)) return;
      console.error("Failed to load sprints:", err);
      toast.error("Failed to load sprints list.");
    } finally {
      setLoadingSprints(false);
    }
  };

  useEffect(() => {
    loadSprints();
  }, [project.key]);

  // Handle deep-linked issue
  useEffect(() => {
    if (initialSelectedIssueKey) {
      setSelectedIssueKey(initialSelectedIssueKey);
      const found = issues.find((i) => i.key === initialSelectedIssueKey);
      setSelectedIssue(found || null);
      setIsDetailModalOpen(true);
      onClearInitialIssueKey?.();
    }
  }, [initialSelectedIssueKey, issues, onClearInitialIssueKey]);

  // Categorize sprints
  const activeSprint = useMemo(() => {
    return sprints.find((s) => s.state === "ACTIVE") || null;
  }, [sprints]);

  const futureSprints = useMemo(() => {
    return sprints.filter((s) => s.state === "FUTURE");
  }, [sprints]);

  const closedSprints = useMemo(() => {
    return sprints.filter((s) => s.state === "CLOSED");
  }, [sprints]);

  // Filter issues based on search & filter bar
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesDesc = issue.description?.toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle && !matchesDesc) return false;
      }

      // Assignee
      if (assigneeFilter === "MY_ISSUES") {
        if (!user?.id || issue.assigneeId !== user.id) return false;
      } else if (assigneeFilter === "UNASSIGNED") {
        if (issue.assigneeId) return false;
      }

      // Type
      if (typeFilter !== "ALL" && issue.type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [issues, search, assigneeFilter, typeFilter, user?.id]);

  // Group filtered issues by sprintId
  const issuesBySprintId = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const issue of filteredIssues) {
      const sid = issue.sprintId || "backlog";
      if (!map[sid]) map[sid] = [];
      map[sid].push(issue);
    }
    return map;
  }, [filteredIssues]);

  // Issues in backlog pool
  const backlogIssues = useMemo(() => {
    return issuesBySprintId["backlog"] || [];
  }, [issuesBySprintId]);

  // Stats helper
  const calculatePoints = (items: Issue[]) => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;

    for (const item of items) {
      const pts = item.storyPoints || 0;
      const cat = item.status?.category;
      if (cat === "DONE") done += pts;
      else if (cat === "IN_PROGRESS") inProgress += pts;
      else todo += pts;
    }

    return { todo, inProgress, done, total: todo + inProgress + done };
  };

  // Toggle sprint collapse
  const toggleCollapseSprint = (sprintId: string) => {
    setCollapsedSprints((prev) => ({
      ...prev,
      [sprintId]: !prev[sprintId],
    }));
  };

  // Handle move issue to target sprint or backlog
  const handleMoveIssueToSprint = async (issue: Issue, targetSprintId: string | null) => {
    try {
      await api.sprints.moveIssues(project.key, {
        issueIds: [issue.id],
        targetSprintId,
      });

      // Update local issue state
      const targetSprint = targetSprintId ? sprints.find((s) => s.id === targetSprintId) : null;
      onIssueUpdated({
        ...issue,
        sprintId: targetSprintId,
        sprint: targetSprint ? { id: targetSprint.id, name: targetSprint.name, state: targetSprint.state } : null,
      });

      setMovingIssueId(null);
      toast.success(
        targetSprint
          ? `${issue.key} moved to ${targetSprint.name}`
          : `${issue.key} moved to Backlog`
      );
      await loadSprints();
    } catch (err: any) {
      toast.error(err.message || "Failed to move work item");
    }
  };

  // Handle inline issue creation
  const handleInlineCreate = async (sprintId: string | null) => {
    if (!inlineTitle.trim()) return;
    try {
      setInlineSubmitting(true);
      const res = await api.issues.create(project.key, {
        title: inlineTitle.trim(),
        type: inlineType,
        priority: "MEDIUM",
        sprintId: sprintId,
      });

      await onRefreshIssues();
      await loadSprints();
      setInlineTitle("");
      setInlineSprintId(null);
      toast.success(t.toast.createdSuccess(res.issue.key));
    } catch (err: any) {
      toast.error(err.message || "Failed to create work item.");
    } finally {
      setInlineSubmitting(false);
    }
  };

  // Handle sprint delete confirmation
  const handleConfirmDeleteSprint = async () => {
    if (!deleteSprintTarget) return;
    try {
      await api.sprints.delete(project.key, deleteSprintTarget.id);
      toast.success(`Sprint '${deleteSprintTarget.name}' deleted successfully`);
      setDeleteSprintTarget(null);
      await loadSprints();
      await onRefreshIssues();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete sprint");
    }
  };

  // Open modal detail
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

  // Format date helper
  const formatDateRange = (start?: string | null, end?: string | null) => {
    if (!start && !end) return null;
    const format = (d: string) =>
      new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    if (start && end) return `${format(start)} – ${format(end)}`;
    if (start) return `Mulai ${format(start)}`;
    return `Selesai ${format(end!)}`;
  };

  const hasActiveFilters = Boolean(search || assigneeFilter !== "ALL" || typeFilter !== "ALL");
  const clearFilters = () => {
    setSearch("");
    setAssigneeFilter("ALL");
    setTypeFilter("ALL");
  };

  // Renders a single issue row
  const renderIssueRow = (issue: Issue) => {
    const isDone = issue.status?.category === "DONE";
    const isInProgress = issue.status?.category === "IN_PROGRESS";

    return (
      <div
        key={issue.id}
        className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-jira-dark-card hover:bg-slate-50/80 dark:hover:bg-jira-dark-hover border-b border-slate-100 dark:border-jira-dark-border last:border-b-0 transition select-none text-xs ${
          isDone ? "opacity-75" : ""
        }`}
      >
        {/* Left: Type, Key, Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex-shrink-0">
            <IssueTypeIcon type={issue.type} />
          </div>

          <button
            onClick={() => handleOpenDetail(issue)}
            className="font-mono text-[11px] font-bold text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 transition flex-shrink-0"
          >
            {issue.key}
          </button>

          <span
            onClick={() => handleOpenDetail(issue)}
            className={`font-medium text-jira-text dark:text-jira-dark-text truncate cursor-pointer hover:text-jira-blue dark:hover:text-blue-400 transition ${
              isDone ? "line-through text-slate-500 dark:text-slate-400" : ""
            }`}
          >
            {issue.title}
          </span>

          {/* Labels */}
          {issue.labels && issue.labels.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0 ml-1">
              {issue.labels.slice(0, 2).map((l) => (
                <LabelBadge key={l.id || l.name} label={l} size="sm" />
              ))}
            </div>
          )}

          {/* Subtasks Progress */}
          {issue.children && issue.children.length > 0 && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold text-jira-subtle dark:text-jira-dark-subtle bg-slate-100 dark:bg-jira-dark-surface px-1.5 py-0.2 rounded border border-slate-200 dark:border-jira-dark-border ml-1 flex-shrink-0"
              title={`Subtasks: ${
                issue.children.filter((c) => c.status?.category === "DONE").length
              } of ${issue.children.length} completed`}
            >
              <CheckSquare size={10} className="text-slate-500 dark:text-jira-dark-subtle" />
              <span>
                {issue.children.filter((c) => c.status?.category === "DONE").length}/
                {issue.children.length}
              </span>
            </span>
          )}
        </div>

        {/* Right: Story Points, Priority, Assignee, Status, Move Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Story Points */}
          {issue.storyPoints !== null && issue.storyPoints !== undefined ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-jira-dark-surface text-slate-700 dark:text-jira-dark-text border border-slate-200 dark:border-jira-dark-border"
              title={`${issue.storyPoints} Story Points`}
            >
              {issue.storyPoints}
            </span>
          ) : (
            <span className="w-5 text-center text-slate-300 dark:text-slate-600 text-[11px]">-</span>
          )}

          {/* Priority */}
          <div className="flex-shrink-0" title={`Priority: ${issue.priority}`}>
            <PriorityIcon priority={issue.priority} />
          </div>

          {/* Assignee Avatar */}
          <div className="flex-shrink-0">
            {issue.assignee ? (
              <img
                src={
                  issue.assignee.avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    issue.assignee.name
                  )}`
                }
                alt={issue.assignee.name}
                title={issue.assignee.name}
                className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-jira-dark-border"
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-[9px] text-slate-400 font-bold"
                title="Unassigned"
              >
                ?
              </div>
            )}
          </div>

          {/* Status Lozenge */}
          <div className="w-24 flex-shrink-0">
            <span
              className={`inline-block w-full text-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider truncate border ${
                isDone
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                  : /review/i.test(issue.status?.name || "")
                  ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60"
                  : isInProgress
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60"
                  : "bg-slate-100 dark:bg-jira-dark-surface text-slate-600 dark:text-slate-300 border-slate-200 dark:border-jira-dark-border"
              }`}
            >
              {issue.status?.name || "To Do"}
            </span>
          </div>

          {/* Move to Sprint dropdown button */}
          <div className="relative">
            <button
              onClick={() =>
                setMovingIssueId((prev) => (prev === issue.id ? null : issue.id))
              }
              title="Move this work item"
              className="p-1 rounded text-slate-400 hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-hover transition"
            >
              <ArrowRightLeft size={13} />
            </button>

            {movingIssueId === issue.id && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-jira-dark-card rounded-lg shadow-jira-dropdown border border-jira-border dark:border-jira-dark-border py-1 z-30 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-jira-subtle dark:text-slate-400 border-b border-slate-100 dark:border-jira-dark-border">
                  {t.backlog.moveToSprint}
                </div>

                {/* Sprints list */}
                {sprints
                  .filter((s) => s.state !== "CLOSED" && s.id !== issue.sprintId)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleMoveIssueToSprint(issue, s.id)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-jira-text flex items-center justify-between gap-1 transition"
                    >
                      <span className="truncate">{s.name}</span>
                      {s.state === "ACTIVE" && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                          Aktif
                        </span>
                      )}
                    </button>
                  ))}

                {/* Backlog option */}
                {issue.sprintId && (
                  <button
                    onClick={() => handleMoveIssueToSprint(issue, null)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-jira-text flex items-center gap-1.5 border-t border-slate-100 text-amber-800 transition"
                  >
                    <span>{t.backlog.moveToBacklog}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Renders the inline create form at the bottom of a sprint or backlog
  const renderInlineCreateForm = (targetSprintId: string | null, containerLabel: string) => {
    const isEditing = inlineSprintId === (targetSprintId || "backlog");

    if (!isEditing) {
      if (!canCreateIssue) return null;
      return (
        <button
          onClick={() => {
            setInlineSprintId(targetSprintId || "backlog");
            setInlineTitle("");
            setInlineType("TASK");
          }}
          className="w-full py-2 px-3 text-left text-xs font-semibold text-jira-subtle hover:text-jira-blue hover:bg-slate-50/80 rounded-b-lg border-t border-slate-100 flex items-center gap-1.5 transition"
        >
          <Plus size={14} />
          <span>
            {targetSprintId ? t.backlog.createIssueInSprint : t.backlog.createIssueInBacklog}
          </span>
        </button>
      );
    }

    return (
      <div className="p-3 bg-slate-50/70 border-t border-slate-200 rounded-b-lg space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Type selector */}
          <IssueTypeSelect
            value={inlineType}
            onChange={setInlineType}
            className="w-28"
          />

          {/* Title Input */}
          <input
            type="text"
            autoFocus
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInlineCreate(targetSprintId);
              if (e.key === "Escape") setInlineSprintId(null);
            }}
            placeholder={t.board.whatNeedsDone}
            className="flex-1 px-3 py-1.5 bg-white border border-jira-border rounded text-xs text-jira-text outline-none focus:border-jira-blue transition"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setInlineSprintId(null)}
            disabled={inlineSubmitting}
            className="px-3 py-1 text-xs font-semibold text-jira-subtle hover:text-jira-text hover:bg-slate-200/60 rounded transition"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => handleInlineCreate(targetSprintId)}
            disabled={inlineSubmitting || !inlineTitle.trim()}
            className="px-3 py-1 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded transition shadow-sm disabled:opacity-50"
          >
            {t.common.create}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text">
      {/* Backlog Header - Jira Space Layout matching Reference 2 */}
      <div className="px-6 pt-4 border-b border-jira-border dark:border-jira-dark-border bg-white dark:bg-jira-dark-bg flex-shrink-0">
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
            {canManageSprint && (
              <button
                onClick={() => setIsCreateSprintOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white rounded-md text-xs font-semibold transition shadow-sm"
              >
                <Plus size={14} />
                <span>{t.backlog.createSprint}</span>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Navigation Tabs (Jira Layout: Summary, Board, List, Backlog) */}
        {onSwitchView && (
          <div className="flex items-center gap-1 -mb-px">
            <button
              onClick={() => onSwitchView("summary")}
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-medium border-b-2 border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              title="Switch to Project Summary"
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
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 border-jira-blue text-jira-blue transition-colors"
              title="Backlog & Sprint (Active)"
            >
              <Layers size={14} />
              <span>Backlog</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="px-6 py-2.5 border-b border-jira-border/60 dark:border-jira-dark-border bg-white dark:bg-jira-dark-bg flex flex-wrap items-center gap-2.5 text-xs flex-shrink-0">
          {/* Search */}
          <div className="relative w-52 sm:w-60">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items in sprint & backlog..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-card focus:border-jira-blue transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Type Dropdown */}
          <TypeFilterDropdown
            selectedType={typeFilter as any}
            onSelectType={(newType) => setTypeFilter(newType)}
          />

          {/* Assignee Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-jira-dark-card p-0.5 rounded-md border border-slate-200 dark:border-jira-dark-border">
            <button
              onClick={() => setAssigneeFilter("ALL")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                assigneeFilter === "ALL" ? "bg-white dark:bg-jira-dark-surface text-jira-text dark:text-jira-dark-text shadow-xs" : "text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAssigneeFilter("MY_ISSUES")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                assigneeFilter === "MY_ISSUES" ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-xs font-semibold" : "text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white"
              }`}
            >
              My issues
            </button>
            <button
              onClick={() => setAssigneeFilter("UNASSIGNED")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                assigneeFilter === "UNASSIGNED" ? "bg-white dark:bg-jira-dark-surface text-jira-text dark:text-jira-dark-text shadow-xs" : "text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white"
              }`}
            >
              Unassigned
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-jira-subtle dark:text-slate-400 hover:text-jira-text dark:hover:text-white underline text-xs font-medium ml-1"
            >
              {t.common.clearFilter}
            </button>
          )}
        </div>

      {/* Main Scrollable Content: Sprints and Backlog Pool */}
      <div className="flex-1 overflow-auto bg-[#F4F5F7] dark:bg-jira-dark-bg p-6 space-y-6">
        {/* ======================================================== */}
        {/* 1. ACTIVE SPRINT CONTAINER */}
        {/* ======================================================== */}
        {activeSprint && (
          <div className="bg-white rounded-xl border-2 border-emerald-500/40 shadow-sm overflow-hidden">
            {/* Header Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleCollapseSprint(activeSprint.id)}
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition"
                >
                  {collapsedSprints[activeSprint.id] ? (
                    <ChevronRight size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      SPRINT AKTIF
                    </span>
                    <h2 className="text-sm font-bold text-jira-text">
                      {activeSprint.name}
                    </h2>
                  </div>

                  {/* Dates & Goal */}
                  <div className="flex items-center gap-3 text-[11px] text-jira-subtle mt-1">
                    {formatDateRange(activeSprint.startDate, activeSprint.endDate) && (
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Calendar size={12} className="text-slate-400" />
                        {formatDateRange(activeSprint.startDate, activeSprint.endDate)}
                      </span>
                    )}
                    {activeSprint.goal && (
                      <span className="flex items-center gap-1 italic text-slate-500 truncate max-w-md">
                        <Flag size={12} className="text-slate-400 flex-shrink-0" />
                        "{activeSprint.goal}"
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Story Points Pills & Action Buttons */}
              <div className="flex items-center gap-3">
                {/* Story Points Breakdown */}
                {(() => {
                  const items = issuesBySprintId[activeSprint.id] || [];
                  const pts = calculatePoints(items);
                  return (
                    <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
                      <span
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                        title={`${pts.todo} poin To Do`}
                      >
                        {pts.todo}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200"
                        title={`${pts.inProgress} poin In Progress`}
                      >
                        {pts.inProgress}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
                        title={`${pts.done} poin Selesai`}
                      >
                        {pts.done}
                      </span>
                    </div>
                  );
                })()}

                {/* Selesaikan Sprint Button */}
                {canManageSprint && (
                  <button
                    onClick={() => setCompleteSprintTarget(activeSprint)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition shadow-sm"
                  >
                    <CheckCircle2 size={13} />
                    <span>{t.backlog.completeSprint}</span>
                  </button>
                )}

                {/* Burndown Shortcut Button */}
                <button
                  onClick={() => onSwitchView("reports", activeSprint.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border hover:bg-slate-50 dark:hover:bg-jira-dark-hover text-jira-text dark:text-jira-dark-text rounded-md text-xs font-semibold transition shadow-xs"
                  title="View Burndown & Sprint Reports"
                >
                  <TrendingUp size={13} className="text-jira-blue" />
                  <span>Burndown</span>
                </button>

                {/* More actions menu */}
                {canManageSprint && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditSprintTarget(activeSprint)}
                      title="Edit sprint"
                      className="p-1.5 rounded text-slate-400 hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-200/50 dark:hover:bg-jira-dark-hover transition"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteSprintTarget(activeSprint)}
                      title="Delete sprint"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sprint Issues List */}
            {!collapsedSprints[activeSprint.id] && (
              <div>
                {(issuesBySprintId[activeSprint.id] || []).length === 0 ? (
                  <div className="py-6 text-center text-xs text-jira-subtle dark:text-slate-400 bg-white dark:bg-jira-dark-surface">
                    There are no work items in this active sprint yet. Move items from the Backlog or add directly below.
                  </div>
                ) : (
                  <div>
                    {(issuesBySprintId[activeSprint.id] || []).map((issue) =>
                      renderIssueRow(issue)
                    )}
                  </div>
                )}

                {/* Inline Create Form */}
                {renderInlineCreateForm(activeSprint.id, activeSprint.name)}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. FUTURE SPRINTS CONTAINERS */}
        {/* ======================================================== */}
        {futureSprints.map((sprint) => {
          const items = issuesBySprintId[sprint.id] || [];
          const pts = calculatePoints(items);
          const isCollapsed = collapsedSprints[sprint.id];

          return (
            <div
              key={sprint.id}
              className="bg-white rounded-xl border border-jira-border shadow-xs overflow-hidden"
            >
              {/* Header */}
              <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleCollapseSprint(sprint.id)}
                    className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        RENCANA
                      </span>
                      <h3 className="text-xs font-bold text-jira-text">
                        {sprint.name}
                      </h3>
                      <span className="text-[11px] text-jira-subtle">
                        ({items.length} item)
                      </span>
                    </div>

                    {/* Dates & Goal */}
                    <div className="flex items-center gap-3 text-[11px] text-jira-subtle mt-0.5">
                      {formatDateRange(sprint.startDate, sprint.endDate) && (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Calendar size={12} className="text-slate-400" />
                          {formatDateRange(sprint.startDate, sprint.endDate)}
                        </span>
                      )}
                      {sprint.goal && (
                        <span className="flex items-center gap-1 italic text-slate-500 truncate max-w-md">
                          <Flag size={12} className="text-slate-400 flex-shrink-0" />
                          "{sprint.goal}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Points & Start Sprint Button */}
                <div className="flex items-center gap-3">
                  {/* Total Story Points */}
                  <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {pts.total} poin
                  </span>

                  {/* Mulai Sprint Button */}
                  {canManageSprint && (
                    <button
                      onClick={() => setStartSprintTarget(sprint)}
                      disabled={Boolean(activeSprint)}
                      title={
                        activeSprint
                          ? "Selesaikan sprint aktif terlebih dahulu"
                          : "Mulai sprint ini"
                      }
                      className="flex items-center gap-1.5 px-3 py-1 bg-jira-blue hover:bg-jira-blue-hover text-white rounded text-xs font-semibold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Play size={11} className="fill-white" />
                      <span>{t.backlog.startSprint}</span>
                    </button>
                  )}

                  {/* Actions Menu */}
                  {canManageSprint && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditSprintTarget(sprint)}
                        title="Edit sprint"
                        className="p-1 rounded text-slate-400 hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-200/50 dark:hover:bg-jira-dark-hover transition"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteSprintTarget(sprint)}
                        title="Delete sprint"
                        className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Issues List */}
              {!isCollapsed && (
                <div>
                  {items.length === 0 ? (
                    <div className="py-5 text-center text-xs text-jira-subtle dark:text-slate-400 bg-white dark:bg-jira-dark-surface">
                      This planned sprint does not have any work items yet.
                    </div>
                  ) : (
                    <div>{items.map((issue) => renderIssueRow(issue))}</div>
                  )}

                  {/* Inline Create Form */}
                  {renderInlineCreateForm(sprint.id, sprint.name)}
                </div>
              )}
            </div>
          );
        })}

        {/* ======================================================== */}
        {/* 3. BACKLOG POOL CONTAINER */}
        {/* ======================================================== */}
        <div className="bg-white dark:bg-jira-dark-surface rounded-xl border border-jira-border dark:border-jira-dark-border shadow-xs overflow-hidden">
          {/* Header */}
          <div className="p-3.5 bg-slate-50/70 dark:bg-jira-dark-card border-b border-slate-200 dark:border-jira-dark-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBacklogCollapsed((prev) => !prev)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-jira-dark-hover transition"
              >
                {isBacklogCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              </button>

              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-jira-text dark:text-jira-dark-text">
                  {t.backlog.backlog}
                </h3>
                <span className="text-[11px] text-jira-subtle dark:text-slate-400">
                  ({backlogIssues.length} work items)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Story Points */}
              {(() => {
                const pts = calculatePoints(backlogIssues);
                return (
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-jira-dark-surface px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-jira-dark-border">
                    {pts.total} pts
                  </span>
                );
              })()}

              {canManageSprint && (
                <button
                  onClick={() => setIsCreateSprintOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-jira-blue dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800/60 transition"
                >
                  <Plus size={12} />
                  <span>{t.backlog.createSprint}</span>
                </button>
              )}
            </div>
          </div>

          {/* Backlog Issues List */}
          {!isBacklogCollapsed && (
            <div>
              {backlogIssues.length === 0 ? (
                <div className="py-8 text-center bg-white px-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-xs font-bold text-jira-text">
                    {t.backlog.noBacklogIssues}
                  </p>
                  <p className="text-[11px] text-jira-subtle mt-0.5 max-w-sm mx-auto">
                    {t.backlog.emptyBacklogDesc}
                  </p>
                </div>
              ) : (
                <div>{backlogIssues.map((issue) => renderIssueRow(issue))}</div>
              )}

              {/* Inline Create Form for Backlog */}
              {renderInlineCreateForm(null, "Backlog")}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 4. CLOSED SPRINTS (ARCHIVE) */}
        {/* ======================================================== */}
        {closedSprints.length > 0 && (
          <div className="bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setIsClosedSprintsCollapsed((prev) => !prev)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/70 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-jira-subtle">
                <Archive size={14} />
                <span>Sprint Selesai ({closedSprints.length})</span>
              </div>
              <div className="text-slate-400">
                {isClosedSprintsCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </div>
            </button>

            {!isClosedSprintsCollapsed && (
              <div className="p-3 space-y-2 border-t border-slate-200 bg-white">
                {closedSprints.map((cs) => {
                  const items = issuesBySprintId[cs.id] || [];
                  return (
                    <div
                      key={cs.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span className="font-bold text-jira-text">{cs.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-600">
                            SELESAI
                          </span>
                        </div>
                        {cs.goal && (
                          <p className="text-[11px] text-jira-subtle italic mt-0.5">
                            "{cs.goal}"
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {items.length} work item
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODALS */}
      {/* ======================================================== */}
      <CreateSprintModal
        isOpen={isCreateSprintOpen}
        onClose={() => setIsCreateSprintOpen(false)}
        project={project}
        defaultSprintNumber={sprints.length + 1}
        onSprintCreated={(newSprint) => {
          setSprints((prev) => [newSprint, ...prev]);
        }}
      />

      <StartSprintModal
        isOpen={Boolean(startSprintTarget)}
        onClose={() => setStartSprintTarget(null)}
        project={project}
        sprint={startSprintTarget}
        hasOtherActiveSprint={Boolean(activeSprint && activeSprint.id !== startSprintTarget?.id)}
        activeSprintName={activeSprint?.name}
        onSprintStarted={(updated) => {
          setSprints((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }}
      />

      <CompleteSprintModal
        isOpen={Boolean(completeSprintTarget)}
        onClose={() => setCompleteSprintTarget(null)}
        project={project}
        sprint={completeSprintTarget}
        futureSprints={futureSprints}
        onSprintCompleted={async (completedSprintId) => {
          await loadSprints();
          await onRefreshIssues();
          if (completedSprintId) {
            onSwitchView("reports", completedSprintId);
          }
        }}
      />

      <EditSprintModal
        isOpen={Boolean(editSprintTarget)}
        onClose={() => setEditSprintTarget(null)}
        project={project}
        sprint={editSprintTarget}
        onSprintUpdated={(updated) => {
          setSprints((prev) =>
            prev.map((s) => (s.id === updated.id ? updated : s))
          );
        }}
      />

      {/* Confirm Delete Sprint */}
      <ConfirmDialog
        isOpen={Boolean(deleteSprintTarget)}
        title={t.backlog.deleteSprint}
        description={t.backlog.confirmDeleteSprint}
        confirmLabel={t.common.delete}
        isDestructive={true}
        onConfirm={handleConfirmDeleteSprint}
        onCancel={() => setDeleteSprintTarget(null)}
      />

      {/* Issue Detail Modal */}
      {selectedIssueKey && (
        <IssueDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedIssueKey(null);
            setSelectedIssue(null);
          }}
          issueKey={selectedIssueKey}
          initialIssue={selectedIssue}
          onIssueUpdated={(updated) => {
            setSelectedIssue(updated);
            onIssueUpdated(updated);
          }}
          onIssueDeleted={(key) => {
            setSelectedIssue(null);
            onIssueDeleted(key);
          }}
          availableStatuses={project.statuses}
          projectMembers={project.members.map((m) => m.user)}
        />
      )}
    </div>
  );
};
