import { QueryClient } from "@tanstack/react-query";

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 24 * 60 * 60 * 1000,
				gcTime: 60 * 60 * 1000,
				retry: 0,
			},
		},
	});
	return {
		queryClient,
	};
}
