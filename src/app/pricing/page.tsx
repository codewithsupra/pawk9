import { PricingTable, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { startLifetimeCheckout } from "@/actions/billing";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { LIFETIME_PRICE_CENTS } from "@/lib/constants";
import { APP_HOME, PRICING } from "@/lib/redirects";

// Public on purpose: signed-in users without access are sent here, and visitors can
// look at the prices before signing up.
export default function PricingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-[#5DC9A8] px-6 py-12 text-zinc-900">
      <Logo />
      <h1 className="text-center text-4xl font-semibold tracking-tight">
        Choose your plan
      </h1>
      <div className="w-full max-w-3xl">
        <PricingTable newSubscriptionRedirectUrl={APP_HOME} />
      </div>
      <Suspense>
        <LifetimeOffer />
      </Suspense>
    </main>
  );
}

// Clerk Billing only does subscriptions, so the one-time lifetime purchase is a
// separate Stripe checkout (see src/actions/billing.ts).
async function LifetimeOffer() {
  const user = await getCurrentUser();

  if (user?.lifetimePurchasedAt) {
    return (
      <p className="rounded-xl bg-white/90 px-6 py-4 shadow-sm">
        You have lifetime access.{" "}
        <Link href={APP_HOME} className="font-semibold underline">
          Open your dashboard
        </Link>
      </p>
    );
  }

  const price = `$${(LIFETIME_PRICE_CENTS / 100).toLocaleString("en-US")}`;

  return (
    <section
      aria-labelledby="lifetime-heading"
      className="flex w-full max-w-3xl flex-col gap-4 rounded-xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 id="lifetime-heading" className="text-xl font-semibold">
          Lifetime
        </h2>
        <p className="text-zinc-600">
          Pay once, use Petsoft forever. No subscription.
        </p>
        <p className="mt-2 text-3xl font-semibold">
          {price}{" "}
          <span className="text-base font-normal text-zinc-600">one-time</span>
        </p>
      </div>
      {user ? (
        <form action={startLifetimeCheckout}>
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full cursor-pointer px-7 text-base sm:w-auto"
          >
            Buy lifetime access
          </Button>
        </form>
      ) : (
        <SignInButton forceRedirectUrl={PRICING}>
          <Button
            type="button"
            size="lg"
            className="h-12 cursor-pointer px-7 text-base"
          >
            Sign in to buy
          </Button>
        </SignInButton>
      )}
    </section>
  );
}
