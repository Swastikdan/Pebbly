import type { QueryClient } from "@tanstack/react-query";

/**
 * Optimistic updater port for TanStack Query. `getKey(args)` resolves the
 * query key (from the keys factory), `updateFn` patches the cached array.
 */
export function createOptimisticUpdater<T, A = Record<string, unknown>>(
	getKey: (args: A) => readonly unknown[],
	updateFn: (items: T[], args: A) => T[],
) {
	return (queryClient: QueryClient, args: A) => {
		const key = getKey(args);
		const current =
			(queryClient.getQueryData<T[]>(key) as T[] | undefined) ?? [];
		queryClient.setQueryData<T[]>(key, updateFn(current, args));
	};
}

type Snapshot = { queryKey: readonly unknown[]; previous: unknown };

/**
 * Begin an optimistic update across a set of query keys: cancels in-flight
 * queries, snapshots current data, applies `apply()`, and returns a rollback
 * function (to be invoked from `onError`).
 */
export async function beginOptimistic(
	queryClient: QueryClient,
	queryKeys: readonly (readonly unknown[])[],
	apply: () => void,
): Promise<() => void> {
	await Promise.all(
		queryKeys.map((queryKey) =>
			queryClient.cancelQueries({ queryKey: queryKey as never }),
		),
	);

	const snapshots: Snapshot[] = queryKeys.map((queryKey) => ({
		queryKey,
		previous: queryClient.getQueryData(queryKey as never),
	}));

	apply();

	return () => {
		for (const { queryKey, previous } of snapshots) {
			if (previous === undefined) {
				queryClient.removeQueries({ queryKey: queryKey as never });
			} else {
				queryClient.setQueryData(queryKey as never, previous as never);
			}
		}
	};
}

/** Patch a single cached value (e.g. `getMediaState`). */
export function setCached<T>(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	update: (current: T | undefined) => T | undefined,
) {
	const current = queryClient.getQueryData<T>(queryKey as never);
	queryClient.setQueryData<T>(queryKey as never, update(current));
}
