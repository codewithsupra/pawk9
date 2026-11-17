import type Stripe from "stripe";
import { LIFETIME_PRICE_CENTS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export type FulfillResult =
  | { granted: true; alreadyGranted: boolean }
  | { granted: false; reason: string };

/**
 * Gives a user lifetime access for a paid Checkout Session.
 *
 * Called from both the Stripe webhook and the success page, so it must be safe to
 * run twice, or at the same time, for the same session. It trusts nothing about the
 * session except what Stripe says: it only grants for a paid, one-time payment of
 * exactly the lifetime price, tagged with a user id that exists.
 */
export async function fulfillLifetimePurchase(
  session: Stripe.Checkout.Session,
): Promise<FulfillResult> {
  if (session.mode !== "payment") {
    return { granted: false, reason: "not a one-time payment" };
  }
  if (session.metadata?.product !== "lifetime") {
    return { granted: false, reason: "not a lifetime purchase" };
  }
  if (session.payment_status !== "paid") {
    return { granted: false, reason: "not paid" };
  }
  if (
    session.amount_total !== LIFETIME_PRICE_CENTS ||
    session.currency !== "usd"
  ) {
    return { granted: false, reason: "unexpected amount or currency" };
  }

  const userId = session.metadata?.userId;
  if (!userId) return { granted: false, reason: "no user on the session" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { granted: false, reason: "unknown user" };

  if (user.lifetimeStripeSessionId === session.id) {
    return { granted: true, alreadyGranted: true };
  }

  // Only one caller can flip null -> set. A concurrent duplicate sees count 0.
  const { count } = await prisma.user.updateMany({
    where: { id: userId, lifetimePurchasedAt: null },
    data: {
      lifetimePurchasedAt: new Date(),
      lifetimeStripeSessionId: session.id,
    },
  });
  if (count === 1) return { granted: true, alreadyGranted: false };

  const current = await prisma.user.findUnique({ where: { id: userId } });
  if (current?.lifetimeStripeSessionId !== session.id) {
    // They already had lifetime access from a different payment, so this one was a
    // second charge. Keep the first grant and make the duplicate visible.
    console.warn(
      `Duplicate lifetime payment for user ${userId}: session ${session.id} needs a refund.`,
    );
  }
  return { granted: true, alreadyGranted: true };
}

/** Whether the Clerk user has bought lifetime access. Used by the proxy. */
export async function hasLifetimeAccessByClerkId(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { lifetimePurchasedAt: true },
  });
  return user?.lifetimePurchasedAt != null;
}
