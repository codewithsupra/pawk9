// Booking maths shared by the booking page (to show the price) and, later, the server
// (to decide it: the server never trusts a price from the browser).

export const MAX_BOOKING_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-12-24" to a UTC-midnight date, or null if it isn't a real calendar day. */
export function parseDay(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  // Rejects dates like 2026-02-31 that JavaScript would roll into the next month.
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text
    ? null
    : date;
}

export type Quote =
  | { ok: true; days: number; amountCents: number }
  | { ok: false; error: string };

/**
 * Price of a stay covering every day from `start` to `end` inclusive. `today` is the
 * earliest day that can be booked ("YYYY-MM-DD").
 */
export function quoteBooking(input: {
  start: string;
  end: string;
  rateCents: number;
  today: string;
}): Quote {
  const start = parseDay(input.start);
  const end = parseDay(input.end);
  const today = parseDay(input.today);
  if (!start || !end || !today) {
    return { ok: false, error: "Choose a drop-off and a pick-up date." };
  }
  if (start < today) {
    return { ok: false, error: "The drop-off date can't be in the past." };
  }
  if (end < start) {
    return { ok: false, error: "Pick-up can't be before drop-off." };
  }
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days > MAX_BOOKING_DAYS) {
    return {
      ok: false,
      error: `A booking can cover at most ${MAX_BOOKING_DAYS} days.`,
    };
  }
  return { ok: true, days, amountCents: days * input.rateCents };
}

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    // Whole dollars read cleaner ($45), but never hide cents that exist ($45.50).
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
