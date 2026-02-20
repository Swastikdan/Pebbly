import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { shadcn } from "@clerk/themes";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { DefaultLoader } from "@/components/default-loader";
import { DefaultNotFoundComponent } from "@/components/default-not-found";
import * as TanstackQuery from "@/lib/query/root-provider";

// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "viewport",
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<ClerkProvider
					publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
					appearance={{
						theme: shadcn,
					}}
				>
					<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
						<TanstackQuery.Provider {...rqContext}>
							{props.children}
						</TanstackQuery.Provider>
					</ConvexProviderWithClerk>
				</ClerkProvider>
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
