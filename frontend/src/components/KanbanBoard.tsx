import React, { useState, useEffect } from "react";
import { Status, Issue, StatusCategory } from "../types";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { IssueCard } from "./IssueCard";
import { EmptyState } from "./EmptyState";
import { useToastStore } from "../store/toast";
import { t } from "../lib/i18n";
import { FolderPlus, Plus, X, Loader2 } from "lucide-react";
import { usePermission } from "../lib/permissions";
import { api } from "../lib/api";

interface KanbanBoardProps {
  projectKey?: string;
  statuses: Status[];
  issues: Issue[];
  onOpenDetail: (issue: Issue) => void;
  onMoveIssue: (
    issueKey: string,
    statusId: string,
    position: number,
    updatedIssues: Issue[]
  ) => Promise<void>;
  onQuickCreate: (statusId: string, title: string) => Promise<void>;
  onStatusAdded?: (newStatus: Status) => void;
  onStatusDeleted?: (statusId: string) => void;
  onStatusesReordered?: (newStatuses: Status[]) => void;
  onCreateFirstIssue?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  projectKey,
  statuses,
  issues: initialIssues,
  onOpenDetail,
  onMoveIssue,
  onQuickCreate,
  onStatusAdded,
  onStatusDeleted,
  onStatusesReordered,
  onCreateFirstIssue,
}) => {
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const toast = useToastStore();
  const { isAllowed: canMove } = usePermission("issue:move");
  const { isAllowed: canCreateStatus } = usePermission("issue:create");

  const [boardStatuses, setBoardStatuses] = useState<Status[]>(statuses);

  useEffect(() => {
    setBoardStatuses(statuses);
  }, [statuses]);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnCategory, setNewColumnCategory] = useState<StatusCategory>("IN_PROGRESS");
  const [isSubmittingColumn, setIsSubmittingColumn] = useState(false);

  const handleCreateColumn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newColumnName.trim() || isSubmittingColumn || !projectKey) return;
    try {
      setIsSubmittingColumn(true);
      const res = await api.projects.createStatus(projectKey, {
        name: newColumnName.trim(),
        category: newColumnCategory,
      });
      setBoardStatuses((prev) =>
        [...prev, res.status].sort((a, b) => a.position - b.position)
      );
      onStatusAdded?.(res.status);
      toast.success(`Column "${res.status.name}" added successfully!`);
      setNewColumnName("");
      setIsAddingColumn(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add board column");
    } finally {
      setIsSubmittingColumn(false);
    }
  };

  const handleDeleteColumn = async (statusId: string) => {
    if (!projectKey) return;
    try {
      await api.projects.deleteStatus(projectKey, statusId);
      setBoardStatuses((prev) => prev.filter((s) => s.id !== statusId));
      onStatusDeleted?.(statusId);
      toast.success("Board column removed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove board column");
    }
  };

  const [columnLimits, setColumnLimits] = useState<Record<string, number | null>>({});

  const handleSetWipLimit = (statusId: string, limit: number | null) => {
    setColumnLimits((prev) => ({ ...prev, [statusId]: limit }));
    toast.success(limit ? `Card limit set to ${limit}` : "Card limit removed");
  };

  const handleMoveColumn = async (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= boardStatuses.length || !projectKey) return;

    const newStatuses = [...boardStatuses];
    const [moved] = newStatuses.splice(index, 1);
    newStatuses.splice(targetIndex, 0, moved);

    // Optimistically update board order immediately
    setBoardStatuses(newStatuses);

    try {
      await api.projects.reorderStatuses(
        projectKey,
        newStatuses.map((s) => s.id)
      );
      onStatusesReordered?.(newStatuses);
      toast.success(`Column "${moved.name}" moved ${direction === "left" ? "left" : "right"}!`);
    } catch (err: any) {
      // Revert if failed
      setBoardStatuses(boardStatuses);
      toast.error(err.message || "Failed to reorder columns");
    }
  };

  // Configure pointer sensor with 5px distance constraint to differentiate click vs drag
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    ...(canMove ? [pointerSensor, keyboardSensor] : [])
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (!canMove) return;
    const { active } = event;
    const issue = initialIssues.find((i) => i.id === active.id);
    if (issue) {
      setActiveIssue(issue);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handled visually via dnd-kit
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const draggedIssue = initialIssues.find((i) => i.id === activeId);
    if (!draggedIssue) return;

    // Check if dropped over a column directly or over another issue
    const isOverColumn = statuses.some((s) => s.id === overId);
    let targetStatusId: string;
    let targetIndex: number;

    if (isOverColumn) {
      targetStatusId = overId;
      const columnIssues = initialIssues
        .filter((i) => i.statusId === targetStatusId && i.id !== activeId)
        .sort((a, b) => a.position - b.position);
      targetIndex = columnIssues.length;
    } else {
      const overIssue = initialIssues.find((i) => i.id === overId);
      if (!overIssue) return;
      targetStatusId = overIssue.statusId;

      const columnIssues = initialIssues
        .filter((i) => i.statusId === targetStatusId)
        .sort((a, b) => a.position - b.position);

      targetIndex = columnIssues.findIndex((i) => i.id === overId);
    }

    // If dropped in the same column and index, no-op
    if (draggedIssue.statusId === targetStatusId && overId === activeId) {
      return;
    }

    // Save previous state for undo capability
    const oldStatusId = draggedIssue.statusId;
    const oldPosition = draggedIssue.position;
    const oldIssuesSnapshot = [...initialIssues];
    const targetStatus = statuses.find((s) => s.id === targetStatusId);

    // Get all other issues in target column
    const otherIssuesInColumn = initialIssues
      .filter((i) => i.statusId === targetStatusId && i.id !== activeId)
      .sort((a, b) => a.position - b.position);

    // Calculate new position
    let newPosition: number;
    if (otherIssuesInColumn.length === 0) {
      newPosition = 1000;
    } else if (targetIndex <= 0) {
      newPosition = otherIssuesInColumn[0].position / 2;
    } else if (targetIndex >= otherIssuesInColumn.length) {
      newPosition = otherIssuesInColumn[otherIssuesInColumn.length - 1].position + 1000;
    } else {
      const prev = otherIssuesInColumn[targetIndex - 1].position;
      const next = otherIssuesInColumn[targetIndex].position;
      newPosition = (prev + next) / 2;
    }

    // Create optimistic issues list
    const updatedIssues = initialIssues.map((issue) => {
      if (issue.id === activeId) {
        return {
          ...issue,
          statusId: targetStatusId,
          status: targetStatus || issue.status,
          position: newPosition,
        };
      }
      return issue;
    });

    try {
      await onMoveIssue(draggedIssue.key, targetStatusId, newPosition, updatedIssues);

      // Trigger Toast with "Urungkan" action button!
      toast.success(
        t.toast.movedSuccess(draggedIssue.key, targetStatus?.name || "status baru"),
        {
          label: t.common.undo,
          onClick: async () => {
            try {
              await onMoveIssue(draggedIssue.key, oldStatusId, oldPosition, oldIssuesSnapshot);
              toast.info(t.toast.undoSuccess);
            } catch (err) {
              toast.error("Failed to undo issue move.");
            }
          },
        }
      );
    } catch (err) {
      console.error("Failed to move issue:", err);
      toast.error(t.toast.errorGeneric);
    }
  };

  // If project has no status columns configured at all
  if (statuses.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <EmptyState
          icon={FolderPlus}
          title="No Workflow Columns"
          description="This project does not have any Kanban board status columns configured yet. Add workflow statuses in project settings."
          actionLabel={onCreateFirstIssue ? t.board.createFirstIssue : undefined}
          onAction={onCreateFirstIssue}
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 flex gap-4 overflow-x-auto p-4 items-start select-none">
        {boardStatuses.map((status, index) => {
          const columnIssues = initialIssues
            .filter((i) => i.statusId === status.id)
            .sort((a, b) => a.position - b.position);

          return (
            <KanbanColumn
              key={status.id}
              status={status}
              issues={columnIssues}
              isDraggingAny={activeIssue !== null}
              onOpenDetail={onOpenDetail}
              onQuickCreate={onQuickCreate}
              onDeleteStatus={handleDeleteColumn}
              onMoveColumnLeft={() => handleMoveColumn(index, "left")}
              onMoveColumnRight={() => handleMoveColumn(index, "right")}
              canMoveLeft={index > 0}
              canMoveRight={index < boardStatuses.length - 1}
              onSetWipLimit={handleSetWipLimit}
              customLimit={columnLimits[status.id]}
            />
          );
        })}

        {/* Add Kanban Board Column / Stage */}
        {isAddingColumn ? (
          <form
            onSubmit={handleCreateColumn}
            className="w-64 sm:w-72 flex-shrink-0 bg-white dark:bg-jira-dark-surface border border-slate-300 dark:border-jira-dark-border rounded-xl p-3 shadow-md flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-jira-dark-border">
              <span className="text-xs font-bold text-slate-800 dark:text-jira-dark-text">Add Board Column</span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnName("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-jira-dark-subtle mb-1">
                Column / Stage Name <span className="text-red-500">*</span>
              </label>
              <input
                id="new-column-name-input"
                type="text"
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsAddingColumn(false);
                  }
                }}
                placeholder="e.g. Bug, QA, In Review..."
                className="w-full text-xs px-2.5 py-1.5 bg-white dark:bg-jira-dark-card border border-slate-300 dark:border-jira-dark-border text-jira-text dark:text-jira-dark-text rounded-md focus:outline-none focus:ring-1 focus:ring-jira-blue focus:border-jira-blue"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-jira-dark-subtle mb-1">
                Status Category
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setNewColumnCategory("TO_DO")}
                  className={`py-1 px-1.5 rounded border text-center transition font-medium ${
                    newColumnCategory === "TO_DO"
                      ? "bg-slate-200 dark:bg-jira-dark-card border-slate-400 dark:border-jira-dark-border text-slate-800 dark:text-jira-dark-text font-semibold"
                      : "border-slate-200 dark:border-jira-dark-border text-slate-600 dark:text-jira-dark-subtle hover:bg-slate-50 dark:hover:bg-jira-dark-hover"
                  }`}
                >
                  To Do
                </button>
                <button
                  type="button"
                  onClick={() => setNewColumnCategory("IN_PROGRESS")}
                  className={`py-1 px-1.5 rounded border text-center transition font-medium ${
                    newColumnCategory === "IN_PROGRESS"
                      ? "bg-blue-100 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-semibold"
                      : "border-slate-200 dark:border-jira-dark-border text-slate-600 dark:text-jira-dark-subtle hover:bg-slate-50 dark:hover:bg-jira-dark-hover"
                  }`}
                >
                  In Progress
                </button>
                <button
                  type="button"
                  onClick={() => setNewColumnCategory("DONE")}
                  className={`py-1 px-1.5 rounded border text-center transition font-medium ${
                    newColumnCategory === "DONE"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold"
                      : "border-slate-200 dark:border-jira-dark-border text-slate-600 dark:text-jira-dark-subtle hover:bg-slate-50 dark:hover:bg-jira-dark-hover"
                  }`}
                >
                  Done
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-jira-dark-border">
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnName("");
                }}
                className="text-xs text-slate-500 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text px-2.5 py-1 rounded hover:bg-slate-100 dark:hover:bg-jira-dark-hover transition"
              >
                Cancel
              </button>
              <button
                id="submit-add-column-btn"
                type="submit"
                disabled={!newColumnName.trim() || isSubmittingColumn}
                className="text-xs bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white font-semibold px-3 py-1 rounded transition flex items-center gap-1 cursor-pointer"
              >
                {isSubmittingColumn && <Loader2 size={12} className="animate-spin" />}
                <span>Add Column</span>
              </button>
            </div>
          </form>
        ) : canCreateStatus ? (
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsAddingColumn(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-300 dark:border-jira-dark-border hover:border-jira-blue bg-white dark:bg-jira-dark-surface hover:bg-blue-50/60 dark:hover:bg-jira-dark-hover text-slate-500 dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 flex items-center justify-center transition-all shadow-2xs group"
              title="Add new board column / stage (e.g. Bug, QA, etc)"
            >
              <Plus size={15} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Drag Overlay for smooth preview */}
      <DragOverlay dropAnimation={null}>
        {activeIssue ? (
          <IssueCard
            issue={activeIssue}
            onOpenDetail={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
