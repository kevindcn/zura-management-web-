import React from "react";
import { PriorityLevel } from "../types";
import {
  ChevronsUp,
  ChevronUp,
  Equal,
  ChevronDown,
  ChevronsDown,
} from "lucide-react";

interface PriorityIconProps {
  priority: PriorityLevel;
  size?: number;
  showLabel?: boolean;
}

export const PriorityIcon: React.FC<PriorityIconProps> = ({
  priority,
  size = 16,
  showLabel = false,
}) => {
  const getConfig = () => {
    switch (priority) {
      case "HIGHEST":
        return {
          icon: ChevronsUp,
          color: "text-[#DE350B]",
          label: "Highest",
        };
      case "HIGH":
        return {
          icon: ChevronUp,
          color: "text-[#FF5630]",
          label: "High",
        };
      case "MEDIUM":
        return {
          icon: Equal,
          color: "text-[#FFAB00]",
          label: "Medium",
        };
      case "LOW":
        return {
          icon: ChevronDown,
          color: "text-[#36B37E]",
          label: "Low",
        };
      case "LOWEST":
        return {
          icon: ChevronsDown,
          color: "text-[#0065FF]",
          label: "Lowest",
        };
      default:
        return {
          icon: Equal,
          color: "text-[#FFAB00]",
          label: priority,
        };
    }
  };

  const config = getConfig();
  const IconComponent = config.icon;

  return (
    <span className="inline-flex items-center gap-1.5" title={`Priority: ${config.label}`}>
      <span className={config.color}>
        <IconComponent size={size} strokeWidth={2.5} />
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-jira-text">{config.label}</span>
      )}
    </span>
  );
};
