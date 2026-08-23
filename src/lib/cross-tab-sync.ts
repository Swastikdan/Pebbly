/**
 * Cross-tab realtime sync over BroadcastChannel. When a tab records a
 * successful mutation it broadcasts the domain; sibling tabs invalidate the
 * matching query groups immediately instead of waiting up to a full version
 * poll to discover the change via the server. Same-browser only (no server
 * cost), and it removes the own-mutation masking blind spot between tabs.
 */
const CHANNEL_NAME = "pebbly-sync";

export type MutationDomain = "watchlist" | "lists" | "ai";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (
    typeof window === "undefined" ||
    typeof BroadcastChannel === "undefined"
  ) {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return channel;
}

export function broadcastMutation(domain: MutationDomain): void {
  try {
    getChannel()?.postMessage(domain);
  } catch {
    // A closed or failing channel must never break the mutation itself.
  }
}

/** Listen for mutations from sibling tabs. Returns an unsubscribe function. */
export function subscribeToCrossTabMutations(
  handler: (domain: MutationDomain) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const listener = (event: MessageEvent) => {
    if (
      event.data === "watchlist" ||
      event.data === "lists" ||
      event.data === "ai"
    ) {
      handler(event.data as MutationDomain);
    }
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
