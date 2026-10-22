import { create } from "zustand";
import { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  initialize: () => void;
}

function getStoredToken(): string | null {
  return localStorage.getItem("zura_token") || localStorage.getItem("jira_token");
}

function getStoredUser(): string | null {
  return localStorage.getItem("zura_user") || localStorage.getItem("jira_user");
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: true,

  setAuth: (user, token) => {
    localStorage.setItem("zura_token", token);
    localStorage.setItem("zura_user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  setUser: (user) => {
    localStorage.setItem("zura_user", JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem("zura_token");
    localStorage.removeItem("zura_user");
    localStorage.removeItem("jira_token");
    localStorage.removeItem("jira_user");
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  initialize: () => {
    const token = getStoredToken();
    const userStr = getStoredUser();
    let user: User | null = null;

    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (e) {
        localStorage.removeItem("zura_user");
        localStorage.removeItem("jira_user");
      }
    }

    set({
      token,
      user,
      isAuthenticated: !!token && !!user,
      isLoading: false,
    });
  },
}));
