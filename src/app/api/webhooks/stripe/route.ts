import type Stripe from "stripe";
import { notifyBookingConfirmed } from "@/lib/booking-notify";
import {
  cancelBookingForExpiredSession,
  fulfillBookingPayment,
} from "@/lib/booking-payments";
import { fulfillLifetimePurchase } from "@/lib/purchases";
import { getStripe, getWebhookSecret } from "@/lib/stripe";

// Stripe calls this when a payment completes. It carries no user session, so the
// signature is the only proof it came from Stripe. This route must stay public: it is
// outside /app, and nothing may call auth.protect() on it.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // Verification needs the exact raw bytes, so read the body as text, not JSON.
  const body = await request.text();

  // Read the configuration outside the try below: a missing key is our mistake and
  // should be a loud 500, not be reported to Stripe as an invalid signature.
  const stripe = getStripe();
  const secret = getWebhookSecret();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    // Two kinds of payment arrive here; the session's own metadata says which. A failure
    // in either throws, so Stripe gets a 500 and retries the delivery.
    if (session.metadata?.product === "booking") {
      const result = await fulfillBookingPayment(session);
      // Only the delivery that actually confirmed it sends emails (never throws).
      if (result.outcome === "confirmed") await notifyBookingConfirmed(session);
      if (result.outcome === "refunded" || result.outcome === "ignored") {
        console.warn(
          `Stripe event ${event.id}: booking payment ${result.outcome}: ${result.reason}`,
        );
      }
    } else {
      const result = await fulfillLifetimePurchase(session);
      if (!result.granted) {
        // Not an error worth retrying (e.g. not paid yet), so still answer 200.
        console.warn(
          `Stripe event ${event.id} did not grant lifetime access: ${result.reason}`,
        );
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    await cancelBookingForExpiredSession(event.data.object);
  }

  return new Response("ok");
}
