import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { Link } from "@heroui/link";
import { Link as NextUiLinkStyle } from "@heroui/link";
import React from "react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "movie database",
    "film reviews",
    "TV show information",
    "movie ratings",
    "entertainment",
  ],
  robots: "noindex, nofollow",
  icons: [
    {
      url: "/logo.svg",
      sizes: "any",
      type: "image/x-icon",
    },
    {
      url: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
    {
      url: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-32x32.png",
      sizes: "32x32",
      type: "image/png",
    },
    {
      url: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/favicon-16x16.png",
      sizes: "16x16",
      type: "image/png",
    },
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: siteConfig.name,
    images: [
      {
        url: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/ogimage.webp?updatedAt=1715421360221",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    site: "@swastikdan",
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={cn(
          "text-foreground bg-background min-h-screen font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "system" }}>
          <div className="relative flex h-screen flex-col">
            <Navbar />
            <main>{children}</main>
            <footer
              aria-label="Footer"
              className="mx-auto flex w-full items-center justify-center font-medium"
              role="contentinfo"
            >
              <section className="flex w-full max-w-screen-xl flex-col items-center justify-between gap-3 px-5 py-10 text-base font-light md:flex-row md:px-10">
                <p>
                  Made with{" "}
                  <span aria-label="love" role="img">
                    ❤️
                  </span>{" "}
                  By Swastik Dan
                </p>
                <div className="flex items-center gap-5">
                  <Link
                    aria-label="User disclaimer"
                    as={NextUiLinkStyle}
                    color="foreground"
                    href={siteConfig.Footerlinks.disclaimer}
                  >
                    Disclaimer
                  </Link>

                  <Link
                    aria-label="Github repository for Film Fanatic"
                    as={NextUiLinkStyle}
                    color="foreground"
                    href={siteConfig.Footerlinks.github}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Github
                  </Link>
                </div>
              </section>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
