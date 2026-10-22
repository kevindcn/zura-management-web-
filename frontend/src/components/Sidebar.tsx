import React, { useState } from "react";
import { Project } from "../types";
import {
  Kanban,
  Layers,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  Keyboard,
} from "lucide-react";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { t } from "../lib/i18n";

interface SidebarProps {
  currentProject: Project | null;
  activeView: "board" | "backlog" | "settings";
  onSelectView: (view: "board" | "backlog" | "settings") => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  activeView,
  onSelectView,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const theme = getProjectTheme(currentProject?.key || "PR");
  const initials = getProjectInitials(currentProject?.name, currentProject?.key);

  return (
    <aside
      className={`relative bg-[#FAFBFC] border-r border-jira-border flex flex-col transition-all duration-200 select-none z-20 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      {/* Project Header */}
      <div className="p-3 border-b border-jira-border flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded bg-gradient-to-tr ${theme.bg} ${theme.text} flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm ring-1 ring-black/5`}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-jira-text truncate">
              {currentProject?.name || t.nav.projects}
            </h2>
            <p className="text-[11px] text-jira-subtle font-medium">
              {t.nav.softwareProject} ({currentProject?.key || "PR"})
            </p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <div className="flex-1 py-3 px-2 space-y-1">
        {!collapsed && (
          <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-jira-subtle">
            {t.sidebar.planning}
          </div>
        )}

        <button
          onClick={() => onSelectView("board")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-semibold transition ${
            activeView === "board"
              ? "bg-[#E9F2FF] text-jira-blue"
              : "text-jira-text hover:bg-slate-100"
          }`}
          title={t.sidebar.kanbanBoard}
        >
          <Kanban
            size={16}
            className={activeView === "board" ? "text-jira-blue" : "text-jira-subtle"}
          />
          {!collapsed && <span>{t.sidebar.kanbanBoard}</span>}
        </button>

        <button
          onClick={() => onSelectView("backlog")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-semibold transition ${
            activeView === "backlog"
              ? "bg-[#E9F2FF] text-jira-blue"
              : "text-jira-text hover:bg-slate-100"
          }`}
          title={t.sidebar.backlog}
        >
          <Layers
            size={16}
            className={activeView === "backlog" ? "text-jira-blue" : "text-jira-subtle"}
          />
          {!collapsed && <span>{t.sidebar.backlog}</span>}
        </button>

        <button
          onClick={() => {}}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-semibold text-jira-subtle hover:bg-slate-100 transition opacity-65 cursor-not-allowed group"
          title="Roadmap (Akan hadir pada tahap berikutnya)"
        >
          <Calendar size={16} />
          {!collapsed && (
            <div className="flex items-center justify-between flex-1">
              <span>{t.sidebar.roadmap}</span>
              <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                {t.sidebar.soon}
              </span>
            </div>
          )}
        </button>

        <div className="pt-4">
          {!collapsed && (
            <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-jira-subtle">
              {t.sidebar.settings}
            </div>
          )}
          <button
            onClick={() => onSelectView("settings")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs font-semibold transition ${
              activeView === "settings"
                ? "bg-[#E9F2FF] text-jira-blue"
                : "text-jira-text hover:bg-slate-100"
            }`}
            title={t.sidebar.settings}
          >
            <Settings
              size={16}
              className={activeView === "settings" ? "text-jira-blue" : "text-jira-subtle"}
            />
            {!collapsed && <span>{t.sidebar.settings}</span>}
          </button>
        </div>
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-jira-border shadow-sm flex items-center justify-center text-jira-subtle hover:text-jira-text hover:bg-slate-50 transition z-30"
        title={collapsed ? t.sidebar.expandSidebar : t.sidebar.collapseSidebar}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Clean footer without MVP internal label */}
      {!collapsed && (
        <div className="p-3 border-t border-jira-border text-[11px] text-jira-subtle flex items-center gap-2 bg-slate-50/50">
          <Keyboard size={13} className="text-jira-blue" />
          <span className="truncate">{t.sidebar.quickTips}</span>
        </div>
      )}
    </aside>
  );
};
