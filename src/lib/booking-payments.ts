import type Stripe from "stripe";
import { BOOKING_FEE_PERCENT } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { lockPet } from "@/lib/locks";
import { getStripe } from "@/lib/stripe";

/** PawK9's cut of a booking, in whole cents (rounded to the nearest cent). */
export const platformFee = (amountCents: number) =>
  Math.round((amountCents * BOOKING_FEE_PERCENT) / 100);

export type BookingPaymentResult =
  | { outcome: "confirmed" }
  | { outcome: "already-confirmed" }
  | { outcome: "refunded"; reason: string }
  | { outcome: "ignored"; reason: string };

const paymentIntentId = (session: Stripe.Checkout.Session) =>
  typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);

/**
 * Turns a paid Checkout Session into a confirmed booking. Called by the Stripe webhook,
 * and the only thing that can confirm a booking: the page the owner is sent back to
 * proves nothing. It trusts nothing but what Stripe says, and is safe to run twice or at
 * the same time for one session (Stripe retries deliveries).
 *
 * A payment that cannot be honoured is returned in full, fee included, so the owner is
 * never left paying for a stay that does not exist:
 * - the request was cancelled (or expired) before the payment arrived,
 * - another booking for overlapping days was confirmed first,
 * - the booking was already paid by a different payment (a duplicate).
 */
export async function fulfillBookingPayment(
  session: Stripe.Checkout.Session,
): Promise<BookingPaymentResult> {
  if (session.mode !== "payment" || session.metadata?.product !== "booking") {
    return { outcome: "ignored", reason: "not a booking payment" };
  }
  if (session.payment_status !== "paid") {
    return { outcome: "ignored", reason: "not paid" };
  }
  const bookingId = session.metadata.bookingId;
  const intentId = paymentIntentId(session);
  if (!bookingId || !intentId) {
    return {
      outcome: "ignored",
      reason: "no booking or payment on the session",
    };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, amountCents: true },
  });
  if (!booking) return { outcome: "ignored", reason: "unknown booking" };
  if (
    session.amount_total !== booking.amountCents ||
    session.currency !== "usd"
  ) {
    // We set the price ourselves, so this should never happen. Don't guess: someone
    // should look at it.
    console.error(
      `Booking ${booking.id}: paid ${session.amount_total} ${session.currency}, expected ${booking.amountCents} usd (payment ${intentId}) needs a manual look.`,
    );
    return { outcome: "ignored", reason: "unexpected amount or currency" };
  }

  const decision = await prisma.$transaction(async (tx) => {
    // Postgres runs transactions side by side: lock the pet so two payments for the
    // same days are decided one after the other.
    const current = await tx.booking.findUnique({ where: { id: booking.id } });
    if (!current) return { kind: "ignored" as const };
    await lockPet(tx, current.petId);

    const fresh = await tx.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });

    if (fresh.status === "CONFIRMED") {
      return fresh.stripePaymentIntentId === intentId
        ? { kind: "already" as const }
        : {
            kind: "refund" as const,
            reason: "booking already paid by another payment",
          };
    }

    if (fresh.status === "CANCELLED") {
      // Already returned *this* payment? A different payment on the same cancelled
      // booking is a second charge and must be returned as well.
      if (fresh.refundedAt && fresh.stripePaymentIntentId === intentId) {
        return { kind: "already" as const };
      }
      return {
        kind: "refund" as const,
        reason: "request was cancelled before payment",
      };
    }

    // Still waiting for payment. Is another paid booking in the way?
    const taken = await tx.booking.findFirst({
      where: {
        petId: fresh.petId,
        id: { not: fresh.id },
        status: "CONFIRMED",
        startDate: { lte: fresh.endDate },
        endDate: { gte: fresh.startDate },
      },
      select: { id: true },
    });
    if (taken) {
      await tx.booking.update({
        where: { id: fresh.id },
        data: { status: "CANCELLED" },
      });
      return {
        kind: "refund" as const,
        reason: "dates were booked by someone else first",
      };
    }

    await tx.booking.update({
      where: { id: fresh.id },
      data: {
        status: "CONFIRMED",
        paidAt: new Date(),
        stripePaymentIntentId: intentId,
      },
    });
    return { kind: "confirmed" as const };
  });

  if (decision.kind === "ignored") {
    return { outcome: "ignored", reason: "unknown booking" };
  }
  if (decision.kind === "confirmed") return { outcome: "confirmed" };
  if (decision.kind === "already") return { outcome: "already-confirmed" };

  // The refund happens outside the transaction (it is a call to Stripe). The idempotency
  // key makes a retried webhook refund once, not twice.
  await getStripe().refunds.create(
    {
      payment_intent: intentId,
      // Takes the money back from the daycare's account and returns PawK9's fee too.
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { bookingId: booking.id, reason: decision.reason },
    },
    { idempotencyKey: `booking-refund-${intentId}` },
  );
  // Remember the first payment returned for a cancelled booking (a confirmed booking is
  // never touched, and a second refunded payment is only logged).
  await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: "CANCELLED",
      refundedAt: null,
      stripePaymentIntentId: null,
    },
    data: { refundedAt: new Date(), stripePaymentIntentId: intentId },
  });
  console.warn(
    `Booking ${booking.id}: payment ${intentId} refunded (${decision.reason}).`,
  );
  return { outcome: "refunded", reason: decision.reason };
}

