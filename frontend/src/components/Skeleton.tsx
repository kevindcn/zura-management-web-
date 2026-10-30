import React from "react";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 dark:bg-jira-dark-card rounded ${className}`}
      aria-hidden="true"
    />
  );
};

export const BoardSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden select-none">
      {[1, 2, 3, 4].map((col) => (
        <div
          key={col}
          className="w-72 flex-shrink-0 bg-jira-column dark:bg-jira-dark-column rounded-md p-3 flex flex-col space-y-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>

          {/* Cards */}
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white dark:bg-jira-dark-card rounded-md p-3.5 border border-jira-border dark:border-jira-dark-border shadow-card space-y-2.5"
            >
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-4 rounded-xs" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export const DetailSkeleton: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-20" />
      </div>
      <Skeleton className="h-7 w-4/5" />
      <div className="grid grid-cols-3 gap-6 pt-2">
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
};
