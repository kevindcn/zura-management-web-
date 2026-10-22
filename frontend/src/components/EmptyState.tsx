import React from "react";
import { LucideIcon, Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto select-none ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-50/80 border border-blue-100 text-jira-blue flex items-center justify-center mb-3.5 shadow-sm">
        <Icon size={26} strokeWidth={1.8} />
      </div>

      <h3 className="text-sm font-bold text-jira-text tracking-tight mb-1">
        {title}
      </h3>
      <p className="text-xs text-jira-subtle leading-relaxed mb-4">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-4 py-2 rounded-md transition shadow-sm active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
