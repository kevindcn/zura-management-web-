import React from "react";
import { Issue } from "../types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { MessageSquare, CheckSquare, Calendar, Paperclip } from "lucide-react";
import { LabelBadge } from "./LabelBadge";
import { usePermission } from "../lib/permissions";

const isOverdue = (dueStr?: string | null, statusCategory?: string) => {
  if (!dueStr || statusCategory === "DONE") return false;
  return new Date(dueStr) < new Date(new Date().setHours(0, 0, 0, 0));
};

// Extract first image from description to display as card cover
const extractFirstImage = (desc?: string | null): string | null => {
  if (!desc) return null;
  const match = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const hasAttachment = (desc?: string | null): boolean => {
  if (!desc) return false;
  return (
    /<img\b[^>]*>/i.test(desc) ||
    /href=["']\/uploads\//i.test(desc) ||
    /📎/.test(desc)
  );
};

interface IssueCardProps {
  issue: Issue;
  onOpenDetail: (issue: Issue) => void;
  isOverlay?: boolean;
}

export const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  onOpenDetail,
  isOverlay = false,
}) => {
  const { isAllowed: canMove } = usePermission("issue:move");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: {
      type: "Issue",
      issue,
    },
    disabled: isOverlay || !canMove,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commentCount = issue._count?.comments || (issue.comments ? issue.comments.length : 0);
  const coverImage = extractFirstImage(issue.description);
  const hasFiles = hasAttachment(issue.description);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent triggering detail modal when dragging
        if (!isDragging) {
          onOpenDetail(issue);
        }
      }}
      className={`group relative bg-white dark:bg-jira-dark-card border rounded-[4px] p-3 shadow-card hover:shadow-card-hover transition-all cursor-pointer select-none text-left ${
        isDragging
          ? "opacity-40 border-jira-blue ring-2 ring-blue-400"
          : "border-jira-border dark:border-jira-dark-border hover:border-[#85B8FF] dark:hover:border-jira-blue"
      } ${isOverlay ? "shadow-jira-modal rotate-1 scale-105 border-jira-blue" : ""}`}
    >
      {/* Cover image preview if present */}
      {coverImage && (
        <div className="mb-2.5 -mx-3 -mt-3 rounded-t-[4px] overflow-hidden max-h-36 bg-slate-100 dark:bg-jira-dark-column flex items-center justify-center border-b border-jira-border dark:border-jira-dark-border">
          <img
            src={coverImage}
            alt="Card cover"
            className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-200"
            loading="lazy"
          />
        </div>
      )}

      {/* Title */}
      <h3 className="text-[13px] font-medium leading-snug text-jira-text dark:text-jira-dark-text group-hover:text-jira-blue dark:group-hover:text-blue-400 transition-colors line-clamp-3 mb-2.5">
        {issue.title}
      </h3>

      {/* Labels if any */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {issue.labels.slice(0, 3).map((l) => (
            <LabelBadge key={l.id || l.name} label={l} size="sm" />
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[9px] text-jira-subtle dark:text-jira-dark-subtle font-bold self-center">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer / Meta info */}
      <div className="flex items-center justify-between gap-1 text-xs">
        {/* Left: Type + Key */}
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} size={14} />
          <span className="font-medium text-[11px] text-jira-subtle dark:text-jira-dark-subtle group-hover:text-jira-text dark:group-hover:text-jira-dark-text uppercase tracking-tight">
            {issue.key}
          </span>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-jira-subtle dark:text-jira-dark-subtle ml-1">
              <MessageSquare size={12} />
              <span>{commentCount}</span>
            </span>
          )}
          {hasFiles && (
            <span
              className="flex items-center gap-0.5 text-[11px] text-jira-subtle dark:text-jira-dark-subtle ml-1"
              title="Has file/image attachments"
            >
              <Paperclip size={12} />
            </span>
          )}

          {/* Subtasks Progress */}
          {issue.children && issue.children.length > 0 && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold text-jira-subtle dark:text-jira-dark-subtle bg-slate-100/90 dark:bg-jira-dark-column px-1.5 py-0.2 rounded border border-slate-200 dark:border-jira-dark-border ml-1"
              title={`Subtasks: ${
                issue.children.filter((c) => c.status?.category === "DONE").length
              } of ${issue.children.length} completed`}
            >
              <CheckSquare
                size={11}
                className={
                  issue.children.filter((c) => c.status?.category === "DONE").length ===
                  issue.children.length
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-500 dark:text-slate-400"
                }
              />
              <span>
                {issue.children.filter((c) => c.status?.category === "DONE").length}/
                {issue.children.length}
              </span>
            </span>
          )}
        </div>

        {/* Right: Due Date, Story points, Priority, Assignee */}
        <div className="flex items-center gap-1.5">
          {issue.dueDate && (
            <span
              className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                isOverdue(issue.dueDate, issue.status?.category)
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50"
                  : "text-jira-subtle dark:text-jira-dark-subtle bg-slate-50 dark:bg-jira-dark-column border border-slate-200 dark:border-jira-dark-border"
              }`}
              title={`Due date: ${new Date(issue.dueDate).toLocaleDateString()}`}
            >
              <Calendar size={10} />
              <span>
                {new Date(issue.dueDate).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </span>
          )}

          {issue.storyPoints !== null && issue.storyPoints !== undefined && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-slate-100 dark:bg-jira-dark-column text-[10px] font-bold text-jira-subtle dark:text-jira-dark-subtle tabular-nums leading-none"
              title={`Story Points: ${issue.storyPoints}`}
            >
              {issue.storyPoints}
            </span>
          )}

          <PriorityIcon priority={issue.priority} size={15} />

          {issue.assignee ? (
            <img
              src={
                issue.assignee.avatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                  issue.assignee.name
                )}`
              }
              alt={issue.assignee.name}
              title={`Assignee: ${issue.assignee.name}`}
              className="w-5 h-5 rounded-full border border-jira-border dark:border-jira-dark-border object-cover"
            />
          ) : (
            <div
              className="w-5 h-5 rounded-full bg-slate-200 dark:bg-jira-dark-column border border-dashed border-slate-400 dark:border-jira-dark-border flex items-center justify-center text-[9px] text-slate-500 dark:text-jira-dark-subtle"
              title="Unassigned"
            >
              ?
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
