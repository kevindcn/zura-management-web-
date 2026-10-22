import React, { useState } from "react";
import { Status, Issue } from "../types";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IssueCard } from "./IssueCard";
import { Plus, X, ChevronRight, ChevronDown } from "lucide-react";
import { t } from "../lib/i18n";

interface KanbanColumnProps {
  status: Status;
  issues: Issue[];
  isDraggingAny?: boolean;
  onOpenDetail: (issue: Issue) => void;
  onQuickCreate: (statusId: string, title: string) => Promise<void>;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  issues,
  isDraggingAny = false,
  onOpenDetail,
  onQuickCreate,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: {
      type: "Column",
      status,
    },
  });

  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // WIP limit logic (e.g., In Progress limit could be 4)
  const wipLimit = status.category === "IN_PROGRESS" ? 5 : null;
  const isOverWip = wipLimit !== null && issues.length > wipLimit;

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onQuickCreate(status.id, quickTitle.trim());
      setQuickTitle("");
      setIsAdding(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLozengeClass = () => {
    switch (status.category) {
      case "TO_DO":
        return "jira-lozenge-todo";
      case "IN_PROGRESS":
        return "jira-lozenge-inprogress";
      case "DONE":
        return "jira-lozenge-done";
      default:
        return "jira-lozenge-todo";
    }
  };

  const issueIds = issues.map((i) => i.id);

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => setIsCollapsed(false)}
        className="w-10 bg-jira-column hover:bg-slate-200/70 cursor-pointer rounded-md p-2 flex flex-col items-center justify-between transition select-none flex-shrink-0"
        title={`${status.name} (${issues.length}) - Klik untuk membuka`}
      >
        <div className="flex flex-col items-center gap-2">
          <ChevronRight size={14} className="text-jira-subtle" />
          <span className="text-[11px] font-bold text-jira-subtle rotate-90 origin-left mt-6 whitespace-nowrap">
            {status.name}
          </span>
        </div>
        <span className="text-xs font-bold text-jira-text bg-white border border-slate-300 w-6 h-6 rounded-full flex items-center justify-center">
          {issues.length}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 flex flex-col bg-jira-column rounded-md p-2.5 max-h-full transition-colors ${
        isOver ? "bg-[#E2E8F0] ring-2 ring-jira-blue/40" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`jira-lozenge ${getLozengeClass()}`}>
            {status.name}
          </span>
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
              isOverWip
                ? "bg-amber-100 text-amber-800 font-bold ring-1 ring-amber-300"
                : "text-jira-subtle bg-slate-200/80"
            }`}
            title={isOverWip ? t.board.wipLimitExceeded(issues.length, wipLimit!) : undefined}
          >
            {issues.length} {wipLimit ? `/ ${wipLimit}` : ""}
          </span>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/50 transition"
          title={t.board.collapseColumn}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Cards List with SortableContext */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 min-h-[60px]">
        <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </SortableContext>

        {/* Drop zone ONLY shown when dragging an issue! (Fix for Finding #5) */}
        {issues.length === 0 && !isAdding && (
          isDraggingAny ? (
            <div className="h-16 border-2 border-dashed border-jira-blue/50 bg-blue-50/30 rounded-md flex items-center justify-center text-xs font-medium text-jira-blue select-none animate-pulse">
              {t.board.dropHere}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-[11px] text-jira-subtle/80 italic">
                Belum ada kartu
              </p>
            </div>
          )
        )}

        {/* Quick Create Card Inline */}
        {isAdding ? (
          <form
            onSubmit={handleQuickSubmit}
            className="bg-white border border-jira-blue rounded-md p-2 shadow-card"
          >
            <textarea
              autoFocus
              rows={2}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={t.board.whatNeedsDone}
              className="w-full text-xs text-jira-text outline-none resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickSubmit(e);
                } else if (e.key === "Escape") {
                  setIsAdding(false);
                }
              }}
            />
            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
              <button
                type="submit"
                disabled={!quickTitle.trim() || isSubmitting}
                className="bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1 rounded transition"
              >
                {isSubmitting ? "Menambahkan..." : "Tambah"}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-1 text-jira-subtle hover:text-jira-text rounded"
              >
                <X size={14} />
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-1.5 px-2 flex items-center gap-1.5 text-xs font-medium text-jira-subtle hover:text-jira-text hover:bg-slate-200/60 rounded transition"
          >
            <Plus size={14} />
            <span>{t.board.createIssueInline}</span>
          </button>
        )}
      </div>
    </div>
  );
};
