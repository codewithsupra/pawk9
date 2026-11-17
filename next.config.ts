import type { NextConfig } from "next";
import { staticRedirects } from "./src/lib/redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return staticRedirects;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/photo-*",
      },
    ],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
    // Photo uploads go through a server action. The default limit (1 MB) is below a
    // phone photo, and the browser shrinks them well under this anyway. Keep it below
    // Vercel's 4.5 MB request limit in case this is deployed there.
    serverActions: { bodySizeLimit: "4mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
