import { useEffect, useState } from "react";

import type { Theme } from "@/hooks/use-theme";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setThemeWithTransition, useThemeStore } from "@/hooks/use-theme";

const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/**
 * Text-only theme switcher for the footer. Renders a static placeholder on
 * the server and first paint, then swaps in the real value after mount so
 * SSR markup can never disagree with the persisted preference.
 */
const FooterThemeSelect = () => {
  const theme = useThemeStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span className="text-muted-foreground px-2 py-1">Theme</span>;
  }

  return (
    <Select
      items={THEME_OPTIONS}
      value={theme}
      onValueChange={(next) => {
        if (next) setThemeWithTransition(next as Theme);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Theme. Current: ${theme}`}
        className="text-muted-foreground hover:text-foreground w-auto min-w-0 gap-1 rounded-md border-none bg-transparent px-2 py-1 text-sm shadow-none [&_[data-slot=select-icon]]:hidden"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectPopup className="min-w-0">
        {THEME_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
};

export { FooterThemeSelect };
