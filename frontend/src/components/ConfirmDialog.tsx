import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { t } from "../lib/i18n";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = t.common.confirm,
  cancelLabel = t.common.cancel,
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-white dark:bg-jira-dark-surface rounded-lg shadow-2xl border border-jira-border dark:border-jira-dark-border max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="p-5 flex items-start gap-3.5">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDestructive
                ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                : "bg-blue-50 dark:bg-blue-950/40 text-jira-blue dark:text-blue-400"
            }`}
          >
            <AlertTriangle size={19} />
          </div>

          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-jira-text dark:text-jira-dark-text leading-tight">
              {title}
            </h3>
            <p className="text-xs text-jira-subtle dark:text-jira-dark-subtle mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>

          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-jira-subtle dark:text-jira-dark-subtle hover:text-jira-text dark:hover:text-jira-dark-text p-1 rounded hover:bg-slate-100 dark:hover:bg-jira-dark-card transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-jira-dark-card px-5 py-3 border-t border-slate-100 dark:border-jira-dark-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-semibold text-jira-text dark:text-jira-dark-text hover:bg-slate-200/70 dark:hover:bg-jira-dark-column rounded transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded transition shadow-xs disabled:opacity-50 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-jira-blue hover:bg-jira-blue-hover"
            }`}
          >
            {isLoading ? t.common.deleting : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
