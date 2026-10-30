import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, User as UserIcon, Check } from "lucide-react";
import { PriorityLevel, IssueType, Status, User } from "../types";
import { PriorityIcon } from "./PriorityIcon";
import { IssueTypeIcon } from "./IssueTypeIcon";

// =========================================================================
// 1. Generic CustomSelect
// =========================================================================
export interface CustomSelectOption<T = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface CustomSelectProps<T = string> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (val: T) => void;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  variant?: "standard" | "ghost";
  className?: string;
  dropdownClassName?: string;
}

export function CustomSelect<T extends string | number | null>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Select...",
  searchable = false,
  searchPlaceholder = "Search...",
  variant = "standard",
  className = "",
  dropdownClassName = "",
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, searchable]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchQuery("");
          }
        }}
        className={`flex items-center justify-between text-left transition select-none ${
          variant === "ghost"
            ? `p-1 rounded text-xs font-semibold hover:bg-slate-100 dark:hover:bg-jira-dark-hover ${
                isOpen ? "bg-slate-100 dark:bg-jira-dark-card ring-1 ring-jira-border dark:ring-jira-dark-border" : ""
              } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`
            : `w-full p-2 bg-white dark:bg-jira-dark-card border rounded text-xs font-medium shadow-sm ${
                isOpen
                  ? "border-jira-blue ring-2 ring-jira-blue/20"
                  : "border-jira-border dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle"
              } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1.5">
          {selectedOption?.icon && (
            <div className="flex-shrink-0 flex items-center justify-center">
              {selectedOption.icon}
            </div>
          )}
          <span className="truncate text-jira-text dark:text-jira-dark-text font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <div className="flex-shrink-0 ml-auto mr-1">{selectedOption.badge}</div>
          )}
        </div>
        <ChevronDown
          size={13}
          className={`text-slate-400 dark:text-jira-dark-subtle flex-shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-jira-blue dark:text-blue-400" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu (Photo 2 Reference) */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery("");
            }}
          />

          <div
            className={`absolute left-0 top-full mt-1 w-full min-w-[210px] bg-white dark:bg-jira-dark-surface border border-slate-200 dark:border-jira-dark-border rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${dropdownClassName}`}
          >
            {/* Search Box if searchable */}
            {searchable && (
              <div className="p-2 border-b border-slate-100 dark:border-jira-dark-border">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded-md text-xs focus-within:border-jira-blue focus-within:ring-1 focus-within:ring-jira-blue focus-within:bg-white dark:focus-within:bg-jira-dark-surface transition">
                  <Search size={13} className="text-slate-400 dark:text-jira-dark-subtle flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full bg-transparent outline-none text-xs text-slate-700 dark:text-jira-dark-text placeholder:text-slate-400 dark:placeholder:text-jira-dark-subtle"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                      className={`relative w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs transition cursor-pointer select-none group ${
                        isSelected
                          ? "bg-blue-50/70 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold"
                          : "text-slate-700 dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
                      }`}
                    >
                      {/* Jira Reference Photo 2: Blue vertical bar indicator on active item */}
                      {isSelected && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-jira-blue rounded-r" />
                      )}

                      {/* Icon / Avatar */}
                      {opt.icon && (
                        <div className="flex-shrink-0 flex items-center justify-center">
                          {opt.icon}
                        </div>
                      )}

                      {/* Text label & sublabel */}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] text-slate-400 dark:text-jira-dark-subtle truncate font-normal">
                            {opt.sublabel}
                          </div>
                        )}
                      </div>

                      {/* Optional Badge */}
                      {opt.badge && (
                        <div className="flex-shrink-0">{opt.badge}</div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-xs text-slate-400 dark:text-jira-dark-subtle italic text-center">
                  No results found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =========================================================================
// 2. Specialized PrioritySelect (Photo 1 & 2 Replacement)
// =========================================================================
interface PrioritySelectProps {
  value: PriorityLevel;
  onChange: (priority: PriorityLevel) => void;
  disabled?: boolean;
  variant?: "standard" | "ghost";
  className?: string;
}

export const PrioritySelect: React.FC<PrioritySelectProps> = ({
  value,
  onChange,
  disabled,
  variant = "standard",
  className = "",
}) => {
  const priorities: PriorityLevel[] = [
    "HIGHEST",
    "HIGH",
    "MEDIUM",
    "LOW",
    "LOWEST",
  ];

  const getPriorityLabel = (p: PriorityLevel) => {
    switch (p) {
      case "HIGHEST":
        return "Highest";
      case "HIGH":
        return "High";
      case "MEDIUM":
        return "Medium";
      case "LOW":
        return "Low";
      case "LOWEST":
        return "Lowest";
    }
  };

  const options: CustomSelectOption<PriorityLevel>[] = priorities.map((p) => ({
    value: p,
    label: getPriorityLabel(p),
    icon: <PriorityIcon priority={p} size={15} />,
  }));

  return (
    <CustomSelect<PriorityLevel>
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      variant={variant}
      className={className}
    />
  );
};

// =========================================================================
// 3. Specialized AssigneeSelect (Photo 2 Reference Layout)
// =========================================================================
interface AssigneeSelectProps {
  value?: string | null;
  members: User[];
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: "standard" | "ghost";
  className?: string;
}

export const AssigneeSelect: React.FC<AssigneeSelectProps> = ({
  value,
  members,
  onChange,
  disabled,
  placeholder = "Unassigned",
  variant = "standard",
  className = "",
}) => {
  const options: CustomSelectOption<string>[] = [
    {
      value: "",
      label: "Unassigned",
      icon: (
        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-jira-dark-card border border-dashed border-slate-300 dark:border-jira-dark-border flex items-center justify-center text-slate-400 dark:text-jira-dark-subtle">
          <UserIcon size={12} />
        </div>
      ),
    },
    ...members.map((m) => ({
      value: m.id,
      label: m.name,
      sublabel: m.email,
      icon: m.avatarUrl ? (
        <img
          src={m.avatarUrl}
          alt={m.name}
          className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-jira-dark-border"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-jira-blue text-white flex items-center justify-center font-bold text-[10px]">
          {m.name.charAt(0).toUpperCase()}
        </div>
      ),
    })),
  ];

  return (
    <CustomSelect<string>
      value={value || ""}
      options={options}
      onChange={(val) => onChange(val ? val : null)}
      disabled={disabled}
      placeholder={placeholder}
      searchable={members.length > 3}
      searchPlaceholder="Search team members..."
      variant={variant}
      className={className}
    />
  );
};

// =========================================================================
// 4. Specialized StatusSelect
// =========================================================================
interface StatusSelectProps {
  value: string;
  statuses: Status[];
  onChange: (statusId: string) => void;
  disabled?: boolean;
  variant?: "standard" | "ghost";
  className?: string;
}

export const StatusSelect: React.FC<StatusSelectProps> = ({
  value,
  statuses,
  onChange,
  disabled,
  variant = "standard",
  className = "",
}) => {
  const isReviewStatus = (category: string, name?: string) => {
    return (name && /review/i.test(name)) || category === "IN_REVIEW";
  };

  const getCategoryBadge = (category: string, name?: string) => {
    if (isReviewStatus(category, name)) {
      return (
        <span className="jira-lozenge jira-lozenge-inreview text-[10px]">
          In Review
        </span>
      );
    }
    switch (category) {
      case "DONE":
        return (
          <span className="jira-lozenge jira-lozenge-done text-[10px]">
            Done
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="jira-lozenge jira-lozenge-inprogress text-[10px]">
            In Progress
          </span>
        );
      case "TO_DO":
      default:
        return (
          <span className="jira-lozenge jira-lozenge-todo text-[10px]">
            To Do
          </span>
        );
    }
  };

  const getCategoryDot = (category: string, name?: string) => {
    if (isReviewStatus(category, name)) {
      return <span className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400" />;
    }
    switch (category) {
      case "DONE":
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />;
      case "IN_PROGRESS":
        return <span className="w-2.5 h-2.5 rounded-full bg-jira-blue dark:bg-blue-400" />;
      case "TO_DO":
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />;
    }
  };

  const options: CustomSelectOption<string>[] = statuses.map((st) => ({
    value: st.id,
    label: st.name,
    icon: getCategoryDot(st.category, st.name),
    badge: getCategoryBadge(st.category, st.name),
  }));

  return (
    <CustomSelect<string>
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      variant={variant}
      className={className}
    />
  );
};

// =========================================================================
// 5. Specialized IssueTypeSelect
// =========================================================================
interface IssueTypeSelectProps {
  value: IssueType;
  onChange: (type: IssueType) => void;
  disabled?: boolean;
  variant?: "standard" | "ghost";
  className?: string;
}

export const IssueTypeSelect: React.FC<IssueTypeSelectProps> = ({
  value,
  onChange,
  disabled,
  variant = "standard",
  className = "",
}) => {
  const types: IssueType[] = ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"];

  const getTypeLabel = (t: IssueType) => {
    switch (t) {
      case "STORY":
        return "Story";
      case "TASK":
        return "Task";
      case "BUG":
        return "Bug";
      case "EPIC":
        return "Epic";
      case "SUBTASK":
        return "Subtask";
    }
  };

  const options: CustomSelectOption<IssueType>[] = types.map((t) => ({
    value: t,
    label: getTypeLabel(t),
    icon: <IssueTypeIcon type={t} size={15} />,
  }));

  return (
    <CustomSelect<IssueType>
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      variant={variant}
      className={className}
    />
  );
};
