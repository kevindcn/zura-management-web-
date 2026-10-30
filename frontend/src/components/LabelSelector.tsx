import React, { useState, useEffect, useRef } from "react";
import { Label } from "../types";
import { LabelBadge } from "./LabelBadge";
import { api } from "../lib/api";
import { Plus, Check, Search, X, Loader2 } from "lucide-react";

interface LabelSelectorProps {
  labels: Label[];
  projectKey: string;
  canEdit: boolean;
  onChange: (updatedLabelNames: string[]) => void;
}

const PRESET_COLORS = [
  "#0C66E4", // Blue
  "#1F845A", // Green
  "#E56910", // Orange
  "#AE2E24", // Red
  "#8247E5", // Purple
  "#008272", // Teal
  "#C9372C", // Rose
  "#5E4DB2", // Indigo
];

export const LabelSelector: React.FC<LabelSelectorProps> = ({
  labels,
  projectKey,
  canEdit,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Load project labels when popover opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.labels
        .list(projectKey)
        .then((res) => {
          setProjectLabels(res.labels);
        })
        .catch((err) => {
          console.error("Failed to load project labels:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, projectKey]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const currentLabelNames = labels.map((l) => l.name);

  // Toggle existing label
  const handleToggleLabel = (name: string) => {
    if (currentLabelNames.includes(name)) {
      onChange(currentLabelNames.filter((n) => n !== name));
    } else {
      onChange([...currentLabelNames, name]);
    }
  };

  // Remove a label
  const handleRemove = (name: string) => {
    onChange(currentLabelNames.filter((n) => n !== name));
  };

  // Create new label
  const handleCreateLabel = async () => {
    if (!search.trim()) return;
    const trimmed = search.trim();
    try {
      setCreating(true);
      const res = await api.labels.create(projectKey, {
        name: trimmed,
        color: selectedColor,
      });

      // Add to project labels list if not there
      setProjectLabels((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, res.label];
      });

      // Add to issue labels
      if (!currentLabelNames.includes(res.label.name)) {
        onChange([...currentLabelNames, res.label.name]);
      }

      setSearch("");
    } catch (err) {
      console.error("Failed to create label:", err);
    } finally {
      setCreating(false);
    }
  };

  const filteredProjectLabels = projectLabels.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const exactMatchExists = projectLabels.some(
    (l) => l.name.toLowerCase() === search.toLowerCase().trim()
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((l) => (
          <LabelBadge
            key={l.id || l.name}
            label={l}
            onRemove={canEdit ? () => handleRemove(l.name) : undefined}
          />
        ))}

        {canEdit && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-blue dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-dashed border-jira-border dark:border-jira-dark-border hover:border-jira-blue transition"
          >
            <Plus size={11} />
            <span>Label</span>
          </button>
        )}

        {labels.length === 0 && !canEdit && (
          <span className="text-xs text-jira-subtle dark:text-jira-dark-subtle italic">No labels</span>
        )}
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-jira-dark-surface rounded-lg shadow-jira-dropdown border border-jira-border dark:border-jira-dark-border p-3 z-40 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search Input */}
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-jira-subtle dark:text-jira-dark-subtle" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!exactMatchExists && search.trim()) {
                    handleCreateLabel();
                  }
                }
              }}
              placeholder="Search or create new label..."
              className="w-full pl-7 pr-6 py-1.5 bg-slate-50 dark:bg-jira-dark-card border border-jira-border dark:border-jira-dark-border rounded text-xs text-jira-text dark:text-jira-dark-text outline-none focus:bg-white dark:focus:bg-jira-dark-surface focus:border-jira-blue transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-jira-dark-subtle hover:text-slate-600 dark:hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Color Palette for new label */}
          {search.trim() && !exactMatchExists && (
            <div className="mb-2.5 p-2 bg-slate-50 dark:bg-jira-dark-card border border-slate-200 dark:border-jira-dark-border rounded">
              <span className="block text-[10px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase mb-1.5">
                Select Label Color
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-4 h-4 rounded-full transition transform ${
                      selectedColor === c ? "ring-2 ring-offset-1 ring-slate-800 dark:ring-white scale-110" : "hover:scale-105"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Option to create new label */}
          {search.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={handleCreateLabel}
              disabled={creating}
              className="w-full text-left px-2.5 py-1.5 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-jira-blue dark:text-blue-400 rounded text-xs font-semibold flex items-center gap-1.5 mb-2 transition"
            >
              {creating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              <span className="truncate">
                Create label "<strong>{search.trim()}</strong>"
              </span>
            </button>
          )}

          {/* Existing Labels List */}
          <div className="max-h-44 overflow-y-auto space-y-1">
            <span className="block text-[10px] font-bold text-jira-subtle dark:text-jira-dark-subtle uppercase tracking-wider mb-1">
              Project Labels
            </span>
            {loading ? (
              <div className="py-3 text-center text-jira-subtle">
                <Loader2 size={14} className="animate-spin mx-auto text-jira-blue" />
              </div>
            ) : filteredProjectLabels.length === 0 ? (
              <div className="text-[11px] text-jira-subtle dark:text-jira-dark-subtle py-2 text-center">
                {search.trim() ? "Press Enter to create" : "No labels"}
              </div>
            ) : (
              filteredProjectLabels.map((l) => {
                const isSelected = currentLabelNames.includes(l.name);
                return (
                  <div
                    key={l.id}
                    onClick={() => handleToggleLabel(l.name)}
                    className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-jira-dark-card rounded cursor-pointer transition select-none"
                  >
                    <LabelBadge label={l} />
                    {isSelected && <Check size={13} className="text-jira-blue dark:text-blue-400" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
