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
 *
 * Known blind spot: if another device performs exactly as many writes in a
 * domain as this client does within a single poll window, the observed delta
 * equals the own-mutation count and the external change is masked until the
 * next poll that shows an unexplained delta. The window is one poll interval
 * (and shrinks to the fast-lane interval right after own activity), so the
 * exposure is bounded; fixing it properly requires per-write revision echoes.
 */

import type { MutationDomain } from "@/lib/cross-tab-sync";
import { broadcastMutation } from "@/lib/cross-tab-sync";

export type { MutationDomain };

const counts: Record<MutationDomain, number> = {
  watchlist: 0,
  lists: 0,
  ai: 0,
};

let lastMutationAt = 0;

export function recordOwnMutation(domain: MutationDomain, count = 1): void {
  counts[domain] += count;
  lastMutationAt = Date.now();
  // Sibling tabs don't share this module's state, so push the mutation to
  // them directly instead of letting them wait for the next version poll.
  broadcastMutation(domain);
}

/** Snapshot and reset the counters (called once per version poll). */
export function takeOwnMutationCounts(): Record<MutationDomain, number> {
  const snapshot = { ...counts };
  counts.watchlist = 0;
  counts.lists = 0;
  counts.ai = 0;
  return snapshot;
}

/**
 * True while this client is actively mutating data. UserSync polls faster in
 * this window so follow-up external changes converge quickly, then settles
 * back to the slow idle cadence.
 */
export function hasRecentOwnMutation(windowMs = 20_000): boolean {
  return Date.now() - lastMutationAt < windowMs;
}
