import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useEffect, useState } from "react";
import {
	DefaultErrorComponent,
	DefaultNotFoundComponent,
} from "@/components/default-not-found";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { UserSync } from "@/components/user-sync";
import { SITE_CONFIG } from "@/constants";

import { MetaImageTagsGenerator } from "@/lib/meta-image-tags";
import TanStackQueryDevtools from "@/lib/query/devtools";
import appCss from "@/styles.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

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
				content: "#0b0a08",
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
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
			{
				rel: "stylesheet",
				href: appCss,
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
				rel: "apple-touch-icon-precomposed",
				sizes: "57x57",
				href: "/apple-touch-icon-57x57.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "114x114",
				href: "/apple-touch-icon-114x114.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "72x72",
				href: "/apple-touch-icon-72x72.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "144x144",
				href: "/apple-touch-icon-144x144.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "60x60",
				href: "/apple-touch-icon-60x60.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "120x120",
				href: "/apple-touch-icon-120x120.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "76x76",
				href: "/apple-touch-icon-76x76.png",
			},
			{
				rel: "apple-touch-icon-precomposed",
				sizes: "152x152",
				href: "/apple-touch-icon-152x152.png",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-196x196.png",
				sizes: "196x196",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-96x96.png",
				sizes: "96x96",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-32x32.png",
				sizes: "32x32",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-16x16.png",
				sizes: "16x16",
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/favicon-128.png",
				sizes: "128x128",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "apple-touch-startup-image",
				media:
					"(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "preconnect",
				href: "https://image.tmdb.org",
			},
			{
				rel: "preconnect",
				href:
					import.meta.env.CONVEX_CLERK_ISSUER_URL ||
					"https://rested-adder-44.clerk.accounts.dev",
				crossOrigin: "anonymous",
			},
			{
				rel: "preconnect",
				href: "https://api.themoviedb.org",
				crossOrigin: "anonymous",
			},
		],
	}),

	notFoundComponent: DefaultNotFoundComponent,
	errorComponent: DefaultErrorComponent,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const [devtoolsPlugin, setDevtoolsPlugin] = useState<React.ReactNode>(null);

	useEffect(() => {
		if (typeof window !== "undefined" && "serviceWorker" in navigator) {
			const register = () => {
				navigator.serviceWorker
					.register("/sw.js", { scope: "/" })
					.then((reg) => {
						console.log("Service Worker registered with scope:", reg.scope);
					})
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
		}
	}, []);

	useEffect(() => {
		if (!import.meta.env.DEV) {
			return;
		}

		Promise.all([
			import("@tanstack/react-devtools"),
			import("@tanstack/react-router-devtools"),
		]).then(([reactDevtools, routerDevtools]) => {
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
						TanStackQueryDevtools,
					]}
				/>,
			);
		});
	}, []);

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta
					name="google-site-verification"
					content="uHvrTYV7MI9jil_qDblV-QDi9qjXlpdb_8XJUtCLGLQ"
				/>
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:inline-flex focus:items-center focus:justify-center focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-foreground focus:font-bold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<UserSync />
					<Navbar />
					{/* biome-ignore lint/correctness/useUniqueElementIds: static ID needed for skip link anchor target */}
					<main id="main-content" tabIndex={-1} className="outline-none">
						{children}
					</main>
					<Footer />
					{devtoolsPlugin}
					<SpeedInsights />
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}
