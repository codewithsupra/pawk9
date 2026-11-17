import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Logo from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";
import { claimCheckoutSession } from "@/lib/checkout";
import { APP_HOME, PRICING, SIGN_IN } from "@/lib/redirects";

// Where Stripe sends the customer after paying. The webhook is the main way access is
// granted, but it can arrive after the customer does, so this page also checks the
// payment with Stripe and grants it directly. Both paths are idempotent.
export default function CheckoutSuccessPage(
  props: PageProps<"/checkout/success">,
) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-[#5DC9A8] px-6 py-12 text-zinc-900">
      <Logo />
      <Suspense fallback={<p role="status">Confirming your payment…</p>}>
        <Confirm searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Confirm({
  searchParams,
}: {
  searchParams: PageProps<"/checkout/success">["searchParams"];
}) {
  // Opt out of prerendering before touching anything time-dependent. Awaiting
  // searchParams alone is not enough: Prisma and Stripe both call Date.now(), which
  // Next flags as a "blocking route" unless request-time rendering is explicit first.
  await connection();
  const { session_id: sessionId } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN);
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    redirect(PRICING);
  }

  const claim = await claimCheckoutSession(user.id, sessionId);
  if (claim.status === "granted") redirect(APP_HOME);
  if (claim.status === "not-yours") redirect(PRICING);

  return (
    <div className="max-w-md text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Payment not confirmed yet
      </h1>
      <p className="mt-3">
        We haven&apos;t received confirmation of your payment ({claim.reason}).
        If you were charged, access is added automatically as soon as it
        completes. Refresh this page in a moment.
      </p>
      <Link href={PRICING} className="mt-6 inline-block underline">
        Back to pricing
      </Link>
    </div>
  );
}
