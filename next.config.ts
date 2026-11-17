import type { NextConfig } from "next";
import { staticRedirects } from "./src/lib/redirects";

// Headers sent with every page. There is deliberately no Content-Security-Policy yet:
// Clerk and Stripe load scripts and frames from several hosts, and a wrong policy would
// break sign-in or checkout. Add one only after testing it on a preview deployment.
const securityHeaders = [
  // Browsers must use https for this site for the next two years (ignored on http).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // A file is only ever treated as the type we declared.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The site can't be shown inside someone else's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return staticRedirects;
  },
  async headers() {
    return [
      // Booking links carry a secret code in the URL, so never pass that URL on as a
      // referrer to other sites (or to scripts the page loads).
      {
        source: "/book/:path*",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "Referrer-Policy"),
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/((?!book/).*)",
        headers: securityHeaders,
      },
    ];
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
