// A file in /public, so it never depends on a remote host being reachable. (Pets without a
// photo of their own get this; the schema applies it, see lib/validations.ts.)
export const DEFAULT_PET_IMAGE = "/pet-placeholder.svg";

// Slug of the paid plan in Clerk Billing. Everything under /app requires it.
export const PRO_PLAN = "pro";

// One-time lifetime purchase, in cents. The Checkout Session is created with this
// amount on the server, and fulfillment re-checks that exactly this was paid.
export const LIFETIME_PRICE_CENTS = 89_900;

/** A photo can't be emailed again within this time (stops a double click or a nagging resend). */
export const PHOTO_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** At most this many photo emails per user in any rolling hour (limits spam and cost). */
export const PHOTO_SENDS_PER_HOUR = 30;
