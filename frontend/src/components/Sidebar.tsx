import React, { useState, useEffect } from "react";
import { Project } from "../types";
import {
  Kanban,
  Layers,
  Table,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Globe,
  TrendingUp,
} from "lucide-react";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { t } from "../lib/i18n";

interface SidebarProps {
  currentProject: Project | null;
  activeView: "summary" | "board" | "list" | "backlog" | "reports" | "settings";
  onSelectView: (view: "summary" | "board" | "list" | "backlog" | "reports" | "settings") => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  activeView,
  onSelectView,
}) => {
  // Persist sidebar state & auto-collapse on small screens
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("jira_sidebar_collapsed");
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return typeof window !== "undefined" && window.innerWidth < 1024;
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jira_sidebar_collapsed", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Keyboard shortcut: Press '[' to toggle sidebar (standard Jira shortcut)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "[" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        toggleCollapsed();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const theme = getProjectTheme(currentProject?.key || "PR");
  const initials = getProjectInitials(currentProject?.name, currentProject?.key);

  return (
    <aside
      className={`relative bg-[#FAFBFC] dark:bg-jira-dark-surface border-r border-jira-border dark:border-jira-dark-border flex flex-col flex-shrink-0 select-none z-20 transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Project Header */}
      <div className="p-3 border-b border-jira-border dark:border-jira-dark-border flex items-center gap-3 overflow-hidden h-[57px] flex-shrink-0">
        <div
          className={`w-8 h-8 rounded bg-gradient-to-tr ${theme.bg} ${theme.text} flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-black/5`}
        >
          {initials}
        </div>
        <div
          className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
            collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[160px]"
          }`}
        >
          <h2 className="text-sm font-bold text-jira-text dark:text-jira-dark-text truncate whitespace-nowrap">
            {currentProject?.name || t.nav.projects}
          </h2>
          <p className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle font-medium truncate whitespace-nowrap">
            {t.nav.softwareProject} ({currentProject?.key || "PR"})
          </p>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-3 px-2 space-y-1 overflow-x-hidden overflow-y-auto">
        {/* Planning Section Header */}
        <div
          className={`px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-jira-subtle dark:text-jira-dark-subtle overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
            collapsed ? "opacity-0 max-h-0 pb-0" : "opacity-100 max-h-6"
          }`}
        >
          {t.sidebar.planning}
        </div>

        {/* Summary View */}
        <button
          onClick={() => onSelectView("summary")}
          className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          } ${
            activeView === "summary"
              ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
              : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
          }`}
          title={collapsed ? t.sidebar.summary : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Globe
              size={16}
              className={activeView === "summary" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
            />
          </div>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            {t.sidebar.summary}
          </span>
        </button>

        {/* Kanban Board */}
        <button
          onClick={() => onSelectView("board")}
          className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          } ${
            activeView === "board"
              ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
              : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
          }`}
          title={collapsed ? t.sidebar.kanbanBoard : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Kanban
              size={16}
              className={activeView === "board" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
            />
          </div>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            {t.sidebar.kanbanBoard}
          </span>
        </button>

        {/* List View */}
        <button
          onClick={() => onSelectView("list")}
          className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          } ${
            activeView === "list"
              ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
              : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
          }`}
          title={collapsed ? t.sidebar.listView : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Table
              size={16}
              className={activeView === "list" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
            />
          </div>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            {t.sidebar.listView}
          </span>
        </button>

        {/* Backlog View */}
        <button
          onClick={() => onSelectView("backlog")}
          className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          } ${
            activeView === "backlog"
              ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
              : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
          }`}
          title={collapsed ? t.sidebar.backlog : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Layers
              size={16}
              className={activeView === "backlog" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
            />
          </div>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            {t.sidebar.backlog}
          </span>
        </button>

        {/* Reports View */}
        <button
          onClick={() => onSelectView("reports")}
          className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          } ${
            activeView === "reports"
              ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
              : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
          }`}
          title={collapsed ? t.sidebar.reports : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <TrendingUp
              size={16}
              className={activeView === "reports" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
            />
          </div>
          <span
            className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            {t.sidebar.reports}
          </span>
        </button>

        {/* Roadmap (Coming soon) */}
        <button
          onClick={() => {}}
          className={`w-full flex items-center rounded-lg text-xs font-semibold text-jira-subtle dark:text-jira-dark-subtle hover:bg-slate-100 dark:hover:bg-jira-dark-hover transition-colors opacity-65 cursor-not-allowed ${
            collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
          }`}
          title="Roadmap (Coming soon in future release)"
        >
          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
            <Calendar size={16} />
          </div>
          <div
            className={`flex items-center justify-between flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
            }`}
          >
            <span className="truncate whitespace-nowrap">{t.sidebar.roadmap}</span>
            <span className="text-[9px] bg-slate-200 dark:bg-jira-dark-card text-slate-600 dark:text-jira-dark-subtle px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex-shrink-0">
              {t.sidebar.soon}
            </span>
          </div>
        </button>

        {/* Project Settings Section Header */}
        <div className="pt-4">
          <div
            className={`px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-jira-subtle dark:text-jira-dark-subtle overflow-hidden whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
              collapsed ? "opacity-0 max-h-0 pb-0" : "opacity-100 max-h-6"
            }`}
          >
            {t.sidebar.settings}
          </div>
          <button
            onClick={() => onSelectView("settings")}
            className={`w-full flex items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${
              collapsed ? "justify-center px-0 h-9" : "gap-2.5 px-2.5 py-1.5"
            } ${
              activeView === "settings"
                ? "bg-[#E9F2FF] text-jira-blue dark:bg-jira-blue/20 dark:text-blue-400"
                : "text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover"
            }`}
            title={collapsed ? t.sidebar.settings : undefined}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <Settings
                size={16}
                className={activeView === "settings" ? "text-jira-blue dark:text-blue-400" : "text-jira-subtle dark:text-jira-dark-subtle"}
              />
            </div>
            <span
              className={`truncate whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[150px]"
              }`}
            >
              {t.sidebar.settings}
            </span>
          </button>
        </div>
      </div>

      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border shadow-md flex items-center justify-center text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 hover:border-jira-blue/40 dark:hover:border-blue-400/40 hover:scale-110 active:scale-95 transition-all duration-200 z-30 cursor-pointer focus:outline-hidden"
        title={collapsed ? `${t.sidebar.expandSidebar} ([)` : `${t.sidebar.collapseSidebar} ([)`}
        aria-label={collapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
      >
        {collapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronLeft size={13} strokeWidth={2.5} />}
      </button>

      {/* Footer shortcut tip */}
      <div
        className="p-3 border-t border-jira-border dark:border-jira-dark-border text-[11px] text-jira-subtle dark:text-jira-dark-subtle flex items-center bg-slate-50/50 dark:bg-jira-dark-card/40 h-11 flex-shrink-0 overflow-hidden"
        title={collapsed ? t.sidebar.quickTips : undefined}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <Keyboard size={13} className="text-jira-blue dark:text-blue-400" />
        </div>
        <span
          className={`truncate whitespace-nowrap ml-2 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
            collapsed ? "opacity-0 max-w-0 pointer-events-none" : "opacity-100 max-w-[160px]"
          }`}
        >
          {t.sidebar.quickTips}
        </span>
      </div>
    </aside>
  );
};
