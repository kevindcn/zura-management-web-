import { create } from "zustand";

export type Theme = "light" | "dark" | "system";
export type ThemeMode = Theme;

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "zura-theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(isDark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
    document.body?.classList.add("dark");
  } else {
    root.classList.remove("dark");
    document.body?.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme: Theme =
    (typeof localStorage !== "undefined" &&
      (localStorage.getItem(STORAGE_KEY) as Theme)) ||
    "light";

  const initialIsDark =
    initialTheme === "dark" || (initialTheme === "system" && getSystemPrefersDark());

  applyThemeClass(initialIsDark);

  if (typeof window !== "undefined") {
    // Listen to OS dark mode changes if user selects 'system'
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = get().theme;
      if (current === "system") {
        const dark = getSystemPrefersDark();
        applyThemeClass(dark);
        set({ isDark: dark });
      }
    };
    try {
      mediaQuery.addEventListener("change", handleChange);
    } catch {
      mediaQuery.addListener(handleChange);
    }
  }

  return {
    theme: initialTheme,
    isDark: initialIsDark,
    setTheme: (theme: Theme) => {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {
        console.error("Failed to save theme in localStorage:", e);
      }
      const isDark =
        theme === "dark" || (theme === "system" && getSystemPrefersDark());
      applyThemeClass(isDark);
      set({ theme, isDark });
    },
  };
});
