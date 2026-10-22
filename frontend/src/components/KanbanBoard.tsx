import React, { useState } from "react";
import { Status, Issue } from "../types";
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
import { FolderPlus } from "lucide-react";

interface KanbanBoardProps {
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
  onCreateFirstIssue?: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  statuses,
  issues: initialIssues,
  onOpenDetail,
  onMoveIssue,
  onQuickCreate,
  onCreateFirstIssue,
}) => {
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const toast = useToastStore();

  // Configure pointer sensor with 5px distance constraint to differentiate click vs drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
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
              toast.error("Gagal mengurungkan pemindahan.");
            }
          },
        }
      );
    } catch (err) {
      console.error("Failed to move issue:", err);
      toast.error(t.toast.errorGeneric);
    }
  };

  // If entire board has 0 issues, display clean friendly EmptyState
  if (initialIssues.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <EmptyState
          icon={FolderPlus}
          title={t.board.emptyBoardTitle}
          description={t.board.emptyBoardDesc}
          actionLabel={t.board.createFirstIssue}
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
        {statuses.map((status) => {
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
            />
          );
        })}
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
