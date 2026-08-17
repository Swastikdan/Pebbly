/**
 * Counts of this client's own successful data mutations per domain, since the
 * last data-version poll. UserSync uses these to skip invalidating a query
 * group when the observed revision delta is fully explained by the client's
 * own writes (its cache is already correct from the optimistic update + server
 * response), while still refetching for genuine external changes.
 *
 * Safety: counters are incremented ONLY on confirmed successful server writes
 * that bump the matching server-side revision. Under-counting is safe (it just
 * causes a redundant refetch); over-counting could mask a real external change,
 * so call sites must never count a write that did not actually bump the rev.
 */
export type MutationDomain = "watchlist" | "lists" | "ai";

const counts: Record<MutationDomain, number> = {
	watchlist: 0,
	lists: 0,
	ai: 0,
};

export function recordOwnMutation(domain: MutationDomain, count = 1): void {
	counts[domain] += count;
}

/** Snapshot and reset the counters (called once per version poll). */
export function takeOwnMutationCounts(): Record<MutationDomain, number> {
	const snapshot = { ...counts };
	counts.watchlist = 0;
	counts.lists = 0;
	counts.ai = 0;
	return snapshot;
}
