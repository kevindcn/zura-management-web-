import { create } from "zustand";
import { api } from "../lib/api";

export interface NotificationItem {
  id: string;
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  issueKey?: string;
  projectId?: string;
  createdAt: string;
  isRead: boolean;
  type: "ASSIGNED" | "STATUS_CHANGED" | "COMMENT" | "MENTION" | "SPRINT";
  title?: string;
}

interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    try {
      set({ isLoading: true });
      const res = await api.notifications.list();
      set({
        notifications: res.notifications as NotificationItem[],
        unreadCount: res.unreadCount,
        isLoading: false,
      });
    } catch (err) {
      // In case user is not logged in or offline, fail gracefully
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    const prevNotifs = get().notifications;
    const target = prevNotifs.find((n) => n.id === id);
    const wasUnread = target && !target.isRead;

    set({
      notifications: prevNotifs.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount,
    });

    try {
      await api.notifications.markAsRead(id);
    } catch (err) {
      // Revert if API fails
      set({ notifications: prevNotifs });
    }
  },

  markAllAsRead: async () => {
    // Optimistic update
    const prevNotifs = get().notifications;
    set({
      notifications: prevNotifs.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    });

    try {
      await api.notifications.markAllAsRead();
    } catch (err) {
      set({ notifications: prevNotifs });
    }
  },

  deleteNotification: async (id: string) => {
    const prevNotifs = get().notifications;
    const target = prevNotifs.find((n) => n.id === id);
    const wasUnread = target && !target.isRead;

    set({
      notifications: prevNotifs.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount,
    });

    try {
      await api.notifications.delete(id);
    } catch (err) {
      set({ notifications: prevNotifs });
    }
  },
}));
