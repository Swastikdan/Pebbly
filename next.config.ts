/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

import type { NextConfig } from "next";
import "./src/env.js";
const nextConfig: NextConfig = {
  experimental: {
    inlineCss: true,
    reactCompiler: true,
    optimizeCss: true,
    scrollRestoration: true,
    clientSegmentCache: true,

    // ppr: true,
    optimisticClientCache: true,
    serverMinification: true,
    cssChunking: true,
    preloadEntriesOnStart: true,
    serverSourceMaps: process.env.NODE_ENV === "production",
  },

  compress: true,

  images: {
    unoptimized: !!(process.env.VERCEL === "1"),
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://www.youtube.com",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/_next/static/:path*",
        destination: "/_next/static/:path*",
        has: [
          {
            type: "header",
            key: "cache-control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
