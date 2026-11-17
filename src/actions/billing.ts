"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LIFETIME_PRICE_CENTS } from "@/lib/constants";
import { APP_HOME, PRICING, SIGN_IN } from "@/lib/redirects";
import { getAppUrl, getStripe } from "@/lib/stripe";

/**
 * Starts the one-time lifetime purchase: creates a Stripe Checkout Session on the
 * server and sends the customer to Stripe's hosted payment page.
 *
 * The price lives here, never in the browser, and is checked again when the payment
 * is fulfilled. Access is granted by the webhook / success page, not by this action.
 */
export async function startLifetimeCheckout(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect(`${SIGN_IN}?redirect_url=${encodeURIComponent(PRICING)}`);
  if (user.lifetimePurchasedAt) redirect(APP_HOME);

  const requestHeaders = await headers();
  const appUrl = getAppUrl(
    requestHeaders.get("host"),
    requestHeaders.get("x-forwarded-proto") ?? "http",
  );

  // The metadata is how the payment is matched back to a user when it is fulfilled.
  const metadata = { userId: user.id, product: "lifetime" };

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: LIFETIME_PRICE_CENTS,
          product_data: {
            name: "Petsoft Lifetime",
            description: "One-time payment. Lifetime access to Petsoft.",
          },
        },
      },
    ],
    client_reference_id: user.id,
    // Placeholder addresses (phone-only sign-ups) are not real, so don't prefill them.
    customer_email: user.email.endsWith(".local") ? undefined : user.email,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${PRICING}`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}
