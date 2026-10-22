import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  success: (message: string, action?: ToastAction) => string;
  error: (message: string) => string;
  info: (message: string, action?: ToastAction) => string;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = "toast_" + Math.random().toString(36).slice(2, 9);
    const duration = toast.duration ?? (toast.action ? 6000 : 4000);

    const newToast: ToastItem = { ...toast, id, duration };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  success: (message, action) => {
    return get().addToast({ type: "success", message, action });
  },
  error: (message) => {
    return get().addToast({ type: "error", message });
  },
  info: (message, action) => {
    return get().addToast({ type: "info", message, action });
  },
}));
