import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface DatePickerFieldProps {
  label: string;
  value?: string | null;
  disabled?: boolean;
  onChange: (val: string | null) => void;
  placeholder?: string;
  min?: string;
  max?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ISO Monday-first weekdays matching Photo 2 reference
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  disabled = false,
  onChange,
  placeholder = "Add date",
  min,
  max,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize YYYY-MM-DD
  const dateStr = value ? value.split("T")[0] : "";

  // Format DD/MM/YYYY
  const displayFormatted = dateStr
    ? (() => {
      try {
        const [y, m, d] = dateStr.split("-");
        if (y && m && d) {
          return `${d}/${m}/${y}`;
        }
        return dateStr;
      } catch {
        return dateStr;
      }
    })()
    : "";

  // Calendar view year and month
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  // When value changes, update viewDate to match
  useEffect(() => {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m] = dateStr.split("-").map(Number);
      setViewDate(new Date(y, m - 1, 1));
    }
  }, [dateStr]);

  // Smart placement: opens upward (above trigger) when near bottom, avoiding scroll & cutoff
  const calculatePlacement = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Popover is ~255px tall. If space below is less than 270px or space above > spaceBelow, open UPWARD
    if (spaceBelow < 270 || spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePlacement();
    }
  }, [isOpen]);

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Monday as first day of week (Monday = 0, Tuesday = 1... Sunday = 6)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const mondayBasedFirstDay = (firstDay + 6) % 7;

  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  // Prev month filler
  const prevDays = [];
  for (let i = mondayBasedFirstDay - 1; i >= 0; i--) {
    const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
    prevDays.push({
      day: daysInPrevMonth - i,
      month: prevM,
      year: prevY,
      isCurrentMonth: false,
    });
  }

  // Current month days
  const currentDays = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentDays.push({
      day: i,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true,
    });
  }

  // Next month filler: always fill 6 full weeks (42 cells) matching Photo 2 reference
  const totalCells = 42;
  const nextDaysCount = totalCells - (prevDays.length + currentDays.length);
  const nextDays = [];
  for (let i = 1; i <= nextDaysCount; i++) {
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
    nextDays.push({
      day: i,
      month: nextM,
      year: nextY,
      isCurrentMonth: false,
    });
  }

  const allCells = [...prevDays, ...currentDays, ...nextDays];

  const handleSelectDay = (cell: { day: number; month: number; year: number }) => {
    const y = cell.year;
    const m = String(cell.month + 1).padStart(2, "0");
    const d = String(cell.day).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setViewDate(new Date(y, now.getMonth(), 1));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Field Label & Top Clear Button */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-bold uppercase text-jira-subtle select-none">
          {label}
        </label>
        {dateStr && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-slate-400 dark:text-jira-dark-subtle hover:text-red-500 dark:hover:text-red-400 transition font-medium flex items-center gap-0.5"
            title={`Clear ${label.toLowerCase()}`}
          >
            <X size={10} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Trigger Box matching Jira reference & Zura theme */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            calculatePlacement();
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center justify-between w-full px-2.5 py-1.5 bg-white dark:bg-jira-dark-card border rounded text-xs shadow-sm transition select-none group ${isOpen
            ? "border-jira-blue ring-2 ring-jira-blue/20"
            : "border-jira-border dark:border-jira-dark-border hover:border-slate-300 dark:hover:border-jira-dark-subtle"
          } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
      >
        <span
          className={`truncate ${dateStr ? "text-jira-text dark:text-jira-dark-text font-medium" : "text-slate-400 dark:text-jira-dark-subtle"
            }`}
        >
          {dateStr ? displayFormatted : placeholder}
        </span>

        <Calendar
          size={14}
          className={`flex-shrink-0 transition ml-2 ${isOpen || dateStr
              ? "text-jira-blue dark:text-blue-400"
              : "text-jira-subtle dark:text-jira-dark-subtle group-hover:text-jira-blue dark:group-hover:text-blue-400"
            }`}
        />
      </button>

      {/* Custom Modern Zura Calendar Popover (Photo 2 Reference Layout & Positioning) */}
      {isOpen && (
        <>
          {/* Transparent Backdrop for clean click-outside closing */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`absolute right-0 z-50 w-[268px] bg-white dark:bg-jira-dark-surface border border-slate-200/90 dark:border-jira-dark-border rounded-xl shadow-2xl p-3 select-none animate-in fade-in zoom-in-95 duration-100 ${placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
              }`}
          >
            {/* Header: « < Month Year > » matching Photo 2 reference */}
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-jira-dark-border">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setViewDate(new Date(currentYear - 1, currentMonth, 1))
                  }
                  className="p-1 hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text transition"
                  title="Previous Year"
                >
                  <ChevronsLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setViewDate(new Date(currentYear, currentMonth - 1, 1))
                  }
                  className="p-1 hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text transition"
                  title="Previous Month"
                >
                  <ChevronLeft size={13} />
                </button>
              </div>

              <span className="text-xs font-bold text-slate-800 dark:text-jira-dark-text tracking-tight">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setViewDate(new Date(currentYear, currentMonth + 1, 1))
                  }
                  className="p-1 hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text transition"
                  title="Next Month"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setViewDate(new Date(currentYear + 1, currentMonth, 1))
                  }
                  className="p-1 hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded text-slate-400 dark:text-jira-dark-subtle hover:text-slate-700 dark:hover:text-jira-dark-text transition"
                  title="Next Year"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>

            {/* Day of Week Headers: Mon Tue Wed Thu Fri Sat Sun (Photo 2) */}
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400 dark:text-jira-dark-subtle mb-1">
              {DAY_NAMES.map((name) => (
                <div key={name} className="h-6 flex items-center justify-center">
                  <span>{name}</span>
                </div>
              ))}
            </div>

            {/* Calendar Days Grid: 7 columns x 6 rows matching Photo 2 */}
            <div className="grid grid-cols-7 gap-0.5">
              {allCells.map((cell, idx) => {
                const y = cell.year;
                const m = String(cell.month + 1).padStart(2, "0");
                const d = String(cell.day).padStart(2, "0");
                const cellIso = `${y}-${m}-${d}`;

                const isSelected = cellIso === dateStr;
                const isToday = cellIso === todayStr;

                const isBeforeMin = min ? cellIso < min.split("T")[0] : false;
                const isAfterMax = max ? cellIso > max.split("T")[0] : false;
                const isDisabledCell = isBeforeMin || isAfterMax;

                return (
                  <button
                    key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                    type="button"
                    disabled={isDisabledCell}
                    onClick={() => handleSelectDay(cell)}
                    className={`h-7 w-full rounded-md flex items-center justify-center text-xs transition relative font-medium ${isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-bold after:absolute after:bottom-1 after:left-1.5 after:right-1.5 after:h-[2px] after:bg-jira-blue after:rounded-full shadow-xs"
                        : isToday
                          ? "text-jira-blue dark:text-blue-400 font-bold border border-jira-blue/50 bg-blue-50/40 dark:bg-blue-950/20"
                          : cell.isCurrentMonth
                            ? "text-slate-700 dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
                            : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-jira-dark-hover/50"
                      } ${isDisabledCell
                        ? "opacity-25 cursor-not-allowed pointer-events-none"
                        : "cursor-pointer"
                      }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Subtle Footer: Today & Clear */}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-between text-[11px] px-1">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-slate-500 dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 transition font-medium"
              >
                Today
              </button>
              {dateStr && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-400 dark:text-jira-dark-subtle hover:text-red-500 dark:hover:text-red-400 transition font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
