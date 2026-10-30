import React, { useState, useEffect } from "react";
import { Project, Issue, Status, IssueType, PriorityLevel, User } from "../types";
import { KanbanBoard } from "../components/KanbanBoard";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { CreateIssueModal } from "../components/CreateIssueModal";
import { useAuthStore } from "../store/auth";
import { Search, X, UserX, Kanban, Table as TableIcon, Layers, Globe, AlertCircle } from "lucide-react";
import { TypeFilterDropdown } from "../components/TypeFilterDropdown";
import { JiraFilterModal } from "../components/JiraFilterModal";
import { t } from "../lib/i18n";

interface BoardPageProps {
  project: Project;
  issues: Issue[];
  onMoveIssue: (
    issueKey: string,
    statusId: string,
    position: number,
    updatedIssues: Issue[]
  ) => Promise<void>;
  onQuickCreate: (statusId: string, title: string) => Promise<void>;
  onSubmitCreateIssue: (data: any) => Promise<void>;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (key: string) => void;
  onStatusAdded?: (newStatus: Status) => void;
  onStatusDeleted?: (statusId: string) => void;
  onStatusesReordered?: (newStatuses: Status[]) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  initialSelectedIssueKey?: string | null;
  onClearInitialIssueKey?: () => void;
  onSwitchView?: (view: "summary" | "board" | "list" | "backlog" | "settings") => void;
}

const AVAILABLE_TYPES: Array<IssueType | "ALL"> = [
  "ALL",
  "EPIC",
  "STORY",
  "TASK",
  "BUG",
  "SUBTASK",
];

