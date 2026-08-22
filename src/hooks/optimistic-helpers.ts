import type { QueryClient } from "@tanstack/react-query";

export function createOptimisticUpdater<T, A = Record<string, unknown>>(
	getKey: (args: A) => readonly unknown[],
	updateFn: (items: T[], args: A) => T[],
) {
	return (queryClient: QueryClient, args: A) => {
		const key = getKey(args);
		const current = queryClient.getQueryData<T[]>(key) as T[] | undefined;
		// Only touch the cache when data is actually cached, writing an empty
		// array into an unfetched key would poison the optimistic state.
		if (current === undefined) return;
		queryClient.setQueryData<T[]>(key, updateFn(current, args));
	};
}

type Snapshot = { queryKey: readonly unknown[]; previous: unknown };

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
			// Restore undefined with setQueryData so mounted observers stay
			// subscribed instead of being removed and re-created (which would
			// trigger a loading/refetch cycle).
			queryClient.setQueryData(queryKey as never, previous as never);
		}
	};
}

export function setCached<T>(
	queryClient: QueryClient,
	queryKey: readonly unknown[],
	update: (current: T | undefined) => T | undefined,
) {
	const current = queryClient.getQueryData<T>(queryKey as never);
	queryClient.setQueryData<T>(queryKey as never, update(current));
}
