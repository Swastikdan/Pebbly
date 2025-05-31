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
    // ppr: true,
  },

  compress: true,
  poweredByHeader: false,
  images: {
    minimumCacheTTL: 31536000,
    loader: "default",
    deviceSizes: [320, 420, 768, 1024, 1200, 1920, 2048],
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        port: "",
        pathname: "/**",
      },

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
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
// eslint-disable-next-line @typescript-eslint/no-floating-promises
initOpenNextCloudflareForDev();
