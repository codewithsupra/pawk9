import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { PRO_PLAN } from "@/lib/constants";
import { hasLifetimeAccessByClerkId } from "@/lib/purchases";
import { getSignedInRedirect, PRICING } from "@/lib/redirects";

// Everything under /app is private and needs the paid plan or lifetime access. Signed-out page requests
// are sent to sign-in; signed-in users without the plan are sent to /pricing; other
// requests (e.g. server action calls) are refused.
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const { has, userId } = await auth.protect();

    // Access is an active Pro plan (free to check, it is in the session) or a lifetime
    // purchase (one indexed lookup, only for users who lack the plan).
    const allowed =
      has({ plan: PRO_PLAN }) || (await hasLifetimeAccessByClerkId(userId));

    // Signed in but without access: page loads go to the pricing page. Anything else
    // (e.g. a server action call) is refused outright.
    if (!allowed) {
      if (req.method === "GET" || req.method === "HEAD") {
        return NextResponse.redirect(new URL(PRICING, req.url));
      }
      return new NextResponse("Subscription required", { status: 403 });
    }
    return;
  }

  // Signed-in users skip the marketing and sign-in pages (see lib/redirects.ts).
  // Decided here, not in the pages, so those pages stay static. Only page loads are
  // redirected, never POSTs.
  if (req.method === "GET" || req.method === "HEAD") {
    const destination = getSignedInRedirect(req.nextUrl.pathname);
    if (destination && (await auth()).userId) {
      return NextResponse.redirect(new URL(destination, req.url));
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
