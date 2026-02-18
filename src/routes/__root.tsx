import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
				content: "width=device-width, initial-scale=1",
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
				content: "white",
				media: "(prefers-color-scheme: light)",
			},
			{
				name: "theme-color",
				content: "black",
				media: "(prefers-color-scheme: dark)",
			},
		],
		links: [
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
				href: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
			{
				rel: "icon",
				href: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-32x32.png",
				sizes: "32x32",
				type: "image/png",
			},
			{
				rel: "icon",
				href: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-16x16.png",
				sizes: "16x16",
				type: "image/png",
			},
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
				href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap",
				rel: "stylesheet",
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const [devtoolsPlugin, setDevtoolsPlugin] = useState<React.ReactNode>(null);

	useEffect(() => {
		if (!import.meta.env.DEV) {
			return;
		}

		// Keep devtools out of production bundles and only load them on demand.
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
			<body className="min-h-screen leading-relaxed antialiased">
				<ThemeProvider>
					<UserSync />
					<Navbar />
					{children}
					<Footer />
					{devtoolsPlugin}
					<Scripts />
				</ThemeProvider>
			</body>
		</html>
	);
}
