/**
 * Own-mutation counters: increment ONLY on confirmed successful server writes
 * that bump the matching server revision. Under-counting is safe (a redundant
 * refetch); over-counting masks real external changes.
 *
 * Known blind spot: another device performing exactly as many writes in a
 * domain within one poll window is masked until the next unexplained delta;
 * fixing it requires per-write revision echoes.
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
	// Sibling tabs don't share this module's state, push the mutation to them
	// directly instead of waiting for the next version poll.
	broadcastMutation(domain);
}

export function takeOwnMutationCounts(): Record<MutationDomain, number> {
	const snapshot = { ...counts };
	counts.watchlist = 0;
	counts.lists = 0;
	counts.ai = 0;
	return snapshot;
}

export function hasRecentOwnMutation(windowMs = 20_000): boolean {
	return Date.now() - lastMutationAt < windowMs;
}
