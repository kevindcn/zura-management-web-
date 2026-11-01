import {
  User,
  Project,
  Issue,
  Status,
  Comment,
  Sprint,
  SprintStatus,
  Label,
  Notification,
  SavedView,
  PaginationMeta,
  BurndownResponse,
  VelocityResponse,
  SprintReportResponse,
  RetroNotes,
} from "../types";
import { useToastStore } from "../store/toast";
import {
  useAuthStore,
  isSessionExpired,
  markSessionExpired,
  resetSessionExpiredGuard,
} from "../store/auth";

export { isSessionExpired, resetSessionExpiredGuard };

export class SessionExpiredError extends Error {
  readonly isSessionExpired = true;
  readonly status = 401;

  constructor(message = "Sesi Anda berakhir, silakan masuk kembali.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (
    (err as any).isSessionExpired === true ||
    (err as any).name === "SessionExpiredError" ||
    (err as any).status === 401
  );
}

export function handleSessionExpired(): void {
  // Thorough cleanup: clear all tokens and user info from storage
  localStorage.removeItem("zura_token");
  localStorage.removeItem("zura_user");
  localStorage.removeItem("jira_token");
  localStorage.removeItem("jira_user");

  // Reset Zustand auth state immediately and synchronously
  useAuthStore.getState().logout();

  // Debounced once-only notification per 401 wave
  if (!isSessionExpired()) {
    markSessionExpired();
    useToastStore.getState().error("Your session has expired. Please log in again.");
    window.dispatchEvent(new CustomEvent("jira_session_expired"));
  }
}

const BASE_URL = "/api";

