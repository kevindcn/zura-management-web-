import React from "react";
import { IssueType } from "../types";
import { CheckSquare, Bookmark, CircleDot, Zap, GitCommit } from "lucide-react";

interface IssueTypeIconProps {
  type: IssueType;
  className?: string;
  size?: number;
  showLabel?: boolean;
}

export const IssueTypeIcon: React.FC<IssueTypeIconProps> = ({
  type,
  className = "",
  size = 15,
  showLabel = false,
}) => {
  const getConfig = () => {
    switch (type) {
      case "STORY":
        return {
          icon: Bookmark,
          color: "text-[#00875A] bg-[#E3FCEF]",
          label: "Story",
        };
      case "TASK":
        return {
          icon: CheckSquare,
          color: "text-[#0C66E4] bg-[#DEEBFF]",
          label: "Task",
        };
      case "BUG":
        return {
          icon: CircleDot,
          color: "text-[#DE350B] bg-[#FFEBE6]",
          label: "Bug",
        };
      case "EPIC":
        return {
          icon: Zap,
          color: "text-[#904EE2] bg-[#EAE6FF]",
          label: "Epic",
        };
      case "SUBTASK":
        return {
          icon: GitCommit,
          color: "text-[#00A3BF] bg-[#E6FCFF]",
          label: "Subtask",
        };
      default:
        return {
          icon: CheckSquare,
          color: "text-[#0C66E4] bg-[#DEEBFF]",
          label: type,
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`p-0.5 rounded flex items-center justify-center ${config.color}`}
        title={config.label}
      >
        <IconComponent size={size} strokeWidth={2.5} />
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-jira-text">{config.label}</span>
      )}
    </span>
  );
};
