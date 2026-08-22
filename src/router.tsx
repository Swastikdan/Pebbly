import { ClerkProvider } from "@clerk/react";
import { shadcn } from "@clerk/ui/themes";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultLoader } from "@/components/default-loader";
import {
	DefaultErrorComponent,
	DefaultNotFoundComponent,
} from "@/components/default-not-found";
import { getContext } from "@/lib/query/query-client";
import { Provider as QueryProvider } from "@/lib/query/root-provider";

import { routeTree } from "@/routeTree.gen";

export const getRouter = () => {
	const rqContext = getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "intent",
		defaultPreloadDelay: 0,
		// Show the pending loader only when a navigation genuinely takes a
		// while, and hide it as soon as it resolves. The previous config
		// (pendingMs 0 + pendingMinMs 180) flashed a loader for a guaranteed
		// 180 ms on every tap, which read as a sluggish, unresponsive nav on
		// mobile even when the destination was already cached.
		defaultPendingMs: 250,
		defaultPendingMinMs: 0,
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<ClerkProvider
					publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
					appearance={{
						theme: shadcn,
					}}
				>
					<QueryProvider {...rqContext}>{props.children}</QueryProvider>
				</ClerkProvider>
			);
		},
		scrollRestoration: true,
		caseSensitive: true,
		defaultStaleTime: 30 * 1000,

		defaultPendingComponent: () => <DefaultLoader />,
		defaultNotFoundComponent: () => <DefaultNotFoundComponent />,
		defaultErrorComponent: () => <DefaultErrorComponent />,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
		handleRedirects: true,
		wrapQueryClient: true,
	});

	return router;
};
