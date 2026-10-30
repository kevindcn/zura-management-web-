import React from "react";
import { useToastStore } from "../store/toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let iconColor = "text-emerald-400";
        if (toast.type === "error") {
          Icon = AlertCircle;
          iconColor = "text-rose-400";
        } else if (toast.type === "info") {
          Icon = Info;
          iconColor = "text-blue-400";
        }

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto bg-[#172B4D] text-white rounded-lg shadow-xl px-4 py-3 flex items-center justify-between gap-3 text-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Icon size={17} className={`flex-shrink-0 ${iconColor}`} />
              <span className="font-medium truncate leading-tight">
                {toast.message}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 px-1 py-0.5 rounded transition"
                >
                  {toast.action.label}
                </button>
              )}

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
