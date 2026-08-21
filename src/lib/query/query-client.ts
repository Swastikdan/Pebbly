import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// TMDB data rarely changes, so treat it as fresh for a day to
				// avoid refetch churn. gcTime, however, is what keeps *unused*
				// query data alive in memory, 24 h meant every page visited
				// (each a multi-hundred-KB detail payload) stayed resident for
				// a full day, which is what pushed tabs past 900 MB. 30 min
				// bounds memory to "pages visited in the last half hour"
				// while still making back-navigation within a session instant.
				staleTime: 24 * 60 * 60 * 1000,
				gcTime: 30 * 60 * 1000,
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	});
	return {
		queryClient,
	};
}
