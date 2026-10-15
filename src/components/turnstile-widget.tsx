import { Turnstile } from "@marsidev/react-turnstile";

import type { TurnstileProps } from "@marsidev/react-turnstile";
import { useTheme } from "@/hooks/use-theme";

// Cloudflare test site key (always passes successfully)
// Used when VITE_TURNSTILE_SITE_KEY is not configured
const TEST_SITE_KEY = "1x00000000000000000000AA";

export interface AppTurnstileProps extends Omit<TurnstileProps, "siteKey"> {
  siteKey?: string;
  className?: string;
}

export function AppTurnstile({
  siteKey,
  options,
  ...props
}: AppTurnstileProps) {
  const { theme } = useTheme();
  const effectiveKey =
    siteKey ||
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
    TEST_SITE_KEY;

  const effectiveTheme =
    theme === "dark" ? "dark" : theme === "light" ? "light" : "auto";

  return (
    <Turnstile
      siteKey={effectiveKey}
      options={{
        theme: effectiveTheme,
        size: "normal",
        ...options,
      }}
      {...props}
    />
  );
}
