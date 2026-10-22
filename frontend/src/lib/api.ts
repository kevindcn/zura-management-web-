import { User, Project, Issue, Comment } from "../types";

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
    localStorage.removeItem("jira_token");
    window.dispatchEvent(new CustomEvent("jira_session_expired"));
    throw new Error("Sesi Anda berakhir, silakan masuk kembali.");
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiRequest<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    register: (userData: { name: string; email: string; password: string }) =>
      apiRequest<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      }),
    me: () => apiRequest<{ user: User }>("/auth/me"),
    demoLogin: () =>
      apiRequest<{ token: string; user: User }>("/auth/demo-login", {
        method: "POST",
      }),
  },

  projects: {
    list: () => apiRequest<{ projects: Project[] }>("/projects"),
    get: (key: string) => apiRequest<{ project: Project }>(`/projects/${key}`),
    create: (data: { name: string; key: string; description?: string }) =>
      apiRequest<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  issues: {
    list: (projectKey: string, params?: { q?: string; type?: string; assigneeId?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.q) searchParams.set("q", params.q);
      if (params?.type && params.type !== "ALL") searchParams.set("type", params.type);
      if (params?.assigneeId) searchParams.set("assigneeId", params.assigneeId);

      const qs = searchParams.toString();
      return apiRequest<{ issues: Issue[] }>(
        `/projects/${projectKey}/issues${qs ? `?${qs}` : ""}`
      );
    },
    get: (key: string) => apiRequest<{ issue: Issue }>(`/issues/${key}`),
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
};