function getToken(): string | null {
  return localStorage.getItem("zura_token") || localStorage.getItem("jira_token");
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    const isAuthRoute =
      endpoint.startsWith("/auth/login") ||
      endpoint.startsWith("/auth/register") ||
      endpoint.startsWith("/auth/demo-login");

    if (!isAuthRoute) {
      handleSessionExpired();
      throw new SessionExpiredError();
    }

    throw new Error(data?.message || "Email atau kata sandi tidak valid.");
  }

  if (response.status === 403) {
    useToastStore.getState().error("Anda tidak punya izin untuk aksi ini");
    throw new Error(data?.message || "Anda tidak punya izin untuk aksi ini");
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) => {
      resetSessionExpiredGuard();
      return apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
    },
    register: (userData: { name: string; email: string; password: string }) => {
      resetSessionExpiredGuard();
      return apiRequest<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });
    },
    me: () => apiRequest<{ user: User }>("/auth/me"),
    demoLogin: () => {
      resetSessionExpiredGuard();
      return apiRequest<{ token: string; user: User }>("/auth/demo-login", {
        method: "POST",
      });
    },
  },

  projects: {
    list: () => apiRequest<{ projects: Project[] }>("/projects"),
    get: (key: string) => apiRequest<{ project: Project }>(`/projects/${key}`),
    create: (data: { name: string; key: string; description?: string }) =>
      apiRequest<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (key: string, data: { name?: string; description?: string | null }) =>
      apiRequest<{ project: Project }>(`/projects/${key}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (key: string) =>
      apiRequest<{ message: string }>(`/projects/${key}`, {
        method: "DELETE",
      }),
    addMember: (
      key: string,
      data: { email?: string; userId?: string; role: "ADMIN" | "MEMBER" | "VIEWER" }
    ) =>
      apiRequest<{ member: any }>(`/projects/${key}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateMemberRole: (
      key: string,
      userId: string,
      role: "ADMIN" | "MEMBER" | "VIEWER"
    ) =>
      apiRequest<{ member: any }>(`/projects/${key}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    removeMember: (key: string, userId: string) =>
      apiRequest<{ message: string }>(`/projects/${key}/members/${userId}`, {
        method: "DELETE",
      }),
    getAvailableUsers: (key: string, q?: string) =>
      apiRequest<{ users: User[] }>(
        `/projects/${key}/available-users${q ? `?q=${encodeURIComponent(q)}` : ""}`
      ),
    activities: (key: string) =>
      apiRequest<{ activities: any[] }>(`/projects/${key}/activities`),
    createStatus: (
      key: string,
      data: { name: string; category?: "TO_DO" | "IN_PROGRESS" | "DONE"; position?: number }
    ) =>
      apiRequest<{ status: Status }>(`/projects/${key}/statuses`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateStatus: (
      key: string,
      statusId: string,
      data: { name?: string; category?: "TO_DO" | "IN_PROGRESS" | "DONE"; position?: number }
    ) =>
      apiRequest<{ status: Status }>(`/projects/${key}/statuses/${statusId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteStatus: (key: string, statusId: string) =>
      apiRequest<{ message: string; statusId: string }>(`/projects/${key}/statuses/${statusId}`, {
        method: "DELETE",
      }),
    reorderStatuses: (key: string, statusIds: string[]) =>
      apiRequest<{ statuses: Status[] }>(`/projects/${key}/statuses/reorder`, {
        method: "PUT",
        body: JSON.stringify({ statusIds }),
      }),
  },

  issues: {
    list: (
      projectKey: string,
      params?: {
        q?: string;
        type?: string;
        assigneeId?: string;
        statusId?: string;
        priority?: string;
        labelId?: string;
        page?: number;
        limit?: number;
      }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.type && params.type !== "ALL") searchParams.set("type", params.type);
      if (params?.assigneeId) searchParams.set("assigneeId", params.assigneeId);
      if (params?.statusId) searchParams.set("statusId", params.statusId);
      if (params?.priority && params.priority !== "ALL") searchParams.set("priority", params.priority);
      if (params?.labelId) searchParams.set("labelId", params.labelId);
      if (params?.page !== undefined) searchParams.set("page", String(params.page));
      if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

      const qs = searchParams.toString();
      return apiRequest<{ issues: Issue[]; pagination?: PaginationMeta }>(
        `/projects/${projectKey}/issues${qs ? `?${qs}` : ""}`
      );
    },
    get: (key: string) => apiRequest<{ issue: Issue }>(`/issues/${key}`),
    watch: (key: string) =>
      apiRequest<{ isWatching: boolean; watcherCount: number; message: string }>(
        `/issues/${key}/watch`,
        { method: "POST" }
      ),
    getWatchers: (key: string) =>
      apiRequest<{ watchers: User[]; watcherCount: number; isWatching: boolean }>(
        `/issues/${key}/watchers`
      ),
    create: (
      projectKey: string,
      data: {
        title: string;
        description?: string;
        type: string;
        priority: string;
        storyPoints?: number;
        statusId?: string;
        assigneeId?: string | null;
        startDate?: string | null;
        dueDate?: string | null;
        sprintId?: string | null;
      }
    ) =>
      apiRequest<{ issue: Issue }>(`/projects/${projectKey}/issues`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (key: string, data: Partial<Issue>) =>
      apiRequest<{ issue: Issue }>(`/issues/${key}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    move: (key: string, data: { statusId: string; position: number }) =>
      apiRequest<{ issue: Issue }>(`/issues/${key}/move`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (key: string) =>
      apiRequest<{ message: string }>(`/issues/${key}`, {
        method: "DELETE",
      }),
    createSubtask: (
      parentKey: string,
      data: {
        title: string;
        assigneeId?: string | null;
        priority?: string;
        statusId?: string;
      }
    ) =>
      apiRequest<{ subtask: Issue }>(`/issues/${parentKey}/subtasks`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  upload: async (
    file: File
  ): Promise<{
    url: string;
    filename: string;
    storedName: string;
    size: number;
    mimetype: string;
  }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/upload", {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      handleSessionExpired();
      throw new SessionExpiredError();
    }

    if (response.status === 403) {
      useToastStore.getState().error("Anda tidak punya izin untuk aksi ini");
      throw new Error(data?.message || "Anda tidak punya izin untuk aksi ini");
    }

    if (!response.ok) {
      throw new Error(data?.message || `Upload failed (${response.status})`);
    }

    return data;
  },

  sprints: {
    list: (projectKey: string) =>
      apiRequest<{ sprints: Sprint[] }>(`/projects/${projectKey}/sprints`),
    create: (
      projectKey: string,
      data: {
        name: string;
        goal?: string | null;
        startDate?: string | null;
        endDate?: string | null;
      }
    ) =>
      apiRequest<{ sprint: Sprint }>(`/projects/${projectKey}/sprints`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      projectKey: string,
      sprintId: string,
      data: {
        name?: string;
        goal?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        state?: SprintStatus;
      }
    ) =>
      apiRequest<{ sprint: Sprint }>(`/projects/${projectKey}/sprints/${sprintId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (projectKey: string, sprintId: string) =>
      apiRequest<{ message: string }>(`/projects/${projectKey}/sprints/${sprintId}`, {
        method: "DELETE",
      }),
    moveIssues: (
      projectKey: string,
      data: { issueIds: string[]; targetSprintId: string | null }
    ) =>
      apiRequest<{ message: string; count: number }>(
        `/projects/${projectKey}/sprints/move-issues`,
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
    complete: (
      projectKey: string,
      sprintId: string,
      data?: { targetSprintId?: string | null }
    ) =>
      apiRequest<{ message: string; sprint: Sprint }>(
        `/projects/${projectKey}/sprints/${sprintId}/complete`,
        {
          method: "POST",
          body: JSON.stringify(data || {}),
        }
      ),
  },

  comments: {
    add: (issueKey: string, body: string) =>
      apiRequest<{ comment: Comment }>(`/issues/${issueKey}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    delete: (commentId: string) =>
      apiRequest<{ message: string }>(`/comments/${commentId}`, {
        method: "DELETE",
      }),
  },

  labels: {
    list: (projectKey: string) =>
      apiRequest<{ labels: Label[] }>(`/projects/${projectKey}/labels`),
    create: (
      projectKey: string,
      data: { name: string; color?: string }
    ) =>
      apiRequest<{ label: Label }>(`/projects/${projectKey}/labels`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (projectKey: string, labelId: string) =>
      apiRequest<{ message: string }>(`/projects/${projectKey}/labels/${labelId}`, {
        method: "DELETE",
      }),
  },

  notifications: {
    list: (params?: { unreadOnly?: boolean; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.unreadOnly) q.append("unreadOnly", "true");
      if (params?.limit) q.append("limit", String(params.limit));
      const qs = q.toString() ? `?${q.toString()}` : "";
      return apiRequest<{ notifications: Notification[]; unreadCount: number }>(`/notifications${qs}`);
    },
    markAsRead: (id: string) =>
      apiRequest<{ notification: Notification }>(`/notifications/${id}/read`, {
        method: "PATCH",
      }),
    markAllAsRead: () =>
      apiRequest<{ success: boolean; count: number }>(`/notifications/mark-all-read`, {
        method: "POST",
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/notifications/${id}`, {
        method: "DELETE",
      }),
  },

  savedViews: {
    list: (projectKey: string) =>
      apiRequest<{ savedViews: SavedView[] }>(`/projects/${projectKey}/saved-views`),
    create: (
      projectKey: string,
      data: {
        name: string;
        query?: string | null;
        type?: string | null;
        priority?: string | null;
        statusId?: string | null;
        assignee?: string | null;
        isShared?: boolean;
      }
    ) =>
      apiRequest<{ savedView: SavedView }>(`/projects/${projectKey}/saved-views`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiRequest<{ message: string }>(`/saved-views/${id}`, {
        method: "DELETE",
      }),
  },

  reports: {
    burndown: (projectKey: string, sprintId: string, metric: "points" | "issues" = "points") =>
      apiRequest<BurndownResponse>(
        `/projects/${projectKey}/sprints/${sprintId}/burndown?metric=${metric}`
      ),
    velocity: (projectKey: string, sprintsCount = 6) =>
      apiRequest<VelocityResponse>(
        `/projects/${projectKey}/reports/velocity?sprints=${sprintsCount}`
      ),
    sprintReport: (projectKey: string, sprintId: string) =>
      apiRequest<SprintReportResponse>(
        `/projects/${projectKey}/sprints/${sprintId}/report`
      ),
    saveRetro: (
      projectKey: string,
      sprintId: string,
      notes: { good: string; toImprove: string; actionItems: string }
    ) =>
      apiRequest<{ message: string; retroNotes: RetroNotes }>(
        `/projects/${projectKey}/sprints/${sprintId}/retro`,
        {
          method: "PATCH",
          body: JSON.stringify(notes),
        }
      ),
  },
};

