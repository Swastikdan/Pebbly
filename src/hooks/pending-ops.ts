import type { QueryClient } from "@tanstack/react-query";
import {
	type MutationDomain,
	recordOwnMutation,
} from "@/lib/realtime-mutations";

/**
 * Pending-op journal + reconcile for array-shaped query caches (watchlist,
 * custom lists, ...).
 *
 * Every optimistic update is registered as a *replayable* op. Server snapshots
 * (full-list refetches, write responses) are merged back through the journal:
 * still-pending ops are re-applied on top of fresh server data, so a snapshot
 * taken before a write committed can never clobber newer optimistic state. Ops
 * are dropped once their write succeeds (`resolve`), and a failed write rolls
 * back just its own op, rebuilding from the last known server state +
 * remaining ops.
 *
 * Ops that touch the same rows supersede each other (latest intent wins),
 * mirroring the server's per-item deduplication semantics.
 *
 * The journal is scoped to the `QueryClient` instance it was created for
 * (WeakMap keyed on the client, never module-level state). SSR renders a fresh
 * QueryClient per request (see `lib/query/query-client.ts`), so one request's
 * pending ops can never leak into another request's server-rendered HTML.
 */

export type PendingOpEntry<T> = {
	key: readonly unknown[];
	/** Identity strings of the rows this op touches (e.g. `"movie:123"`). */
	touchedIds: string[];
	/** Extracts an identity string from a row; defaults to `mediaType:tmdbId`. */
	idOf?: (row: T) => string;
	/** Pure patch; must be safe to re-run. */
	apply: (rows: T[]) => T[];
};

export type OpHandle = {
	/** Write succeeded: drop the op, folding its state into the server base. */
	resolve: () => void;
	/** Write failed: drop the op and rebuild from base + remaining ops. */
	remove: () => void;
};

type RegisteredEntry = {
	key: readonly unknown[];
	keyString: string;
	touchedIds: string[];
	idOf: (row: unknown) => string;
	apply: (rows: unknown[]) => unknown[];
};

type RegisteredOp = {
	seq: number;
	entries: RegisteredEntry[];
	/**
	 * Revision domain this write bumps server-side. When set, a successful
	 * resolve records the own-mutation count automatically, so call sites can
	 * never forget to count (and rollbacks record nothing). Ops whose count is
	 * taken once per batched server flush (watchlist membership) stay untagged.
	 */
	domain?: MutationDomain;
};

type JournalState = {
	/** Pending ops per key, in registration order (= seq order). */
	pendingByKey: Map<string, RegisteredOp[]>;
	/** Last known server truth per key; used to rebuild after a rollback. */
	baseByKey: Map<string, unknown[]>;
	keyByString: Map<string, readonly unknown[]>;
	seqCounter: number;
	syncTimers: Map<string, ReturnType<typeof setTimeout>>;
};

const journals = new WeakMap<QueryClient, JournalState>();

function journalFor(queryClient: QueryClient): JournalState {
	let journal = journals.get(queryClient);
	if (!journal) {
		journal = {
			pendingByKey: new Map(),
			baseByKey: new Map(),
			keyByString: new Map(),
			seqCounter: 0,
			syncTimers: new Map(),
		};
		journals.set(queryClient, journal);
	}
	return journal;
}

const keyString = (key: readonly unknown[]) => JSON.stringify(key);

const defaultIdOf = (row: unknown) => {
	const r = row as { mediaType?: unknown; tmdbId?: unknown };
	return `${String(r.mediaType)}:${String(r.tmdbId)}`;
};

function dropOp(journal: JournalState, keyString_: string, op: RegisteredOp) {
	const list = journal.pendingByKey.get(keyString_);
	if (!list) return;
	const next = list.filter((o) => o !== op);
	if (next.length === 0) journal.pendingByKey.delete(keyString_);
	else journal.pendingByKey.set(keyString_, next);
}

/** True while `op` is still registered (i.e. not superseded by a newer op). */
function isRegistered(journal: JournalState, op: RegisteredOp) {
	return op.entries.some((entry) =>
		(journal.pendingByKey.get(entry.keyString) ?? []).includes(op),
	);
}

function replay(
	journal: JournalState,
	keyString_: string,
	base: unknown[],
): unknown[] {
	let rows = base;
	for (const op of journal.pendingByKey.get(keyString_) ?? []) {
		for (const entry of op.entries) {
			if (entry.keyString === keyString_) rows = entry.apply(rows);
		}
	}
	return rows;
}

export type BeginOpOptions = {
	/** Revision domain the server write bumps; counted automatically on resolve. */
	domain?: MutationDomain;
};

