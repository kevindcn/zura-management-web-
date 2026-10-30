import React, { useState } from "react";
import { Status, Issue } from "../types";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IssueCard } from "./IssueCard";
import { Plus, X, ChevronRight, ChevronDown, ArrowLeftRight, Trash2, MoreHorizontal, ArrowLeft, ArrowRight } from "lucide-react";
import { t } from "../lib/i18n";
import { usePermission } from "../lib/permissions";

interface KanbanColumnProps {
  status: Status;
  issues: Issue[];
  isDraggingAny?: boolean;
  onOpenDetail: (issue: Issue) => void;
  onQuickCreate: (statusId: string, title: string) => Promise<void>;
  onDeleteStatus?: (statusId: string) => Promise<void>;
  onMoveColumnLeft?: () => void;
  onMoveColumnRight?: () => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onSetWipLimit?: (statusId: string, limit: number | null) => void;
  customLimit?: number | null;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  issues,
  isDraggingAny = false,
  onOpenDetail,
  onQuickCreate,
  onDeleteStatus,
  onMoveColumnLeft,
  onMoveColumnRight,
  canMoveLeft = false,
  canMoveRight = false,
  onSetWipLimit,
  customLimit,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    data: {
      type: "Column",
      status,
    },
  });

  const { isAllowed: canCreateIssue, isViewer } = usePermission("issue:create");
  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPillHovered, setIsPillHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSettingLimit, setIsSettingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState<string>(
    customLimit !== undefined
      ? customLimit !== null
        ? String(customLimit)
        : ""
      : status.category === "IN_PROGRESS"
      ? "5"
      : ""
  );

  // WIP limit logic (e.g., custom limit or default 5 for IN_PROGRESS)
  const activeWipLimit =
    customLimit !== undefined
      ? customLimit
      : status.category === "IN_PROGRESS"
      ? 5
      : null;
  const isOverWip = activeWipLimit !== null && issues.length > activeWipLimit;

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
    if (status.name && /review/i.test(status.name)) {
      return "jira-lozenge-inreview";
    }
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
      <button
        type="button"
        id={`collapsed-column-${status.id}`}
        ref={setNodeRef}
        onClick={() => setIsCollapsed(false)}
        onMouseEnter={() => setIsPillHovered(true)}
        onMouseLeave={() => setIsPillHovered(false)}
        className={`w-8 sm:w-9 bg-[#F1F2F4] dark:bg-jira-dark-column hover:bg-[#E2E8F0] dark:hover:bg-jira-dark-hover active:bg-[#DCDFE4] border border-slate-200/90 dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle cursor-pointer rounded-xl py-3 px-1 flex flex-col items-center justify-center transition-all duration-150 select-none flex-shrink-0 shadow-2xs group ${
          isOver ? "bg-blue-50 dark:bg-blue-950/40 ring-2 ring-jira-blue/50 border-jira-blue" : ""
        }`}
        title={`Expand column ${status.name} (${issues.length})`}
      >
        {/* Status Name & Count in Jira Reference 2 orientation (top-to-bottom) */}
        <span className="[writing-mode:vertical-rl] text-slate-700 dark:text-jira-dark-text group-hover:text-slate-900 dark:group-hover:text-white font-semibold text-xs tracking-normal whitespace-nowrap inline-flex items-center gap-1.5">
          <span>{status.name}</span>
          <span className="text-slate-500 dark:text-jira-dark-subtle font-bold">{issues.length}</span>
        </span>

        {/* Expand Icon (↔) appears on hover, exactly matching Photo 2 reference */}
        <div
          className={`${
            isPillHovered ? "flex" : "hidden group-hover:flex"
          } items-center justify-center text-slate-500 dark:text-jira-dark-subtle group-hover:text-slate-800 dark:group-hover:text-jira-dark-text mt-2 transition-all flex-shrink-0`}
          aria-hidden="true"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Left arrow ← */}
            <path d="M5 5.5L2.5 8L5 10.5" />
            <path d="M2.5 8H6.5" />
            {/* Right arrow → */}
            <path d="M11 5.5L13.5 8L11 10.5" />
            <path d="M9.5 8H13.5" />
          </svg>
        </div>
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 flex flex-col bg-jira-column dark:bg-jira-dark-column rounded-md p-2.5 max-h-full transition-colors ${
        isOver ? "bg-[#E2E8F0] dark:bg-jira-dark-card ring-2 ring-jira-blue/40" : ""
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
                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold ring-1 ring-amber-300"
                : "text-jira-subtle dark:text-jira-dark-subtle bg-slate-200/80 dark:bg-jira-dark-card"
            }`}
            title={isOverWip ? t.board.wipLimitExceeded(issues.length, activeWipLimit!) : undefined}
          >
            {issues.length} {activeWipLimit ? `/ ${activeWipLimit}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Collapse Column button */}
          <button
            type="button"
            id={`collapse-column-btn-${status.id}`}
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-slate-400 dark:text-jira-dark-subtle hover:text-slate-600 dark:hover:text-jira-dark-text rounded hover:bg-slate-200/50 dark:hover:bg-jira-dark-card transition"
            title={t.board.collapseColumn}
          >
            <ChevronDown size={14} />
          </button>

          {/* Three Dots (...) Menu */}
          <div className="relative">
            <button
              type="button"
              id={`column-menu-btn-${status.id}`}
              disabled={isViewer}
              onClick={() => {
                if (isViewer) return;
                setIsMenuOpen(!isMenuOpen);
                setIsConfirmingDelete(false);
                setIsSettingLimit(false);
              }}
              className={`p-1 rounded transition ${
                isViewer
                  ? "opacity-35 cursor-not-allowed text-slate-300 dark:text-jira-dark-border hover:bg-transparent"
                  : `text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card ${
                      isMenuOpen ? "bg-slate-200 dark:bg-jira-dark-card text-slate-800 dark:text-jira-dark-text" : ""
                    }`
              }`}
              title={isViewer ? "Aksi kolom dinonaktifkan untuk role Viewer" : "Column options"}
            >
              <MoreHorizontal size={14} />
            </button>

            {!isViewer && isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsConfirmingDelete(false);
                    setIsSettingLimit(false);
                  }}
                />

                <div className="absolute right-0 top-full mt-1.5 z-40 w-48 bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-xl shadow-xl py-1.5 text-xs text-slate-700 dark:text-jira-dark-text animate-in fade-in zoom-in-95 duration-100 text-left">
                  {isConfirmingDelete ? (
                    <div className="p-2.5 flex flex-col gap-2">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-jira-dark-text">
                        Delete column <span className="font-bold text-red-600 dark:text-red-400">"{status.name}"</span>?
                      </p>
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-jira-dark-border">
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDelete(false)}
                          className="px-2 py-0.5 text-[10px] text-slate-500 dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          id={`confirm-delete-col-${status.id}`}
                          onClick={() => {
                            setIsMenuOpen(false);
                            setIsConfirmingDelete(false);
                            onDeleteStatus?.(status.id);
                          }}
                          className="px-2.5 py-0.5 text-[10px] bg-red-600 hover:bg-red-700 text-white font-semibold rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : isSettingLimit ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const val = parseInt(limitInput.trim(), 10);
                        onSetWipLimit?.(status.id, isNaN(val) || val <= 0 ? null : val);
                        setIsMenuOpen(false);
                        setIsSettingLimit(false);
                      }}
                      className="p-2.5 flex flex-col gap-2"
                    >
                      <label className="text-[11px] font-medium text-slate-700 dark:text-jira-dark-text">
                        Card limit (WIP Limit)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        autoFocus
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        placeholder="Leave empty for unlimited"
                        className="w-full text-xs px-2 py-1 bg-white dark:bg-jira-dark-card border border-slate-300 dark:border-jira-dark-border text-jira-text dark:text-jira-dark-text rounded focus:ring-1 focus:ring-jira-blue outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-jira-dark-border">
                        <button
                          type="button"
                          onClick={() => setIsSettingLimit(false)}
                          className="px-2 py-0.5 text-[10px] text-slate-500 dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-0.5 text-[10px] bg-jira-blue hover:bg-jira-blue-hover text-white font-semibold rounded"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* Set column limit */}
                      <button
                        type="button"
                        disabled={isViewer}
                        onClick={() => {
                          if (isViewer) return;
                          setIsSettingLimit(true);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-hover disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center justify-between text-slate-700 dark:text-jira-dark-text transition cursor-pointer"
                        title={isViewer ? "Aksi dinonaktifkan untuk role Viewer" : undefined}
                      >
                        <span>Set column limit</span>
                      </button>

                      <div className="h-px bg-slate-100 dark:bg-jira-dark-border my-1" />

                      {/* Move column left */}
                      <button
                        type="button"
                        disabled={isViewer || !canMoveLeft}
                        onClick={() => {
                          if (isViewer) return;
                          setIsMenuOpen(false);
                          onMoveColumnLeft?.();
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-hover disabled:opacity-35 disabled:hover:bg-transparent flex items-center justify-between text-slate-700 dark:text-jira-dark-text transition cursor-pointer disabled:cursor-not-allowed"
                        title={isViewer ? "Aksi dinonaktifkan untuk role Viewer" : undefined}
                      >
                        <span>Move column left</span>
                        <ArrowLeft size={13} className="text-slate-400" />
                      </button>

                      {/* Move column right */}
                      <button
                        type="button"
                        disabled={isViewer || !canMoveRight}
                        onClick={() => {
                          if (isViewer) return;
                          setIsMenuOpen(false);
                          onMoveColumnRight?.();
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-jira-dark-hover disabled:opacity-35 disabled:hover:bg-transparent flex items-center justify-between text-slate-700 dark:text-jira-dark-text transition cursor-pointer disabled:cursor-not-allowed"
                        title={isViewer ? "Aksi dinonaktifkan untuk role Viewer" : undefined}
                      >
                        <span>Move column right</span>
                        <ArrowRight size={13} className="text-slate-400" />
                      </button>

                      {onDeleteStatus && (
                        <>
                          <div className="h-px bg-slate-100 dark:bg-jira-dark-border my-1" />
                          {/* Delete status */}
                          <button
                            type="button"
                            disabled={isViewer || issues.length > 0}
                            onClick={() => {
                              if (isViewer) return;
                              setIsConfirmingDelete(true);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 disabled:opacity-35 disabled:hover:bg-transparent disabled:text-slate-400 flex items-center justify-between transition cursor-pointer disabled:cursor-not-allowed"
                            title={
                              isViewer
                                ? "Aksi dinonaktifkan untuk role Viewer"
                                : issues.length > 0
                                ? "Move cards out first to delete column"
                                : "Delete status column"
                            }
                          >
                            <span>Delete status</span>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
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

        {/* Drop zone */}
        {issues.length === 0 && !isAdding && (
          isDraggingAny ? (
            <div className="h-16 border-2 border-dashed border-jira-blue/50 dark:border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/20 rounded-md flex items-center justify-center text-xs font-medium text-jira-blue dark:text-blue-400 select-none animate-pulse">
              {t.board.dropHere}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle italic">
                No cards yet
              </p>
            </div>
          )
        )}

        {/* Quick Create Card Inline */}
        {isAdding ? (
          <form
            onSubmit={handleQuickSubmit}
            className="bg-white dark:bg-jira-dark-surface border border-jira-blue dark:border-blue-500 rounded-md p-2 shadow-card"
          >
            <textarea
              autoFocus
              rows={2}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={t.board.whatNeedsDone}
              className="w-full text-xs text-jira-text dark:text-jira-dark-text bg-white dark:bg-jira-dark-surface outline-none resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickSubmit(e);
                } else if (e.key === "Escape") {
                  setIsAdding(false);
                }
              }}
            />
            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-jira-dark-border">
              <button
                type="submit"
                disabled={!quickTitle.trim() || isSubmitting}
                className="bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1 rounded transition"
              >
                {isSubmitting ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="p-1 text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text rounded"
              >
                <X size={14} />
              </button>
            </div>
          </form>
        ) : canCreateIssue ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-1.5 px-2 flex items-center gap-1.5 text-xs font-medium text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-200/60 dark:hover:bg-jira-dark-card rounded transition"
          >
            <Plus size={14} />
            <span>{t.board.createIssueInline}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
