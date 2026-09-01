import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { setThemeWithTransition, useThemeStore } from "@/hooks/use-theme";

/**
 * Text/icon theme toggle button for the footer or anywhere.
 * Directly toggles theme on click with no dropdown.
 */
const FooterThemeSelect = () => {
  const theme = useThemeStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className="text-muted-foreground px-2 py-1 text-sm">Theme</span>
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setThemeWithTransition(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Toggle theme. Current: ${theme}`}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors"
    >
      {isDark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      <span className="capitalize">{theme}</span>
    </button>
  );
};

export { FooterThemeSelect };
