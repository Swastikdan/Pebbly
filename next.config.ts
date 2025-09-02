/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import type { NextConfig } from "next";
import "./env.js";

const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    optimizeCss: true,
    useCache: true,
    reactCompiler: true,
    scrollRestoration: true,
    clientSegmentCache: "client-only",
    optimisticClientCache: true,
  },

  compress: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
    incomingRequests: true,
  },

  images: {
    unoptimized: true,
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        port: "",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        port: "",
        pathname: "/vi/**",
      },
    ],
  },

  async headers() {
    return [
      // Security headers
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prefer CSP with frame-ancestors over X-Frame-Options
          // If CSP set elsewhere, remove the next two headers.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
      // Long-term caching for static assets in /public (except HTML)
      {
        source:
          "/:all*(svg|jpg|jpeg|png|gif|webp|ico|avif|mp4|mp3|woff|woff2|ttf|otf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Next build assets are already immutable; this is usually redundant, but safe
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
