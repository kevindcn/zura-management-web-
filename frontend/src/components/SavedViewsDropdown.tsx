import React, { useState, useEffect, useRef } from "react";
import { Bookmark, Plus, Trash2, Users, Check, ChevronDown, Filter, X } from "lucide-react";
import { SavedView } from "../types";
import { api } from "../lib/api";
import { useToastStore } from "../store/toast";

interface SavedViewsDropdownProps {
  projectKey: string;
  currentFilters: {
    query?: string;
    type?: string;
    priority?: string;
    assignee?: string;
    statusId?: string;
  };
  onApplyView: (view: SavedView) => void;
  onClearView?: () => void;
  activeViewId?: string | null;
}

export function SavedViewsDropdown({
  projectKey,
  currentFilters,
  onApplyView,
  onClearView,
  activeViewId,
}: SavedViewsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for saving view
  const [viewName, setViewName] = useState("");
  const [formType, setFormType] = useState<string>("ALL");
  const [formPriority, setFormPriority] = useState<string>("ALL");
  const [formAssignee, setFormAssignee] = useState<string>("ALL");
  const [formQuery, setFormQuery] = useState<string>("");
  const [isShared, setIsShared] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const toast = useToastStore();

  const loadSavedViews = async () => {
    try {
      setLoading(true);
      const res = await api.savedViews.list(projectKey);
      setSavedViews(res.savedViews);
    } catch (err) {
      console.error("Failed to load saved views:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedViews();
    }
  }, [isOpen, projectKey]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When opening the save form, pre-populate with current filters
  const handleOpenSaveForm = () => {
    setViewName("");
    setFormType(currentFilters.type && currentFilters.type !== "ALL" ? currentFilters.type : "ALL");
    setFormPriority(currentFilters.priority && currentFilters.priority !== "ALL" ? currentFilters.priority : "ALL");
    setFormAssignee(currentFilters.assignee && currentFilters.assignee !== "ALL" ? currentFilters.assignee : "ALL");
    setFormQuery(currentFilters.query || "");
    setIsShared(false);
    setIsSaving(true);
  };

  const handleSaveCurrentFilters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewName.trim()) {
      toast.error("Filter name cannot be empty.");
      return;
    }

    try {
      const payload = {
        name: viewName.trim(),
        query: formQuery.trim() ? formQuery.trim() : null,
        type: formType !== "ALL" ? formType : null,
        priority: formPriority !== "ALL" ? formPriority : null,
        assignee: formAssignee !== "ALL" ? formAssignee : null,
        statusId: currentFilters.statusId && currentFilters.statusId !== "ALL" ? currentFilters.statusId : null,
        isShared,
      };

      const res = await api.savedViews.create(projectKey, payload);

      toast.success(`Filter '${res.savedView.name}' saved successfully!`);
      setViewName("");
      setIsSaving(false);
      setSavedViews((prev) => [res.savedView, ...prev]);
      onApplyView(res.savedView);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save filter.");
    }
  };

  const handleDeleteView = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.savedViews.delete(id);
      toast.success(`Filter '${name}' deleted.`);
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      if (activeViewId === id && onClearView) {
        onClearView();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete filter.");
    }
  };

  const activeView = savedViews.find((v) => v.id === activeViewId);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-jira-dark-border shadow-xs bg-white dark:bg-jira-dark-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
            activeView
              ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
              : "text-gray-700 dark:text-jira-dark-text hover:bg-gray-50 dark:hover:bg-jira-dark-card hover:text-gray-900 dark:hover:text-white"
          }`}
          title="Saved Views"
        >
          <Bookmark size={14} className={activeView ? "text-jira-blue dark:text-blue-400 fill-jira-blue" : "text-gray-500 dark:text-jira-dark-subtle"} />
          <span>{activeView ? activeView.name : "Saved Views"}</span>
          <ChevronDown size={12} className="text-gray-400 dark:text-jira-dark-subtle ml-0.5" />
        </button>

        {activeView && onClearView && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClearView();
            }}
            className="px-1.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-jira-blue dark:text-blue-400 border-l border-blue-200 dark:border-blue-900/50 transition-colors"
            title="Clear saved view"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-88 rounded-lg bg-white dark:bg-jira-dark-surface shadow-xl border border-gray-200 dark:border-jira-dark-border z-50 overflow-hidden divide-y divide-gray-100 dark:divide-jira-dark-border animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-jira-dark-card flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-jira-dark-text">
              <Filter size={13} className="text-jira-blue dark:text-blue-400" />
              <span>Saved Views</span>
            </div>
            {!isSaving && (
              <button
                type="button"
                onClick={handleOpenSaveForm}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <Plus size={12} />
                <span>+ Save New View</span>
              </button>
            )}
          </div>

          {/* Form to save new or current view */}
          {isSaving && (
            <form onSubmit={handleSaveCurrentFilters} className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50">
              <p className="text-[11px] font-semibold text-gray-700 dark:text-jira-dark-text mb-2">
                Save Custom View:
              </p>

              {/* View Name */}
              <div className="mb-2">
                <label className="block text-[10px] font-semibold text-gray-600 dark:text-jira-dark-subtle mb-0.5">View Name *</label>
                <input
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="e.g., My high priority bugs"
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-jira-dark-border rounded bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:outline-none focus:ring-1 focus:ring-jira-blue"
                  autoFocus
                />
              </div>

              {/* Configurable Filters in Grid */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {/* Type */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 dark:text-jira-dark-subtle mb-0.5">Work Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-jira-dark-border rounded bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:outline-none focus:ring-1 focus:ring-jira-blue"
                  >
                    <option value="ALL">All Types</option>
                    <option value="BUG">Bug</option>
                    <option value="STORY">Story</option>
                    <option value="TASK">Task</option>
                    <option value="EPIC">Epic</option>
                    <option value="SUBTASK">Subtask</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 dark:text-jira-dark-subtle mb-0.5">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-jira-dark-border rounded bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:outline-none focus:ring-1 focus:ring-jira-blue"
                  >
                    <option value="ALL">All Priorities</option>
                    <option value="HIGHEST">Highest</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                    <option value="LOWEST">Lowest</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                {/* Assignee */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 dark:text-jira-dark-subtle mb-0.5">Assignee</label>
                  <select
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-jira-dark-border rounded bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:outline-none focus:ring-1 focus:ring-jira-blue"
                  >
                    <option value="ALL">All</option>
                    <option value="me">Assigned to me</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </div>

                {/* Search Text */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 dark:text-jira-dark-subtle mb-0.5">Search Keyword</label>
                  <input
                    type="text"
                    value={formQuery}
                    onChange={(e) => setFormQuery(e.target.value)}
                    placeholder="Optional..."
                    className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-jira-dark-border rounded bg-white dark:bg-jira-dark-card text-jira-text dark:text-jira-dark-text focus:outline-none focus:ring-1 focus:ring-jira-blue"
                  />
                </div>
              </div>

              {/* Shared with team */}
              <div className="flex items-center justify-between mb-2.5 pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-jira-dark-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="rounded border-gray-300 text-jira-blue focus:ring-jira-blue"
                  />
                  <span>Share with all team members</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/50">
                <button
                  type="button"
                  onClick={() => setIsSaving(false)}
                  className="px-2.5 py-1 text-xs text-gray-600 dark:text-jira-dark-subtle hover:bg-gray-200/60 dark:hover:bg-jira-dark-card rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-semibold text-white bg-jira-blue hover:bg-blue-600 rounded transition-colors shadow-xs"
                >
                  Save View
                </button>
              </div>
            </form>
          )}

          {/* List of Saved Views */}
          <div className="max-h-64 overflow-y-auto py-1">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-400 dark:text-jira-dark-subtle">Loading views...</div>
            ) : savedViews.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-jira-dark-subtle">No saved views yet.</p>
                <p className="text-[11px] text-gray-400 dark:text-jira-dark-subtle mt-1">
                  Click <strong>+ Save New View</strong> above to save your favorite filters.
                </p>
              </div>
            ) : (
              savedViews.map((sv) => {
                const isSelected = activeViewId === sv.id;
                return (
                  <div
                    key={sv.id}
                    onClick={() => {
                      onApplyView(sv);
                      setIsOpen(false);
                      toast.info(`View '${sv.name}' applied.`);
                    }}
                    className={`group px-3 py-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400 font-semibold border-l-2 border-jira-blue"
                        : "text-gray-700 dark:text-jira-dark-text hover:bg-gray-50 dark:hover:bg-jira-dark-card"
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <Check size={12} className="text-jira-blue dark:text-blue-400 shrink-0" />}
                        <span className="truncate">{sv.name}</span>
                        {sv.isShared && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0 font-normal"
                            title="Shared with all project members"
                          >
                            <Users size={9} />
                            <span>Team</span>
                          </span>
                        )}
                      </div>

                      {/* Filter badges tags */}
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-gray-500 dark:text-jira-dark-subtle">
                        {sv.type && sv.type !== "ALL" && (
                          <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded font-medium">Type: {sv.type}</span>
                        )}
                        {sv.priority && sv.priority !== "ALL" && (
                          <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-medium">Prio: {sv.priority}</span>
                        )}
                        {sv.assignee && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded font-medium">
                            {sv.assignee === "me" || sv.assignee === "MY_ISSUES" ? "Me" : sv.assignee === "unassigned" ? "Unassigned" : "User"}
                          </span>
                        )}
                        {sv.query && (
                          <span className="bg-gray-100 dark:bg-jira-dark-column text-gray-700 dark:text-jira-dark-subtle px-1.5 py-0.2 rounded italic">"{sv.query}"</span>
                        )}
                        {!sv.type && !sv.priority && !sv.assignee && !sv.query && (
                          <span className="text-gray-400 dark:text-jira-dark-subtle italic">All items</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteView(sv.id, sv.name, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-jira-dark-subtle hover:text-red-600 dark:hover:text-red-400 rounded transition-opacity"
                      title="Delete this view"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Reset / Clear Active Filter */}
          {activeView && (
            <div className="p-2.5 bg-gray-50 dark:bg-jira-dark-card flex items-center justify-between text-xs">
              <span className="text-[11px] text-gray-500 dark:text-jira-dark-subtle">Active view: <strong className="text-jira-blue dark:text-blue-400">{activeView.name}</strong></span>
              <button
                type="button"
                onClick={() => {
                  if (onClearView) onClearView();
                  setIsOpen(false);
                }}
                className="text-[11px] font-semibold text-jira-blue dark:text-blue-400 hover:underline transition-colors"
              >
                Clear active view
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
