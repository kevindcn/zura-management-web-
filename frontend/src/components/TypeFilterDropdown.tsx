import React, { useState, useEffect, useRef } from "react";
import { Shapes, ChevronDown, Check, X } from "lucide-react";
import { IssueType } from "../types";
import { IssueTypeIcon } from "./IssueTypeIcon";
import { t } from "../lib/i18n";

export interface TypeFilterDropdownProps {
  selectedType: IssueType | "ALL";
  onSelectType: (type: IssueType | "ALL") => void;
  className?: string;
  labelPrefix?: string;
}

const TYPE_OPTIONS: Array<{ key: IssueType | "ALL"; label: string }> = [
  { key: "ALL", label: t.board.allTypes || "All Types" },
  { key: "EPIC", label: t.issue.types.EPIC },
  { key: "STORY", label: t.issue.types.STORY },
  { key: "TASK", label: t.issue.types.TASK },
  { key: "BUG", label: t.issue.types.BUG },
  { key: "SUBTASK", label: t.issue.types.SUBTASK },
];

export function TypeFilterDropdown({
  selectedType,
  onSelectType,
  className = "",
  labelPrefix = "Type",
}: TypeFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isFiltered = selectedType !== "ALL";
  const activeLabel = isFiltered ? t.issue.types[selectedType] : null;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-jira-dark-border shadow-xs bg-white dark:bg-jira-dark-surface overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            isFiltered
              ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
              : "text-gray-700 dark:text-jira-dark-text hover:bg-gray-50 dark:hover:bg-jira-dark-card hover:text-gray-900 dark:hover:text-white"
          }`}
          title="Filter by work item type (Epic, Story, Task, Bug, Subtask)"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {isFiltered ? (
            <IssueTypeIcon type={selectedType} size={13} />
          ) : (
            <Shapes size={14} className="text-gray-500 dark:text-jira-dark-subtle" />
          )}

          <span>
            {isFiltered ? `${labelPrefix}: ${activeLabel}` : labelPrefix}
          </span>

          <ChevronDown
            size={12}
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            } ${isFiltered ? "text-jira-blue dark:text-blue-400" : "text-gray-400 dark:text-jira-dark-subtle"}`}
          />
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectType("ALL");
            }}
            className="px-1.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-jira-blue dark:text-blue-400 border-l border-blue-200 dark:border-blue-900/50 transition-colors"
            title="Clear type filter"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-48 rounded-lg bg-white dark:bg-jira-dark-surface shadow-xl border border-gray-200 dark:border-jira-dark-border z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="py-0.5">
            {TYPE_OPTIONS.map((option) => {
              const isSelected = selectedType === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    onSelectType(option.key);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                      : "text-gray-700 dark:text-jira-dark-text hover:bg-gray-100 dark:hover:bg-jira-dark-card hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {option.key === "ALL" ? (
                      <span className="p-0.5 rounded flex items-center justify-center text-slate-500 dark:text-jira-dark-subtle bg-slate-100 dark:bg-jira-dark-column">
                        <Shapes size={13} strokeWidth={2.2} />
                      </span>
                    ) : (
                      <IssueTypeIcon type={option.key} size={13} />
                    )}
                    <span>{option.label}</span>
                  </div>

                  {isSelected && (
                    <Check size={14} className="text-jira-blue dark:text-blue-400 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
