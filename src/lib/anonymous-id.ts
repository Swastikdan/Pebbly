const ANONYMOUS_ID_KEY = "pebbly:anonymous-id";

/**
 * Return the browser's stable Pebbly visitor ID, creating it on first use.
 * This deliberately lives outside PostHog's storage so the same ID can be
 * reused when a visitor signs out and PostHog's own persistence changes.
 */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";

  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const existingId = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existingId) return existingId;
    window.localStorage.setItem(ANONYMOUS_ID_KEY, id);
  } catch {
    // Private browsing or blocked storage should not disable analytics.
  }

  return id;
}
