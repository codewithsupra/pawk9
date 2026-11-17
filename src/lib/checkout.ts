import { fulfillLifetimePurchase } from "@/lib/purchases";
import { getStripe } from "@/lib/stripe";

export type ClaimResult =
  | { status: "granted" }
  | { status: "not-yours" }
  | { status: "pending"; reason: string };

/**
 * What the success page does with the session id in its URL: ask Stripe about that
 * session, and grant lifetime access only if it is this user's own paid purchase.
 * Kept out of the page so the "can't claim someone else's payment" rule is testable.
 */
export async function claimCheckoutSession(
  userId: string,
  sessionId: string,
): Promise<ClaimResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);

  // The session id appears in a URL, so anyone holding it could open the page.
  if (session.metadata?.userId !== userId) return { status: "not-yours" };

  const result = await fulfillLifetimePurchase(session);
  return result.granted
    ? { status: "granted" }
    : { status: "pending", reason: result.reason };
}
