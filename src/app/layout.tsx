import { type Metadata } from "next";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import Providers from "@/components/providers";
import "@/styles/globals.css";

import { Roboto_Flex } from "next/font/google";
import Script from "next/script";
export const metadata: Metadata = {
  title: "Film Fanatic",
  description:
    "Explore a vast collection of movies and TV shows with Film Fanatic.",
  applicationName: "Film Fanatic",
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

const robotoFLex = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-roboto-flex",
  display: "swap",
  preload: true,
});
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={robotoFLex.variable}>
      <head>
        <meta
          name="google-site-verification"
          content="uHvrTYV7MI9jil_qDblV-QDi9qjXlpdb_8XJUtCLGLQ"
        />
        <Script strategy="afterInteractive" id="debugger">
          debugger;
        </Script>
      </head>

      <body className="min-h-screen font-sans leading-relaxed antialiased">
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
