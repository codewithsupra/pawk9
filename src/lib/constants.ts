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

/** Unpaid booking requests one public booking link may hold at once (it has no sign-in). */
export const MAX_OPEN_BOOKING_REQUESTS_PER_PET = 5;

/** Bounds for a daycare's daily rate, in cents (1 to 1,000 dollars). */
export const MIN_DAILY_RATE_CENTS = 100;
export const MAX_DAILY_RATE_CENTS = 100_000;

/**
 * Country of the Stripe Connect accounts daycares create (two-letter code). It can't be
 * changed on an account once created. Without it Stripe silently uses the platform's own
 * country. The platform's country limits which values work: a platform in NL can create
 * US and GB accounts but not IN.
 */
export const CONNECT_COUNTRY = "US";

/** PawK9's cut of each booking payment, in percent. Shown to daycares in the terms. */
export const BOOKING_FEE_PERCENT = 5;

/** How long an owner has to pay once sent to Stripe. Stripe's minimum is 30 minutes; a few more avoid clock-skew rejections. */
export const CHECKOUT_EXPIRY_MINUTES = 35;

/**
 * An unpaid request only counts toward a link's cap of open requests for this long, so
 * abandoned ones free their place even if Stripe's "expired" notice never arrives.
 */
export const OPEN_REQUEST_WINDOW_MS = 2 * 60 * 60 * 1000;
