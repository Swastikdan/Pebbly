import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// gcTime is deliberately far below staleTime: a 24 h gcTime kept
				// every visited page's payload resident and pushed tabs past
				// 900 MB. 30 min bounds memory while back-navigation stays warm.
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
