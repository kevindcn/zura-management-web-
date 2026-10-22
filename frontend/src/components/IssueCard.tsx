import React from "react";
import { Issue } from "../types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { PriorityIcon } from "./PriorityIcon";
import { MessageSquare } from "lucide-react";

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
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const commentCount = issue._count?.comments || (issue.comments ? issue.comments.length : 0);

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
      className={`group relative bg-white border rounded-[4px] p-3 shadow-card hover:shadow-card-hover transition-all cursor-pointer select-none text-left ${
        isDragging
          ? "opacity-40 border-jira-blue ring-2 ring-blue-400"
          : "border-jira-border hover:border-[#85B8FF]"
      } ${isOverlay ? "shadow-jira-modal rotate-1 scale-105 border-jira-blue" : ""}`}
    >
      {/* Title */}
      <h3 className="text-[13px] font-medium leading-snug text-jira-text group-hover:text-jira-blue transition-colors line-clamp-3 mb-2.5">
        {issue.title}
      </h3>

      {/* Footer / Meta info */}
      <div className="flex items-center justify-between gap-1 text-xs">
        {/* Left: Type + Key */}
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={issue.type} size={14} />
          <span className="font-medium text-[11px] text-jira-subtle group-hover:text-jira-text uppercase tracking-tight">
            {issue.key}
          </span>
          {commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-jira-subtle ml-1">
              <MessageSquare size={12} />
              <span>{commentCount}</span>
            </span>
          )}
        </div>

        {/* Right: Story points, Priority, Assignee */}
        <div className="flex items-center gap-2">
          {issue.storyPoints !== null && issue.storyPoints !== undefined && (
            <span
              className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px] font-bold text-jira-subtle"
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
              className="w-5 h-5 rounded-full border border-jira-border object-cover"
            />
          ) : (
            <div
              className="w-5 h-5 rounded-full bg-slate-200 border border-dashed border-slate-400 flex items-center justify-center text-[9px] text-slate-500"
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
