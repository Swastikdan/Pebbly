import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "pebbly-theme";

const THEME_COLOR = {
  light: "#f5f5f5",
  dark: "#161616",
} as const;

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {}
  return "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDarkTheme(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark());
}

function applyThemeToDom(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  }
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  // Initialized from the stored preference (never from the DOM class) so SSR
  // markup and hydration agree; the visual theme itself lives on <html>, set
  // pre-paint by the inline head script.
  theme: readStoredTheme(),
  setTheme: (next) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    set({ theme: next });
  },
}));

/**
 * Theme state + side effects. Mount once near the app root (the subscription
 * only lives while a caller is mounted).
 *
 * The rendered toggle must never branch on this state directly — drive icon
 * visibility via CSS (`dark:` variants) so SSR output matches hydration
 * regardless of the resolved theme.
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    applyThemeToDom(isDarkTheme(useThemeStore.getState().theme));
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDom(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme };
}

export function setThemeWithTransition(next: Theme) {
  const { setTheme } = useThemeStore.getState();
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const apply = () => {
    setTheme(next);
    applyThemeToDom(isDarkTheme(next));
  };

  if (!reducedMotion && typeof document.startViewTransition === "function") {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}
