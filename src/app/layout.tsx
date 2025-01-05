import type { Metadata } from "next";
import "./globals.css";
import { Bricolage_Grotesque } from "next/font/google";
import { Providers } from "./providers";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
const baricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-baricolage",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Film Fanatic",
  description:
    "Explore a vast collection of movies and TV shows with Film Fanatic.",
  applicationName: "Film Fanatic",
  //themeColor: '#020A09',
  keywords: [
    "movie database",
    "film reviews",
    "TV show information",
    "movie ratings",
    "entertainment",
  ],
  //colorScheme: 'dark light',
  //viewport: 'width=device-width, initial-scale=1',
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
  //manifest: '/manifest.webmanifest',
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Film Fanatic",
    images: [
      {
        url: "https://ik.imagekit.io/swastikdan/Film-Fanatic/public/ogimage.webp?updatedAt=1715421360221",
        width: 1200,
        height: 630,
        alt: "Film Fanatic",
      },
    ],
  },
  twitter: {
    site: "@swastikdan",
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${baricolage.variable} font-baricolage antialiased`}>
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
