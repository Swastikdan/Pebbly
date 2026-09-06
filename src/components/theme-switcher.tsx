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
      {/* Both icons stay in the DOM so both enter and exit animate cleanly */}
      <span
        aria-hidden="true"
        className="absolute scale-100 opacity-100 [filter:blur(0px)] transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] dark:scale-[0.25] dark:opacity-0 dark:[filter:blur(4px)]"
      >
        <Sun className="size-4.5" />
      </span>
      <span
        aria-hidden="true"
        className="scale-[0.25] opacity-0 [filter:blur(4px)] transition-[opacity,scale,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] dark:scale-100 dark:opacity-100 dark:[filter:blur(0px)]"
      >
        <Moon className="size-4.5" />
      </span>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
