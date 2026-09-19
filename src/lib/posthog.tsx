import { useUser } from "@clerk/react";
import {
  PostHogProvider as PostHogProviderBase,
  usePostHog,
} from "@posthog/react";
import { useEffect, useRef } from "react";

import { IS_DEV_BUILD } from "@/constants";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// A missing key must never break the app: init stays guarded behind the key and
// every capture becomes a no-op. Development still fails loudly, because a
// silent miss looks exactly like a healthy-but-idle project.
if (IS_DEV_BUILD && !POSTHOG_KEY) {
  console.error(
    "VITE_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_KEY is configured",
  );
}

/**
 * Wraps the app with PostHog product analytics. With `defaults` set, the SDK
 * captures pageviews (including client-side route changes), autocaptured
 * interactions, and web vitals on its own. When no key is configured the
 * provider is skipped, so the app renders normally without analytics.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProviderBase
      apiKey={POSTHOG_KEY}
      options={{
        api_host: POSTHOG_HOST,
        defaults: "2025-05-24",
        capture_exceptions: true,
        debug: IS_DEV_BUILD,
      }}
    >
      <ClerkIdentity />
      {children}
    </PostHogProviderBase>
  );
}

/**
 * Links captured events to the signed-in Clerk user, and resets the identity
 * on sign-out so the next person on a shared browser starts anonymous.
 */
function ClerkIdentity() {
  const posthog = usePostHog();
  const { isLoaded, isSignedIn, user } = useUser();
  const wasSignedIn = useRef(false);

  const userId = user?.id;
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName ?? undefined;

  // Depend on the identity fields, not the Clerk `user` object: its reference
  // changes on every session refresh, which would re-fire `identify` needlessly.
  useEffect(() => {
    if (!posthog || !isLoaded) return;
    if (isSignedIn && userId) {
      posthog.identify(userId, { email, name });
      wasSignedIn.current = true;
    } else if (wasSignedIn.current) {
      posthog.reset();
      wasSignedIn.current = false;
    }
  }, [posthog, isLoaded, isSignedIn, userId, email, name]);

  return null;
}
