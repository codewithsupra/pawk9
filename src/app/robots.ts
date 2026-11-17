import type { MetadataRoute } from "next";

// Only the public pages should be found by search engines. Everything behind a login,
// the private booking links, signed photo links and the API are kept out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/privacy", "/terms"],
      disallow: ["/app", "/book/", "/p/", "/api/", "/checkout/"],
    },
  };
}
