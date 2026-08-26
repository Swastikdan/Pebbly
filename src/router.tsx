import { ClerkProvider } from "@clerk/react";
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
    // Small delay so a cursor sweeping across poster grids doesn't fire
    // prefetches (route chunks + loader data) for every card it crosses.
    // 100 ms still suppresses sweep noise but is half the previous 200 ms,
    // so a hover-intent on desktop and a touch-hover on mobile can start
    // the chunk+loader fetch before the tap commits, making the tap feel
    // instant when the cache is warm.
    defaultPreloadDelay: 100,
    // Show the pending loader only when a navigation genuinely takes a
    // while, and hide it as soon as it resolves. The previous config
    // (pendingMs 0 + pendingMinMs 180) flashed a loader for a guaranteed
    // 180 ms on every tap, which read as a sluggish, unresponsive nav on
    // mobile even when the destination was already cached.
    // The top progress bar (NavigationProgressBar) is intentionally NOT
    // gated by this delay: it uses location vs resolvedLocation to show
    // immediate feedback within ~80 ms, while this pendingMs only controls
    // the full-screen DefaultLoader to avoid flashing on fast navigations.
    defaultPendingMs: 250,
    defaultPendingMinMs: 0,
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        // Appearance is applied per-widget inside the lazy
        // components/auth/account-button chunk instead of here: importing
        // @clerk/ui/themes at the root pulled it into the critical entry
        // bundle on every page load. Clerk's 308 KiB (236 KiB unused on
        // homepage) is already code-split to `vendor-auth-db`; we keep the
        // provider synchronous for hydration but downgrade its preconnect to
        // `dns-prefetch` in __root.tsx so it doesn't contend with the LCP
        // image/CSS on the critical path.
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
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
