import { useEffect, useState } from "react";
import bricolageLatinWoff2 from "@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url";
import geistLatinWoff2 from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouter,
} from "@tanstack/react-router";

import type { QueryClient } from "@tanstack/react-query";
import {
  DefaultErrorComponent,
  DefaultNotFoundComponent,
} from "@/components/default-not-found";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { Navbar } from "@/components/navbar";
import { NavigationProgressBar } from "@/components/navigation-progress-bar";
import { ToastProvider } from "@/components/ui/toast";
import { UserSync } from "@/components/user-sync";
import { SITE_CONFIG } from "@/constants";
import { THEME_STORAGE_KEY, useTheme } from "@/hooks/use-theme";
import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

// Blocking, pre-paint theme resolution. Runs before any stylesheet renders so
// light-mode users never flash the dark palette (or vice versa). Must stay in
// sync with applyThemeToDom() in use-theme.ts.
const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var dark =
      stored === "dark" ||
      ((stored === null || stored === "system") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();`;

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      ...MetaImageTagsGenerator({
        title: SITE_CONFIG.name,
        description: SITE_CONFIG.description,
        ogImage: SITE_CONFIG.defaultMetaImage,
        url: SITE_CONFIG.url,
      }),
      {
        name: "application-name",
        content: SITE_CONFIG.name,
      },
      {
        name: "msapplication-TileColor",
        content: "#0b0a08",
      },
      {
        name: "msapplication-TileImage",
        content: "/mstile-144x144.png",
      },
      {
        name: "msapplication-square70x70logo",
        content: "/mstile-70x70.png",
      },
      {
        name: "msapplication-square150x150logo",
        content: "/mstile-150x150.png",
      },
      {
        name: "msapplication-wide310x150logo",
        content: "/mstile-310x150.png",
      },
      {
        name: "msapplication-square310x310logo",
        content: "/mstile-310x310.png",
      },
      {
        name: "keywords",
        content:
          "movie database, film reviews, TV show information, movie ratings, entertainment",
      },
      {
        name: "robots",
        content: "noindex, nofollow",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:locale",
        content: "en_US",
      },
      {
        name: "twitter:site",
        content: "@swastikdan",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: light)",
        content: "#f5f5f5",
      },
      {
        name: "theme-color",
        media: "(prefers-color-scheme: dark)",
        content: "#161616",
      },
      // Intentionally kept for older Chrome for Android compatibility.
      // Modern PWA behavior is controlled via manifest.json display: "standalone".
      {
        name: "mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      {
        name: "apple-mobile-web-app-title",
        content: SITE_CONFIG.name,
      },
    ],
    links: [
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Preload the latin body/display subsets so text isn't blocked on CSS
      // parse before the @font-face fetch even starts. crossOrigin is required
      // for font preloads (even same-origin) or the browser fetches twice.
      {
        rel: "preload",
        href: geistLatinWoff2,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: bricolageLatinWoff2,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "icon",
        href: "/logo.svg",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        rel: "icon",
        href: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        rel: "icon",
        href: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        rel: "preconnect",
        href: "https://image.tmdb.org",
      },
      {
        rel: "preconnect",
        href:
          import.meta.env.VITE_CLERK_ISSUER_URL ||
          "https://rested-adder-44.clerk.accounts.dev",
        crossOrigin: "anonymous",
      },
      {
        rel: "preconnect",
        href: "https://api.themoviedb.org",
        crossOrigin: "anonymous",
      },
    ],
    scripts: [
      {
        type: "module",
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        "data-cf-beacon": '{"token": "cf131605e09945caa1b60fe00a7a919a"}',
      },
    ],
  }),

  notFoundComponent: DefaultNotFoundComponent,
  errorComponent: DefaultErrorComponent,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const [devtoolsPlugin, setDevtoolsPlugin] = useState<React.ReactNode>(null);
  const router = useRouter();

  // Keeps the OS-preference subscription alive for the whole app.
  useTheme();

  // Global keyboard shortcuts: "/" focuses search (or navigates there).
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key !== "/" || isTyping || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[name="query"]',
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      } else {
        void router.navigate({ to: "/search" });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (import.meta.env.DEV) {
      // Unregister any SW left over from a production build/preview and purge
      // its caches, so stale client JS (with old serverFn IDs) can't be served
      // against the dev server.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => {})
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    Promise.all([
      import("@tanstack/react-devtools"),
      import("@tanstack/react-router-devtools"),
      import("@/lib/query/devtools"),
    ]).then(([reactDevtools, routerDevtools, queryDevtools]) => {
      const TanStackDevtoolsComponent = reactDevtools.TanStackDevtools;
      const TanStackRouterDevtoolsPanelComponent =
        routerDevtools.TanStackRouterDevtoolsPanel;

      setDevtoolsPlugin(
        <TanStackDevtoolsComponent
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanelComponent />,
            },
            queryDevtools.default,
          ]}
        />,
      );
    });
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script constant, required to resolve the theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta
          name="google-site-verification"
          content="uHvrTYV7MI9jil_qDblV-QDi9qjXlpdb_8XJUtCLGLQ"
        />
        <HeadContent />
      </head>
      <body className="min-h-screen antialiased">
        <ToastProvider position="bottom-right">
          <NavigationProgressBar />
          <a
            href="#main-content"
            className="focus:border-border focus:bg-background focus:text-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:inline-flex focus:items-center focus:justify-center focus:rounded-lg focus:border focus:px-4 focus:py-2.5 focus:font-bold focus:shadow-lg focus:ring-2 focus:outline-none"
          >
            Skip to main content
          </a>
          <UserSync />
          <Navbar />
          {/* The skip-to-content link targets #main-content, keep a visible
					    focus ring so keyboard users can see where focus landed. */}
          <main
            id="main-content"
            tabIndex={-1}
            className="focus-visible:outline-ring mobile-nav-spacer focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {children}
          </main>
          <Footer />
          <MobileBottomNav />
          {devtoolsPlugin}
        </ToastProvider>
        <Scripts />
      </body>
    </html>
  );
}
