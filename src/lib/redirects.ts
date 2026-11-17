// Every redirect in the app is defined here. No imports on purpose: next.config.ts
// loads this file by relative path, where the "@/" alias is not available.
//
// Redirects live in three places depending on what decides them:
//   1. Static rules (below)            -> next.config.ts `redirects()`, runs first.
//   2. Signed-in-user rules (below)    -> src/proxy.ts, needs the Clerk session.
//   3. Signed-out access to /app/*     -> src/proxy.ts `auth.protect()` (sends to sign-in
//      with a redirect_url so the user returns to the page they wanted).
// Where users land after signing in or out is set on <ClerkProvider> in
// src/app/layout.tsx.

export const APP_HOME = "/app/dashboard";
export const SIGN_IN = "/sign-in";
export const SIGN_UP = "/sign-up";
// Where signed-in users without the paid plan are sent (see src/proxy.ts).
export const PRICING = "/pricing";

type StaticRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

const legacy = (source: string, destination: string): StaticRedirect => ({
  source,
  destination,
  // Old URLs that have moved for good, so browsers and search engines can cache it.
  permanent: true,
});

export const staticRedirects: StaticRedirect[] = [
  // `/app` has no page of its own. Not permanent, since it could become an overview.
  { source: "/app", destination: APP_HOME, permanent: false },

  // Auth pages under the names people (and the old stub pages) used.
  legacy("/login", SIGN_IN),
  legacy("/log-in", SIGN_IN),
  legacy("/signin", SIGN_IN),
  legacy("/signup", SIGN_UP),
  legacy("/register", SIGN_UP),

  // Shortcuts to the private pages, which all live under /app.
  legacy("/dashboard", APP_HOME),
  legacy("/account", "/app/account"),
  legacy("/profile", "/app/account"),
];

// Pages a signed-in user has no reason to see, and where to send them instead.
// Exact paths only: Clerk's multi-step flows live on sub-paths such as
// /sign-in/sso-callback, where the user can already be signed in mid-flow.
const signedInRedirects: Record<string, string> = {
  "/": APP_HOME,
  [SIGN_IN]: APP_HOME,
  [SIGN_UP]: APP_HOME,
};

/**
 * The destination for a signed-in user requesting `pathname`, or null to let the
 * request through. Pure, so it can be tested without a Clerk session.
 */
export function getSignedInRedirect(pathname: string): string | null {
  // "/sign-in/" and "/sign-in" are the same page.
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return signedInRedirects[normalized] ?? null;
}
