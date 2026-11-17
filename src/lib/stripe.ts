import Stripe from "stripe";

let client: Stripe | undefined;

/** The Stripe client. Throws a readable error if the key is missing. */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add your Stripe test-mode secret key to .env.",
    );
  }
  client ??= new Stripe(key);
  return client;
}

/** The signing secret used to verify webhook deliveries came from Stripe. */
export function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Add the webhook signing secret (whsec_...) to .env.",
    );
  }
  return secret;
}

/**
 * Absolute base URL for Stripe's success/cancel redirects. In production this must
 * be configured, because building it from the request's Host header would let
 * whoever controls that header choose where Stripe sends the customer afterwards.
 */
export function getAppUrl(requestHost: string | null, protocol = "http") {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production" || !requestHost) {
    throw new Error("APP_URL is not set (e.g. https://petsoft.example.com).");
  }
  return `${protocol}://${requestHost}`;
}
