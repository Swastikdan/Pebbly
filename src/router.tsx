import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import * as TanstackQuery from "@/lib/query/root-provider";
// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "viewport",
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<TanstackQuery.Provider {...rqContext}>
					{props.children}
				</TanstackQuery.Provider>
			);
		},
		scrollRestoration: true,
		caseSensitive: true,
		defaultStaleTime: 30 * 1000,

		defaultPendingComponent: () => <DefaultLoader />,
		defaultNotFoundComponent: () => <DefaultNotFoundComponent />,
		defaultErrorComponent: () => <DefaultNotFoundComponent />,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
		handleRedirects: true,
		wrapQueryClient: true,
	});

	return router;
};
