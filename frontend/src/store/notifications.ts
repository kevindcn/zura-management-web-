import { create } from "zustand";

export interface NotificationItem {
  id: string;
  actorName: string;
  actorAvatar?: string;
  message: string;
  issueKey?: string;
  createdAt: string;
  isRead: boolean;
  type: "ASSIGNED" | "STATUS_CHANGED" | "COMMENT" | "MENTION" | "SPRINT";
}

interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: () => number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (item: Omit<NotificationItem, "id" | "createdAt" | "isRead">) => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif_1",
    actorName: "Sarah Connor",
    actorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=Sarah%20Connor&backgroundColor=00875a",
    message: "menugaskan work item JIRA-3 kepada Anda",
    issueKey: "JIRA-3",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
    isRead: false,
    type: "ASSIGNED",
  },
  {
    id: "notif_2",
    actorName: "David Chen",
    actorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=David%20Chen&backgroundColor=6554c0",
    message: "menambahkan komentar pada JIRA-1: 'PR sudah direview dan siap'",
    issueKey: "JIRA-1",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    isRead: false,
    type: "COMMENT",
  },
  {
    id: "notif_3",
    actorName: "Alex Morgan",
    actorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=Alex%20Morgan&backgroundColor=0c66e4",
    message: "mengubah status JIRA-2 menjadi IN PROGRESS",
    issueKey: "JIRA-2",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    isRead: true,
    type: "STATUS_CHANGED",
  },
];

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: INITIAL_NOTIFICATIONS,
  unreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
  markAsRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  },
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  },
  addNotification: (item) => {
    const newItem: NotificationItem = {
      ...item,
      id: "notif_" + Date.now(),
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    set((state) => ({
      notifications: [newItem, ...state.notifications],
    }));
  },
}));
