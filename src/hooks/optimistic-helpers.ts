// biome-ignore lint/suspicious/noExplicitAny: generic optimistic updater helper for convex queries
export function createOptimisticUpdater<T, A = any>(
	// biome-ignore lint/suspicious/noExplicitAny: generic optimistic updater helper for convex queries
	queryReference: any,
	updateFn: (items: T[], args: A) => T[],
	// biome-ignore lint/suspicious/noExplicitAny: generic optimistic updater helper for convex queries
	getQueryArgs: (args: A) => any = () => ({}),
) {
	// biome-ignore lint/suspicious/noExplicitAny: generic optimistic updater helper for convex queries
	return (localStore: any, args: A) => {
		const queryArgs = getQueryArgs(args);
		const current =
			(localStore.getQuery(queryReference, queryArgs) as T[] | undefined) ?? [];
		localStore.setQuery(queryReference, queryArgs, updateFn(current, args));
	};
}
