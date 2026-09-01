import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setThemeWithTransition } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Toggle light and dark mode"
      title="Toggle theme"
      className={cn("pressable cursor-pointer", className)}
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setThemeWithTransition(isDark ? "light" : "dark");
      }}
    >
      <Sun className="size-4.5 scale-100 rotate-0 transition-transform duration-200 dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4.5 scale-0 rotate-90 transition-transform duration-200 dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
