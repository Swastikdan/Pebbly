const CHANNEL_NAME = "pebbly-sync";

export const MUTATION_DOMAINS = ["watchlist", "lists", "ai"] as const;
export type MutationDomain = (typeof MUTATION_DOMAINS)[number];

export function isMutationDomain(value: unknown): value is MutationDomain {
  return (
    typeof value === "string" &&
    (MUTATION_DOMAINS as readonly string[]).includes(value)
  );
}

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
  } catch {}
}

export function subscribeToCrossTabMutations(
  handler: (domain: MutationDomain) => void,
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const listener = (event: MessageEvent) => {
    if (isMutationDomain(event.data)) {
      handler(event.data);
    }
  };
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}
