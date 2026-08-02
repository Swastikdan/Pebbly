export function createOptimisticUpdater<T>(
	queryReference: any,
	updateFn: (items: T[], args: any) => T[],
	getQueryArgs: (args: any) => any = () => ({})
) {
	return (localStore: any, args: any) => {
		const queryArgs = getQueryArgs(args);
		const current = localStore.getQuery(queryReference, queryArgs) ?? [];
		localStore.setQuery(queryReference, queryArgs, updateFn(current, args));
	};
}