export function beginOp<T>(
	queryClient: QueryClient,
	entries: PendingOpEntry<T>[],
	options?: BeginOpOptions,
): OpHandle {
	if (typeof window === "undefined") {
		throw new Error(
			"beginOp must not be called during SSR. Optimistic ops are client-only",
		);
	}
	const journal = journalFor(queryClient);
	const seq = ++journal.seqCounter;
	const op: RegisteredOp = {
		seq,
		domain: options?.domain,
		entries: entries.map((entry) => {
			const keyString_ = keyString(entry.key);
			journal.keyByString.set(keyString_, entry.key);
			return {
				key: entry.key,
				keyString: keyString_,
				touchedIds: entry.touchedIds,
				idOf:
					(entry.idOf as ((row: unknown) => string) | undefined) ?? defaultIdOf,
				apply: entry.apply as (rows: unknown[]) => unknown[],
			};
		}),
	};

	for (const entry of op.entries) {
		const existing = journal.pendingByKey.get(entry.keyString) ?? [];
		const touched = new Set(entry.touchedIds);
		for (const candidate of [...existing]) {
			const overlaps = candidate.entries.some(
				(cEntry) =>
					cEntry.keyString === entry.keyString &&
					cEntry.touchedIds.some((id) => touched.has(id)),
			);
			if (overlaps) {
				for (const cEntry of candidate.entries)
					dropOp(journal, cEntry.keyString, candidate);
			}
		}

		const list = journal.pendingByKey.get(entry.keyString) ?? [];
		list.push(op);
		journal.pendingByKey.set(entry.keyString, list);

		if (!journal.baseByKey.has(entry.keyString)) {
			const current =
				(queryClient.getQueryData(entry.key) as unknown[] | undefined) ?? [];
			journal.baseByKey.set(entry.keyString, current);
		}

		const current =
			(queryClient.getQueryData(entry.key) as unknown[] | undefined) ?? [];
		queryClient.setQueryData(entry.key, entry.apply(current));
	}

	return {
		resolve: () => resolveOp(queryClient, journal, op),
		remove: () => removeOp(queryClient, journal, op),
	};
}

function resolveOp(
	queryClient: QueryClient,
	journal: JournalState,
	op: RegisteredOp,
) {
	if (!isRegistered(journal, op)) return;
	for (const entry of op.entries) {
		dropOp(journal, entry.keyString, op);
		// The optimistic state is now server-confirmed, so fold it into the
		// base so a later rollback rebuild doesn't lose it.
		const base = journal.baseByKey.get(entry.keyString);
		if (!base || entry.touchedIds.length === 0) continue;
		const current =
			(queryClient.getQueryData(entry.key) as unknown[] | undefined) ?? [];
		const touched = new Set(entry.touchedIds);
		const nextBase = base.filter((row) => !touched.has(entry.idOf(row)));
		for (const row of current) {
			if (touched.has(entry.idOf(row))) nextBase.push(row);
		}
		journal.baseByKey.set(entry.keyString, nextBase);
	}
	if (op.domain) {
		recordOwnMutation(op.domain);
	}
}

function removeOp(
	queryClient: QueryClient,
	journal: JournalState,
	op: RegisteredOp,
) {
	if (!isRegistered(journal, op)) return;
	const affected = new Set<string>();
	for (const entry of op.entries) {
		dropOp(journal, entry.keyString, op);
		affected.add(entry.keyString);
	}
	for (const keyString_ of affected) {
		const base = journal.baseByKey.get(keyString_);
		const key = journal.keyByString.get(keyString_);
		if (!base || !key) continue;
		queryClient.setQueryData(key, replay(journal, keyString_, base));
	}
}

export function reconcileListFetch<T>(
	queryClient: QueryClient,
	key: readonly unknown[],
	fetchedRows: T[],
): T[] {
	const journal = journalFor(queryClient);
	const keyString_ = keyString(key);
	journal.keyByString.set(keyString_, key);
	journal.baseByKey.set(keyString_, fetchedRows as unknown[]);
	return replay(journal, keyString_, fetchedRows) as T[];
}

/**
 * Merge rows returned by a write into the cache. Touched items come from the
 * server; touched items missing from the response were deleted. Pending ops
 * for other items are re-applied on top.
 */
export function applyServerState<T>(
	queryClient: QueryClient,
	key: readonly unknown[],
	serverRows: T[],
	touchedIds: string[],
	idOf?: (row: T) => string,
) {
	const journal = journalFor(queryClient);
	const keyString_ = keyString(key);
	journal.keyByString.set(keyString_, key);
	const current = (queryClient.getQueryData(key) as T[] | undefined) ?? [];
	const id = idOf ?? (defaultIdOf as (row: T) => string);
	const touched = new Set(touchedIds);

	const truth = current.filter((row) => !touched.has(id(row)));
	for (const row of serverRows) {
		const idx = truth.findIndex((r) => id(r) === id(row));
		if (idx === -1) truth.push(row);
		else truth[idx] = row;
	}

	journal.baseByKey.set(keyString_, truth as unknown[]);
	queryClient.setQueryData(key, replay(journal, keyString_, truth) as T[]);
}

export function scheduleSync(
	queryClient: QueryClient,
	keys: readonly (readonly unknown[])[],
	delayMs = 250,
) {
	const journal = journalFor(queryClient);
	for (const key of keys) {
		const keyString_ = keyString(key);
		const existing = journal.syncTimers.get(keyString_);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			journal.syncTimers.delete(keyString_);
			queryClient.invalidateQueries({ queryKey: key, exact: false });
		}, delayMs);
		journal.syncTimers.set(keyString_, timer);
	}
}

export function clearPendingOps(queryClient: QueryClient) {
	const journal = journalFor(queryClient);
	journal.pendingByKey.clear();
	journal.baseByKey.clear();
	journal.keyByString.clear();
	for (const timer of journal.syncTimers.values()) clearTimeout(timer);
	journal.syncTimers.clear();
}
