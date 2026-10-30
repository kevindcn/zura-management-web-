import React, { useState, useMemo } from "react";
import { Project, Issue, IssueType, PriorityLevel, User } from "../types";
import { IssueTypeIcon } from "../components/IssueTypeIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { CreateIssueModal } from "../components/CreateIssueModal";
import { LabelBadge } from "../components/LabelBadge";
import { EmptyState } from "../components/EmptyState";
import { useAuthStore } from "../store/auth";
import {
  Search,
  X,
  Kanban,
  Table as TableIcon,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  AlertCircle,
  MessageSquare,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { TypeFilterDropdown } from "../components/TypeFilterDropdown";
import { JiraFilterModal } from "../components/JiraFilterModal";
import { CustomSelect } from "../components/CustomSelect";
import { t } from "../lib/i18n";

interface ListPageProps {
  project: Project;
  issues: Issue[];
  onSwitchView: (view: "summary" | "board" | "list" | "backlog" | "settings") => void;
  onSubmitCreateIssue: (data: any) => Promise<void>;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  initialSelectedIssueKey?: string | null;
  onClearInitialIssueKey?: () => void;
}

type SortColumn = "key" | "title" | "status" | "priority" | "assignee" | "dueDate" | "updatedAt";
type SortDirection = "asc" | "desc";

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  HIGHEST: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  LOWEST: 1,
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = Date.now();
    const diffSec = Math.floor((now - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}mo ago`;
    return `${Math.floor(diffMonth / 12)}y ago`;
  } catch {
    return dateString;
  }
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function isOverdue(dueDateString?: string | null, statusCategory?: string): boolean {
  if (!dueDateString || statusCategory === "DONE") return false;
  const due = new Date(dueDateString);
  const now = new Date();
  // Set to end of due date day
  due.setHours(23, 59, 59, 999);
  return due < now;
}

export const ListPage: React.FC<ListPageProps> = ({
  project,
  issues,
  onSwitchView,
  onSubmitCreateIssue,
  onIssueUpdated,
  onIssueDeleted,
  initialSelectedIssueKey,
  onClearInitialIssueKey,
}) => {
  const { user } = useAuthStore();

  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(initialSelectedIssueKey || null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(() => {
    if (initialSelectedIssueKey) {
      return issues.find((i) => i.key === initialSelectedIssueKey) || null;
    }
    return null;
  });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(Boolean(initialSelectedIssueKey));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<"ALL" | "MY_ISSUES" | "UNASSIGNED">("ALL");
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const projectMembersList: User[] = useMemo(() => {
    return project.members.map((m) => m.user);
  }, [project.members]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

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

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Search text
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesKey = issue.key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesDesc = issue.description?.toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle && !matchesDesc) return false;
      }

      // Status
      if (statusFilter !== "ALL" && issue.statusId !== statusFilter) {
        return false;
      }

      // Priority
      if (priorityFilter !== "ALL" && issue.priority !== priorityFilter) {
        return false;
      }

      // Type
      if (typeFilter !== "ALL" && issue.type !== typeFilter) {
        return false;
      }

      // Assignee
      if (assigneeFilter === "MY_ISSUES") {
        if (!user?.id || issue.assigneeId !== user.id) return false;
      } else if (assigneeFilter === "UNASSIGNED") {
        if (issue.assigneeId) return false;
      }

      return true;
    });
  }, [issues, search, statusFilter, priorityFilter, typeFilter, assigneeFilter, user?.id]);

  // Sorted issues
  const sortedIssues = useMemo(() => {
    const list = [...filteredIssues];
    list.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "key":
          comparison = a.number - b.number;
          break;
        case "title":
          comparison = a.title.localeCompare(b.title, "id");
          break;
        case "status": {
          const statusA = a.status?.position || 0;
          const statusB = b.status?.position || 0;
          comparison = statusA - statusB;
          break;
        }
        case "priority": {
          const pA = PRIORITY_ORDER[a.priority] || 0;
          const pB = PRIORITY_ORDER[b.priority] || 0;
          comparison = pA - pB;
          break;
        }
        case "assignee": {
          const nameA = a.assignee?.name || "zzz";
          const nameB = b.assignee?.name || "zzz";
          comparison = nameA.localeCompare(nameB, "id");
          break;
        }
        case "dueDate": {
          const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case "updatedAt": {
          const timeA = new Date(a.updatedAt || a.createdAt).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt).getTime();
          comparison = timeA - timeB;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [filteredIssues, sortColumn, sortDirection]);

  // Paginated issues
  const totalItems = sortedIssues.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedIssues.slice(start, start + pageSize);
  }, [sortedIssues, currentPage, pageSize]);

  const hasActiveFilters = Boolean(
    search || statusFilter !== "ALL" || priorityFilter !== "ALL" || typeFilter !== "ALL" || assigneeFilter !== "ALL"
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setTypeFilter("ALL");
    setAssigneeFilter("ALL");
    setCurrentPage(1);
  };

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown size={12} className="text-slate-400 group-hover:text-slate-600 transition" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={12} className="text-jira-blue" />
    ) : (
      <ArrowDown size={12} className="text-jira-blue" />
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text">
      {/* List Header - Jira Space Layout matching Reference 2 */}
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
            <span className="text-xs text-jira-subtle dark:text-slate-400 font-medium bg-slate-100 dark:bg-jira-dark-surface px-2.5 py-1 rounded-full border border-slate-200 dark:border-jira-dark-border">
              {hasActiveFilters
                ? t.list.filteredCount(sortedIssues.length, issues.length)
                : t.list.itemsCount(issues.length)}
            </span>

            <button
              onClick={() => setIsCreateModalOpen(true)}
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
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 border-jira-blue text-jira-blue transition-colors"
              title="List View (Active)"
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
          {/* Search */}
          <div className="relative w-52 sm:w-60">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-jira-dark-subtle" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.list.searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded-md text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-jira-dark-subtle hover:text-slate-600 dark:hover:text-jira-dark-text"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "ALL", label: t.list.allStatuses },
              ...project.statuses.map((s) => ({
                value: s.id,
                label: s.name,
              })),
            ]}
            className="w-36"
          />

          {/* Type Dropdown */}
          <TypeFilterDropdown
            selectedType={typeFilter as any}
            onSelectType={(newType) => {
              setTypeFilter(newType);
            }}
          />

          {/* Jira-style Filter Button & Popover Modal */}
          <JiraFilterModal
            project={project}
            issues={issues}
            currentUserId={user?.id}
            filters={{
              priorities: priorityFilter !== "ALL" ? [priorityFilter as PriorityLevel] : [],
              statusIds: statusFilter !== "ALL" ? [statusFilter] : [],
              types: typeFilter !== "ALL" ? [typeFilter as IssueType] : [],
              assigneeId:
                assigneeFilter === "MY_ISSUES"
                  ? "me"
                  : assigneeFilter === "UNASSIGNED"
                  ? "unassigned"
                  : null,
              labels: [],
              parentId: null,
            }}
            onChangeFilters={(newFilters) => {
              setPriorityFilter(
                newFilters.priorities.length > 0 ? newFilters.priorities[0] : "ALL"
              );
              setStatusFilter(
                newFilters.statusIds.length > 0 ? newFilters.statusIds[0] : "ALL"
              );
              setTypeFilter(
                newFilters.types.length > 0 ? newFilters.types[0] : "ALL"
              );
              if (newFilters.assigneeId === "me") setAssigneeFilter("MY_ISSUES");
              else if (newFilters.assigneeId === "unassigned")
                setAssigneeFilter("UNASSIGNED");
              else setAssigneeFilter("ALL");
              setCurrentPage(1);
            }}
            onResetFilters={clearFilters}
          />



          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-jira-subtle hover:text-jira-text underline text-xs font-medium ml-1"
            >
              {t.common.clearFilter}
            </button>
          )}
        </div>

      {/* Table Content Container */}
      <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-jira-dark-bg p-6">
        {sortedIssues.length === 0 ? (
          <div className="max-w-md mx-auto my-12 bg-white dark:bg-jira-dark-surface rounded-xl border border-jira-border dark:border-jira-dark-border p-8 shadow-card text-center">
            <EmptyState
              title={hasActiveFilters ? "No Matching Work Items" : t.list.emptyTitle}
              description={
                hasActiveFilters
                  ? "Try adjusting your search keywords or clearing active filters above."
                  : t.list.emptyDesc
              }
              actionLabel={hasActiveFilters ? t.common.clearFilter : t.list.createFirst}
              onAction={hasActiveFilters ? clearFilters : () => setIsCreateModalOpen(true)}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAFBFC] dark:bg-jira-dark-card border-b border-jira-border dark:border-jira-dark-border text-[11px] font-bold text-jira-subtle dark:text-slate-400 uppercase tracking-wider select-none">
                  {/* Key */}
                  <th
                    onClick={() => handleSort("key")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-jira-dark-card-hover transition w-32 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.key}</span>
                      {renderSortIcon("key")}
                    </div>
                  </th>

                  {/* Title / Summary */}
                  <th
                    onClick={() => handleSort("title")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition min-w-[240px] group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.summary}</span>
                      {renderSortIcon("title")}
                    </div>
                  </th>

                  {/* Status */}
                  <th
                    onClick={() => handleSort("status")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition w-36 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.status}</span>
                      {renderSortIcon("status")}
                    </div>
                  </th>

                  {/* Priority */}
                  <th
                    onClick={() => handleSort("priority")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition w-28 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.priority}</span>
                      {renderSortIcon("priority")}
                    </div>
                  </th>

                  {/* Assignee */}
                  <th
                    onClick={() => handleSort("assignee")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition w-44 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.assignee}</span>
                      {renderSortIcon("assignee")}
                    </div>
                  </th>

                  {/* Due Date */}
                  <th
                    onClick={() => handleSort("dueDate")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition w-36 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.dueDate}</span>
                      {renderSortIcon("dueDate")}
                    </div>
                  </th>

                  {/* Updated */}
                  <th
                    onClick={() => handleSort("updatedAt")}
                    className="py-2.5 px-4 cursor-pointer hover:bg-slate-100/70 transition w-32 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t.list.updated}</span>
                      {renderSortIcon("updatedAt")}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedIssues.map((issue) => {
                  const overdue = isOverdue(issue.dueDate, issue.status?.category);
                  const isDone = issue.status?.category === "DONE";

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => handleOpenDetail(issue)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenDetail(issue);
                        }
                      }}
                    >
                      {/* Key & Type */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <IssueTypeIcon type={issue.type} size={15} />
                          <span className="font-mono text-xs font-bold text-jira-blue group-hover:underline">
                            {issue.key}
                          </span>
                        </div>
                      </td>

                      {/* Title & Labels */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`font-medium text-jira-text text-xs ${
                              isDone ? "line-through text-slate-400" : ""
                            }`}
                            title={issue.title}
                          >
                            {issue.title}
                          </span>
                          {issue._count?.comments ? (
                            <span className="flex items-center gap-0.5 text-[10px] text-jira-subtle flex-shrink-0">
                              <MessageSquare size={11} />
                              {issue._count.comments}
                            </span>
                          ) : null}
                          {issue.labels && issue.labels.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap ml-1">
                              {issue.labels.map((l) => (
                                <LabelBadge key={l.id || l.name} label={l} size="sm" />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Lozenge */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            issue.status?.category === "DONE"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                              : /review/i.test(issue.status?.name || "")
                              ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60"
                              : issue.status?.category === "IN_PROGRESS"
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60"
                              : "bg-slate-100 dark:bg-jira-dark-surface text-slate-600 dark:text-slate-300 border-slate-200 dark:border-jira-dark-border"
                          }`}
                        >
                          {issue.status?.name || "To Do"}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <PriorityIcon priority={issue.priority} size={14} />
                          <span className="text-jira-text dark:text-jira-dark-text capitalize font-medium text-[11px]">
                            {t.issue.priorities[issue.priority] || issue.priority}
                          </span>
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {issue.assignee ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={
                                issue.assignee.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  issue.assignee.name
                                )}`
                              }
                              alt={issue.assignee.name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200 flex-shrink-0"
                            />
                            <span className="text-jira-text truncate font-medium text-[11px]">
                              {issue.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {issue.dueDate ? (
                          <div
                            className={`flex items-center gap-1 text-[11px] font-medium ${
                              overdue
                                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/60 font-bold"
                                : "text-jira-subtle dark:text-slate-400"
                            }`}
                            title={new Date(issue.dueDate).toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          >
                            {overdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
                            <span>{formatDate(issue.dueDate)}</span>
                            {overdue && <span className="text-[9px] uppercase tracking-wider ml-0.5">({t.list.overdue})</span>}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* Updated Relative */}
                      <td className="py-2.5 px-4 whitespace-nowrap text-jira-subtle dark:text-slate-400 text-[11px]">
                        <span
                          title={new Date(issue.updatedAt || issue.createdAt).toLocaleString("en-US")}
                        >
                          {formatRelativeTime(issue.updatedAt || issue.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {sortedIssues.length > 0 && (
          <div className="mt-4 px-4 py-3 bg-white dark:bg-jira-dark-surface border border-jira-border dark:border-jira-dark-border rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs text-jira-subtle dark:text-slate-400">
            {/* Left: Summary */}
            <div className="font-medium">
              Showing{" "}
              <span className="text-jira-text dark:text-jira-dark-text font-semibold">
                {(currentPage - 1) * pageSize + 1}
              </span>
              –
              <span className="text-jira-text dark:text-jira-dark-text font-semibold">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{" "}
              of{" "}
              <span className="text-jira-text dark:text-jira-dark-text font-semibold">{totalItems}</span>{" "}
              work items
            </div>

            {/* Middle: Page Size Selector */}
            <div className="flex items-center gap-2">
              <span>Items per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded px-2 py-1 text-xs font-semibold text-jira-text dark:text-jira-dark-text outline-none focus:border-jira-blue"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Right: Page Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition ${
                  currentPage <= 1
                    ? "bg-slate-50 dark:bg-jira-dark-card text-slate-400 dark:text-slate-600 border-slate-200 dark:border-jira-dark-border cursor-not-allowed"
                    : "bg-white dark:bg-jira-dark-surface text-jira-text dark:text-jira-dark-text border-slate-300 dark:border-jira-dark-border hover:bg-slate-50 dark:hover:bg-jira-dark-card"
                }`}
                title="Previous page"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <div className="px-2 font-semibold text-jira-text dark:text-jira-dark-text">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition ${
                  currentPage >= totalPages
                    ? "bg-slate-50 dark:bg-jira-dark-card text-slate-400 dark:text-slate-600 border-slate-200 dark:border-jira-dark-border cursor-not-allowed"
                    : "bg-white dark:bg-jira-dark-surface text-jira-text dark:text-jira-dark-text border-slate-300 dark:border-jira-dark-border hover:bg-slate-50 dark:hover:bg-jira-dark-card"
                }`}
                title="Next page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
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
          if (onClearInitialIssueKey) onClearInitialIssueKey();
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
        onClose={() => setIsCreateModalOpen(false)}
        project={project}
        onIssueCreated={() => {}}
        onSubmitCreate={onSubmitCreateIssue}
      />
    </div>
  );
};