export const BoardPage: React.FC<BoardPageProps> = ({
  project,
  issues,
  onMoveIssue,
  onQuickCreate,
  onSubmitCreateIssue,
  onIssueUpdated,
  onIssueDeleted,
  onStatusAdded,
  onStatusDeleted,
  onStatusesReordered,
  isCreateModalOpen,
  setIsCreateModalOpen,
  initialSelectedIssueKey,
  onClearInitialIssueKey,
  onSwitchView,
}) => {
  const { user } = useAuthStore();
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Initialize filters from URL query parameters (Finding #4)
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("assignee");
  });
  const [selectedType, setSelectedType] = useState<IssueType | "ALL">(() => {
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get("type");
    if (typeParam && AVAILABLE_TYPES.includes(typeParam as any)) {
      return typeParam as IssueType | "ALL";
    }
    return "ALL";
  });
  const [selectedPriorities, setSelectedPriorities] = useState<PriorityLevel[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const prioParam = params.get("priority");
    if (prioParam) {
      return prioParam
        .split(",")
        .filter((p) =>
          ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"].includes(p)
        ) as PriorityLevel[];
    }
    return [];
  });
  const [selectedStatusIds, setSelectedStatusIds] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const sParam = params.get("status");
    if (sParam) return sParam.split(",").filter(Boolean);
    return [];
  });
  const [selectedTypes, setSelectedTypes] = useState<IssueType[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get("type");
    if (tParam && AVAILABLE_TYPES.includes(tParam as any) && tParam !== "ALL") {
      return [tParam as IssueType];
    }
    return [];
  });
  const [selectedLabels, setSelectedLabels] = useState<string[]>(() => {
    const params = new URLSearchParams(window.location.search);
    const lParam = params.get("label");
    if (lParam) return lParam.split(",").filter(Boolean);
    return [];
  });
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Sync state changes to URL query string
  useEffect(() => {
    const url = new URL(window.location.href);
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");

    if (selectedAssigneeId) url.searchParams.set("assignee", selectedAssigneeId);
    else url.searchParams.delete("assignee");

    if (selectedTypes.length > 0) {
      url.searchParams.set("type", selectedTypes.join(","));
    } else if (selectedType !== "ALL") {
      url.searchParams.set("type", selectedType);
    } else {
      url.searchParams.delete("type");
    }

    if (selectedPriorities.length > 0) {
      url.searchParams.set("priority", selectedPriorities.join(","));
    } else {
      url.searchParams.delete("priority");
    }

    if (selectedStatusIds.length > 0) {
      url.searchParams.set("status", selectedStatusIds.join(","));
    } else {
      url.searchParams.delete("status");
    }

    if (selectedLabels.length > 0) {
      url.searchParams.set("label", selectedLabels.join(","));
    } else {
      url.searchParams.delete("label");
    }

    window.history.replaceState({}, "", url.toString());
  }, [
    search,
    selectedAssigneeId,
    selectedType,
    selectedTypes,
    selectedPriorities,
    selectedStatusIds,
    selectedLabels,
  ]);

  // Auto-clean stale filters that do not belong to the current project
  useEffect(() => {
    // If selectedAssigneeId does not belong to this project, reset it
    if (
      selectedAssigneeId &&
      selectedAssigneeId !== "me" &&
      selectedAssigneeId !== "unassigned"
    ) {
      const isMember = project.members.some((m) => m.user.id === selectedAssigneeId);
      if (!isMember) {
        setSelectedAssigneeId(null);
      }
    }

    // If any statusId is not in project.statuses, remove it
    if (selectedStatusIds.length > 0) {
      const validStatusIds = selectedStatusIds.filter((sId) =>
        project.statuses.some((s) => s.id === sId)
      );
      if (validStatusIds.length !== selectedStatusIds.length) {
        setSelectedStatusIds(validStatusIds);
      }
    }
  }, [project.id, project.members, project.statuses, selectedAssigneeId, selectedStatusIds]);

  // Handle opening issue detail from outside (e.g. notifications or deep link)
  useEffect(() => {
    if (initialSelectedIssueKey) {
      setSelectedIssueKey(initialSelectedIssueKey);
      const found = issues.find((i) => i.key === initialSelectedIssueKey);
      setSelectedIssue(found || null);
      setIsDetailModalOpen(true);
      onClearInitialIssueKey?.();
    }
  }, [initialSelectedIssueKey, issues, onClearInitialIssueKey]);

  const handleOpenDetail = (issue: Issue) => {
    setSelectedIssueKey(issue.key);
    setSelectedIssue(issue);
    setIsDetailModalOpen(true);
  };

  // Filter issues locally
  const filteredIssues = issues.filter((issue) => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchKey = issue.key.toLowerCase().includes(q);
      const matchTitle = issue.title.toLowerCase().includes(q);
      const matchDesc = issue.description?.toLowerCase().includes(q) || false;
      if (!matchKey && !matchTitle && !matchDesc) return false;
    }

    // Assignee filter
    if (selectedAssigneeId) {
      if (selectedAssigneeId === "me") {
        if (issue.assigneeId !== user?.id) return false;
      } else if (selectedAssigneeId === "unassigned") {
        if (issue.assigneeId) return false;
      } else {
        if (issue.assigneeId !== selectedAssigneeId) return false;
      }
    }

    // Type filter
    if (selectedTypes.length > 0) {
      if (!selectedTypes.includes(issue.type)) return false;
    } else if (selectedType !== "ALL") {
      if (issue.type !== selectedType) return false;
    }

    // Priority filter
    if (selectedPriorities.length > 0) {
      if (!selectedPriorities.includes(issue.priority)) return false;
    }

    // Status filter
    if (selectedStatusIds.length > 0) {
      if (!selectedStatusIds.includes(issue.statusId)) return false;
    }

    // Labels filter
    if (selectedLabels.length > 0) {
      const issueLabelIds = issue.labels?.map((l) => l.id) || [];
      const hasMatch = selectedLabels.some((lId) => issueLabelIds.includes(lId));
      if (!hasMatch) return false;
    }

    // Parent filter
    if (selectedParentId) {
      if (issue.parentId !== selectedParentId && issue.id !== selectedParentId) return false;
    }

    return true;
  });

  const hasActiveFilters = Boolean(
    search ||
      selectedAssigneeId ||
      selectedType !== "ALL" ||
      selectedTypes.length > 0 ||
      selectedPriorities.length > 0 ||
      selectedStatusIds.length > 0 ||
      selectedLabels.length > 0 ||
      selectedParentId
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedAssigneeId(null);
    setSelectedType("ALL");
    setSelectedTypes([]);
    setSelectedPriorities([]);
    setSelectedStatusIds([]);
    setSelectedLabels([]);
    setSelectedParentId(null);

    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  };

  const projectMembersList: User[] = project.members.map((m) => m.user);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-jira-dark-bg text-jira-text dark:text-jira-dark-text">
      {/* Board Header - Jira Space Layout matching Reference 2 */}
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-jira-subtle dark:text-slate-400 font-medium bg-slate-100 dark:bg-jira-dark-surface px-2.5 py-1 rounded-full border border-slate-200 dark:border-jira-dark-border">
              {hasActiveFilters
                ? t.board.filteredCount(filteredIssues.length, issues.length)
                : t.board.issuesCount(issues.length)}
            </span>
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
              className="flex items-center gap-2 px-3.5 pb-2.5 pt-1 text-xs font-semibold border-b-2 border-jira-blue text-jira-blue transition-colors"
              title="Kanban Board (Active)"
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
          {/* Search in board */}
          <div className="relative w-52 sm:w-60">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter board..."
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

          {/* Member avatars filter with tooltip */}
          <div className="flex items-center -space-x-1.5 pl-1">
            {projectMembersList.map((m) => {
              const isSelected = selectedAssigneeId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    setSelectedAssigneeId(isSelected ? null : m.id)
                  }
                  className={`relative rounded-full transition-all hover:scale-110 hover:z-10 focus:outline-none ${
                    isSelected
                      ? "ring-2 ring-jira-blue ring-offset-2 z-10 scale-105"
                      : "opacity-85 hover:opacity-100"
                  }`}
                  title={`Filter by: ${m.name}`}
                >
                  <img
                    src={
                      m.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        m.name
                      )}`
                    }
                    alt={m.name}
                    className="w-7 h-7 rounded-full border-2 border-white dark:border-jira-dark-bg object-cover"
                  />
                </button>
              );
            })}
          </div>

          {/* Issue Type Filter (All, Epic, Story, Task, Bug, Subtask) unified Jira-style dropdown */}
          <TypeFilterDropdown
            selectedType={selectedType}
            onSelectType={(newType) => {
              setSelectedType(newType);
              setSelectedTypes(newType === "ALL" ? [] : [newType]);
            }}
          />

          {/* Jira-style Filter Button & Popover Modal (Replaces old Priority select & Saved Views) */}
          <JiraFilterModal
            project={project}
            issues={issues}
            currentUserId={user?.id}
            filters={{
              priorities: selectedPriorities,
              statusIds: selectedStatusIds,
              types: selectedTypes,
              assigneeId: selectedAssigneeId,
              labels: selectedLabels,
              parentId: selectedParentId,
            }}
            onChangeFilters={(newFilters) => {
              setSelectedPriorities(newFilters.priorities);
              setSelectedStatusIds(newFilters.statusIds);
              setSelectedTypes(newFilters.types);
              if (newFilters.types.length === 1) {
                setSelectedType(newFilters.types[0]);
              } else if (newFilters.types.length === 0) {
                setSelectedType("ALL");
              }
              setSelectedAssigneeId(newFilters.assigneeId);
              setSelectedLabels(newFilters.labels);
              setSelectedParentId(newFilters.parentId);
            }}
            onResetFilters={clearFilters}
          />

          {/* Clear Filters button */}
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

      {/* Alert banner if active filters hide all cards */}
      {filteredIssues.length === 0 && issues.length > 0 && (
        <div className="mx-6 mt-3 mb-1 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              <strong>Active Filters:</strong> There are {issues.length} cards in this project, but they are currently hidden by filters.
            </span>
          </div>
          <button
            onClick={clearFilters}
            className="px-3 py-1 bg-white dark:bg-jira-dark-surface hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded font-semibold text-amber-900 dark:text-amber-200 transition flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <X size={13} />
            <span>Reset Filters (Show All Cards)</span>
          </button>
        </div>
      )}

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-hidden bg-[#FAFBFC] dark:bg-jira-dark-bg flex flex-col">
        <KanbanBoard
          projectKey={project.key}
          statuses={project.statuses}
          issues={filteredIssues}
          onOpenDetail={handleOpenDetail}
          onMoveIssue={onMoveIssue}
          onQuickCreate={onQuickCreate}
          onStatusAdded={onStatusAdded}
          onStatusDeleted={onStatusDeleted}
          onStatusesReordered={onStatusesReordered}
          onCreateFirstIssue={() => setIsCreateModalOpen(true)}
        />
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
        onClose={() => setIsCreateModalOpen(false)}
        project={project}
        onIssueCreated={() => {}}
        onSubmitCreate={onSubmitCreateIssue}
      />
    </div>
  );
};
