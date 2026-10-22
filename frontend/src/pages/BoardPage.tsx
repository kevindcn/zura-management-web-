import React, { useState, useEffect } from "react";
import { Project, Issue, IssueType, User } from "../types";
import { KanbanBoard } from "../components/KanbanBoard";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { CreateIssueModal } from "../components/CreateIssueModal";
import { useAuthStore } from "../store/auth";
import { Search, X, UserX } from "lucide-react";
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
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  initialSelectedIssueKey?: string | null;
  onClearInitialIssueKey?: () => void;
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
  isCreateModalOpen,
  setIsCreateModalOpen,
  initialSelectedIssueKey,
  onClearInitialIssueKey,
}) => {
  const { user } = useAuthStore();
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
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

  // Sync state changes to URL query string
  useEffect(() => {
    const url = new URL(window.location.href);
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");

    if (selectedAssigneeId) url.searchParams.set("assignee", selectedAssigneeId);
    else url.searchParams.delete("assignee");

    if (selectedType !== "ALL") url.searchParams.set("type", selectedType);
    else url.searchParams.delete("type");

    window.history.replaceState({}, "", url.toString());
  }, [search, selectedAssigneeId, selectedType]);

  // Handle opening issue detail from outside (e.g. notifications or deep link)
  useEffect(() => {
    if (initialSelectedIssueKey) {
      setSelectedIssueKey(initialSelectedIssueKey);
      setIsDetailModalOpen(true);
      onClearInitialIssueKey?.();
    }
  }, [initialSelectedIssueKey, onClearInitialIssueKey]);

  const handleOpenDetail = (issue: Issue) => {
    setSelectedIssueKey(issue.key);
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

    // Type filter (All types, Story, Task, Bug, Epic, Subtask)
    if (selectedType !== "ALL") {
      if (issue.type !== selectedType) return false;
    }

    return true;
  });

  const hasActiveFilters = Boolean(search || selectedAssigneeId || selectedType !== "ALL");

  const clearFilters = () => {
    setSearch("");
    setSelectedAssigneeId(null);
    setSelectedType("ALL");
  };

  const projectMembersList: User[] = project.members.map((m) => m.user);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      {/* Board Header */}
      <div className="px-6 pt-4 pb-3 border-b border-jira-border bg-white flex-shrink-0">
        {/* Breadcrumb */}
        <div className="text-[11px] font-medium text-jira-subtle flex items-center gap-1.5 mb-1">
          <span>{t.nav.projects}</span>
          <span>/</span>
          <span className="font-semibold text-jira-text">{project.name}</span>
          <span>/</span>
          <span>{t.board.title}</span>
        </div>

        {/* Title */}
        <div className="flex items-center justify-between mb-3.5">
          <h1 className="text-xl font-bold text-jira-text tracking-tight">
            {t.board.title}
          </h1>

          <div className="flex items-center gap-2">
            <span className="text-xs text-jira-subtle font-medium bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              {hasActiveFilters
                ? t.board.filteredCount(filteredIssues.length, issues.length)
                : t.board.issuesCount(issues.length)}
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Search in board */}
          <div className="relative w-52 sm:w-60">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter papan..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-jira-border rounded-md text-xs text-jira-text outline-none focus:bg-white focus:border-jira-blue transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Filter: Only my issues */}
          <button
            onClick={() =>
              setSelectedAssigneeId(selectedAssigneeId === "me" ? null : "me")
            }
            className={`px-3 py-1.5 rounded-md font-semibold text-xs transition shadow-2xs ${
              selectedAssigneeId === "me"
                ? "bg-jira-blue text-white shadow-sm"
                : "bg-slate-100 text-jira-text hover:bg-slate-200/80"
            }`}
          >
            {t.board.onlyMyIssues}
          </button>

          {/* Quick Filter: Unassigned */}
          <button
            onClick={() =>
              setSelectedAssigneeId(
                selectedAssigneeId === "unassigned" ? null : "unassigned"
              )
            }
            className={`px-2.5 py-1.5 rounded-md font-semibold text-xs transition flex items-center gap-1.5 shadow-2xs ${
              selectedAssigneeId === "unassigned"
                ? "bg-jira-blue text-white shadow-sm"
                : "bg-slate-100 text-jira-text hover:bg-slate-200/80"
            }`}
            title="Filter item yang belum memiliki penerima tugas"
          >
            <UserX size={13} />
            <span>{t.board.unassigned}</span>
          </button>

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
                  title={`Filter tugas: ${m.name}`}
                >
                  <img
                    src={
                      m.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        m.name
                      )}`
                    }
                    alt={m.name}
                    className="w-7 h-7 rounded-full border-2 border-white object-cover"
                  />
                </button>
              );
            })}
          </div>

          {/* Issue Type Filter (All, Epic, Story, Task, Bug, Subtask) */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
            {AVAILABLE_TYPES.map((typeKey) => {
              const label =
                typeKey === "ALL" ? t.board.allTypes : t.issue.types[typeKey];
              return (
                <button
                  key={typeKey}
                  onClick={() => setSelectedType(typeKey)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                    selectedType === typeKey
                      ? "bg-white text-jira-blue shadow-xs"
                      : "text-jira-subtle hover:text-jira-text"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

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
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-hidden bg-[#FAFBFC] flex flex-col">
        <KanbanBoard
          statuses={project.statuses}
          issues={filteredIssues}
          onOpenDetail={handleOpenDetail}
          onMoveIssue={onMoveIssue}
          onQuickCreate={onQuickCreate}
          onCreateFirstIssue={() => setIsCreateModalOpen(true)}
        />
      </div>

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issueKey={selectedIssueKey}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedIssueKey(null);
        }}
        onIssueUpdated={onIssueUpdated}
        onIssueDeleted={onIssueDeleted}
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
