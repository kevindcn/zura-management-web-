import React, { useState, useRef, useEffect } from "react";
import { Project } from "../types";
import { useAuthStore } from "../store/auth";
import { useNotificationStore } from "../store/notifications";
import { useThemeStore } from "../store/theme";
import { NotificationDropdown } from "./NotificationDropdown";
import {
  Grid,
  Plus,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  FolderKanban,
  UserCheck,
  X,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { getProjectTheme, getProjectInitials } from "../lib/colors";
import { ZuraLogo } from "./ZuraLogo";
import { t } from "../lib/i18n";
import { usePermission } from "../lib/permissions";

interface NavbarProps {
  currentProject: Project | null;
  projects: Project[];
  onSelectProject: (key: string) => void;
  onCreateIssueClick: () => void;
  onProjectsClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenIssue?: (key: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onCreateIssueClick,
  onProjectsClick,
  searchQuery,
  onSearchChange,
  onOpenIssue,
}) => {
  const { user, logout } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const { theme: activeTheme, setTheme } = useThemeStore();
  const { isAllowed: canCreateIssue } = usePermission("issue:create", currentProject);

  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  // Fetch notifications on mount and poll every 30s
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(() => {
        fetchNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(target)
      ) {
        setProjectDropdownOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(target)
      ) {
        setUserDropdownOpen(false);
      }
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(target)
      ) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Ctrl+K / '/' shortcut for search focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentTheme = getProjectTheme(currentProject?.key || "PR");
  const currentInitials = getProjectInitials(currentProject?.name, currentProject?.key);

  return (
    <header className="h-12 bg-white dark:bg-jira-dark-surface border-b border-jira-border dark:border-jira-dark-border px-4 flex items-center justify-between select-none z-30 sticky top-0 shadow-xs transition-colors">
      {/* Left side: Logo & Navigation */}
      <div className="flex items-center gap-2">
        <button
          className="p-1.5 text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded transition"
          title="App Switcher"
        >
          <Grid size={18} />
        </button>

        {/* Zura Brand Logo */}
        <div
          className="cursor-pointer pr-3 hover:opacity-90 transition-opacity"
          onClick={onProjectsClick}
          title="Zura — Home"
        >
          <ZuraLogo size="md" />
        </div>

        {/* Projects Dropdown */}
        <div className="relative" ref={projectDropdownRef}>
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-jira-text dark:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded transition"
          >
            <span>{t.nav.projects}</span>
            <ChevronDown size={14} className="text-jira-subtle dark:text-jira-dark-subtle" />
          </button>

          {projectDropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-dropdown border border-jira-border dark:border-jira-dark-border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle tracking-wider">
                {t.nav.currentProject}
              </div>
              {currentProject ? (
                <div className="px-3 py-1.5 flex items-center gap-2.5 bg-blue-50/70 dark:bg-blue-950/40 border-l-2 border-jira-blue">
                  <div
                    className={`w-6 h-6 rounded bg-gradient-to-tr ${currentTheme.bg} text-white flex items-center justify-center text-[10px] font-bold shadow-xs`}
                  >
                    {currentInitials}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-jira-text dark:text-jira-dark-text truncate">
                      {currentProject.name}
                    </div>
                    <div className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle">
                      {currentProject.key}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1.5 text-xs text-jira-subtle dark:text-jira-dark-subtle">
                  No active project
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-jira-dark-border my-1" />
              <div className="px-3 py-1 text-[11px] font-bold uppercase text-jira-subtle dark:text-jira-dark-subtle tracking-wider">
                {t.nav.recentProjects}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {projects.map((p) => {
                  const pTheme = getProjectTheme(p.key);
                  const pInitials = getProjectInitials(p.name, p.key);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p.key);
                        setProjectDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-jira-dark-hover transition text-xs ${
                        currentProject?.key === p.key
                          ? "font-bold text-jira-blue dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/30"
                          : "text-jira-text dark:text-jira-dark-text"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded bg-gradient-to-tr ${pTheme.bg} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0`}
                      >
                        {pInitials}
                      </div>
                      <span className="truncate flex-1">{p.name}</span>
                      <span className="text-[10px] text-jira-subtle dark:text-jira-dark-subtle font-mono">
                        {p.key}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 dark:border-jira-dark-border my-1" />
              <button
                onClick={() => {
                  onProjectsClick();
                  setProjectDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-jira-blue dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition flex items-center gap-1.5"
              >
                {t.nav.viewAllProjects}
              </button>
            </div>
          )}
        </div>

        {/* Primary Create Button (hidden for viewers) */}
        {canCreateIssue && (
          <button
            onClick={onCreateIssueClick}
            className="ml-2 flex items-center gap-1.5 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold px-3 py-1.5 rounded transition shadow-sm active:scale-95"
            title={`${t.common.create} (Press C)`}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>{t.common.create}</span>
          </button>
        )}
      </div>

      {/* Right side: Search, Notifications & User */}
      <div className="flex items-center gap-2.5">
        {/* Search Input */}
        <div className="relative w-48 lg:w-64">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-jira-dark-subtle"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search issues... (Ctrl+K)"
            className="w-full pl-8 pr-7 py-1 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue focus:ring-1 focus:ring-jira-blue rounded text-xs text-jira-text dark:text-jira-dark-text outline-none transition"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={13} />
            </button>
          ) : (
            <span className="hidden sm:inline-block absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-jira-subtle dark:text-jira-dark-subtle font-mono border border-slate-200 dark:border-jira-dark-border bg-white dark:bg-jira-dark-card px-1 rounded shadow-2xs">
              /
            </span>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifDropdownRef}>
          <button
            id="notification-bell-btn"
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="p-1.5 text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text hover:bg-slate-100 dark:hover:bg-jira-dark-hover rounded transition relative"
            title={t.nav.notifications}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-jira-blue text-white text-[10px] font-bold flex items-center justify-center absolute -top-0.5 -right-0.5 ring-2 ring-white dark:ring-jira-dark-surface shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <NotificationDropdown
            isOpen={notifDropdownOpen}
            onClose={() => setNotifDropdownOpen(false)}
            onOpenIssue={onOpenIssue}
          />
        </div>

        {/* User Profile */}
        <div className="relative" ref={userDropdownRef}>
          <button
            id="user-profile-btn"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-jira-blue/30 transition"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-full border border-jira-border dark:border-jira-dark-border object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-jira-blue text-white font-bold text-xs flex items-center justify-center">
                {user?.name?.slice(0, 1) || "U"}
              </div>
            )}
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-1 w-60 bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-dropdown border border-jira-border dark:border-jira-dark-border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-jira-dark-border">
                <div className="text-xs font-bold text-jira-text dark:text-jira-dark-text">
                  {user?.name || "User"}
                </div>
                <div className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle truncate">
                  {user?.email || ""}
                </div>
              </div>
              <div className="py-1">
                <div className="px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <UserCheck size={14} /> {t.nav.loggedInAs} {user?.name?.split(" ")[0]}
                </div>
              </div>

              {/* Theme Switcher Quick Toggle */}
              <div className="border-t border-slate-100 dark:border-jira-dark-border my-1" />
              <div className="px-3 py-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-jira-subtle dark:text-jira-dark-subtle mb-1.5">
                  Theme Mode
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-jira-dark-card p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold transition ${
                      activeTheme === "light"
                        ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-2xs"
                        : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
                    }`}
                    title="Light theme"
                  >
                    <Sun size={12} className="text-amber-500" />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold transition ${
                      activeTheme === "dark"
                        ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-2xs"
                        : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
                    }`}
                    title="Dark theme"
                  >
                    <Moon size={12} className="text-blue-400" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("system")}
                    className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold transition ${
                      activeTheme === "system"
                        ? "bg-white dark:bg-jira-dark-surface text-jira-blue dark:text-blue-400 shadow-2xs"
                        : "text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text"
                    }`}
                    title="System theme"
                  >
                    <Monitor size={12} className="text-purple-500" />
                    <span>Auto</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-jira-dark-border my-1" />
              <button
                onClick={() => {
                  logout();
                  setUserDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center gap-2 font-medium"
              >
                <LogOut size={14} />
                <span>{t.nav.logout}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