/**
 * Stripe says a Checkout Session ran out of time unpaid: cancel the request it belonged
 * to. Only the booking's *latest* session counts, so an old session expiring never
 * cancels a booking that the owner is now paying through a newer one.
 */
export async function cancelBookingForExpiredSession(
  session: Stripe.Checkout.Session,
) {
  if (session.metadata?.product !== "booking" || !session.metadata.bookingId)
    return;
  await prisma.booking.updateMany({
    where: {
      id: session.metadata.bookingId,
      status: "PENDING_PAYMENT",
      stripeSessionId: session.id,
    },
    data: { status: "CANCELLED" },
  });
}

/** Best effort: stops an open Checkout Session being paid. Never throws. */
export async function expireCheckoutSession(sessionId: string | null) {
  if (!sessionId) return;
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch {
    // Already expired or completed: nothing to stop. If it was paid after all, the
    // webhook refunds it.
  }
}

export type RefundBookingResult =
  { ok: true; paymentIntentId: string } | { ok: false; error: string };

/**
 * The daycare cancels a booking that was already paid: the owner gets all of their money
 * back (PawK9's fee too, taken out of the daycare's transfer) and the dates free up.
 *
 * The refund is made first, and the booking is only marked cancelled after Stripe agreed.
 * If marking fails the daycare can simply try again: the idempotency key makes Stripe
 * return the same refund instead of making a second one. If the refund fails nothing has
 * changed. The booking keeps its payment id, so a replayed webhook for it is recognised as
 * already handled rather than refunded again.
 *
 * Only a stay that has not ended can be cancelled here; settling an old stay is a money
 * question for the Stripe dashboard.
 */
export async function refundAndCancelBooking(input: {
  bookingId: string;
  userId: string;
  now?: Date;
}): Promise<RefundBookingResult> {
  const today = new Date(
    `${(input.now ?? new Date()).toISOString().slice(0, 10)}T00:00:00.000Z`,
  );

  // Matches on the owner too, so someone else's booking looks like a missing one.
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, userId: input.userId },
    select: {
      id: true,
      status: true,
      endDate: true,
      stripePaymentIntentId: true,
    },
  });
  if (
    !booking ||
    booking.status !== "CONFIRMED" ||
    !booking.stripePaymentIntentId
  ) {
    return { ok: false, error: "That booking can't be cancelled." };
  }
  if (booking.endDate < today) {
    return {
      ok: false,
      error:
        "This stay has already ended. Refund it from your Stripe dashboard instead.",
    };
  }

  const intentId = booking.stripePaymentIntentId;
  try {
    await getStripe().refunds.create(
      {
        payment_intent: intentId,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { bookingId: booking.id, reason: "cancelled by the daycare" },
      },
      { idempotencyKey: `booking-cancel-${intentId}` },
    );
  } catch (error) {
    // Already refunded some other way (for example in the Stripe dashboard): the money is
    // back with the owner, so carry on and record it.
    if ((error as { code?: string }).code !== "charge_already_refunded") {
      console.error(`Booking ${booking.id}: refund failed:`, error);
      return {
        ok: false,
        error: "Stripe could not refund this payment. Please try again.",
      };
    }
  }

  // Matches the status too, so two clicks at once end with one cancellation.
  await prisma.booking.updateMany({
    where: { id: booking.id, userId: input.userId, status: "CONFIRMED" },
    data: { status: "CANCELLED", refundedAt: new Date() },
  });
  console.warn(
    `Booking ${booking.id}: payment ${intentId} refunded (cancelled by the daycare).`,
  );
  return { ok: true, paymentIntentId: intentId };
}
