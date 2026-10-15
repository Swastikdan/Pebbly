import { Turnstile } from "@marsidev/react-turnstile";

import type { TurnstileProps } from "@marsidev/react-turnstile";
import { useTheme } from "@/hooks/use-theme";

// Cloudflare test site key (always passes successfully). Only permitted in
// development/test builds; production requires a real VITE_TURNSTILE_SITE_KEY.
const TEST_SITE_KEY = "1x00000000000000000000AA";

function isDevOrTestBuild(): boolean {
  return import.meta.env.DEV === true || import.meta.env.MODE === "test";
}

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
  const configuredKey =
    siteKey || (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);
  if (!configuredKey && !isDevOrTestBuild()) {
    throw new Error(
      "VITE_TURNSTILE_SITE_KEY is required in production; refusing to render the test widget.",
    );
  }
  const effectiveKey = configuredKey || TEST_SITE_KEY;

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
