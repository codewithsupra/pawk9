"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, authorizeUser } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { lockPet } from "@/lib/locks";
import { parseDay, quoteBooking } from "@/lib/bookings";
import {
  CHECKOUT_EXPIRY_MINUTES,
  MAX_OPEN_BOOKING_REQUESTS_PER_PET,
  OPEN_REQUEST_WINDOW_MS,
} from "@/lib/constants";
import {
  expireCheckoutSession,
  platformFee,
  refundAndCancelBooking,
} from "@/lib/booking-payments";
import { notifyBookingCancelled } from "@/lib/booking-notify";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type BookingLinkResult =
  { ok: true; url: string } | { ok: false; error: string };

/**
 * The public booking link for one of the signed-in daycare's pets, creating its secret
 * code the first time. Refuses until the daycare has set a daily rate, since the page
 * would have nothing to charge.
 */
export async function getBookingLink(
  petId: string,
): Promise<BookingLinkResult> {
  const auth = await authorize(petId);
  if (!auth.ok) return auth;

  try {
    const pet = await prisma.pet.findFirst({
      where: { id: auth.petId, userId: auth.userId },
      select: {
        bookingCode: true,
        user: { select: { dailyRateCents: true, stripeChargesEnabled: true } },
      },
    });
    if (!pet) return { ok: false, error: "That pet no longer exists." };
    if (!pet.user.stripeChargesEnabled) {
      return {
        ok: false,
        error: "Connect Stripe on the Account page first, so you can get paid.",
      };
    }
    if (pet.user.dailyRateCents === null) {
      return {
        ok: false,
        error: "Set your price per day on the Account page first.",
      };
    }

    let code = pet.bookingCode;
    if (!code) {
      const fresh = randomBytes(16).toString("base64url");
      // Only fills an empty code, so two clicks at once end up with the same link.
      await prisma.pet.updateMany({
        where: { id: auth.petId, userId: auth.userId, bookingCode: null },
        data: { bookingCode: fresh },
      });
      const saved = await prisma.pet.findFirst({
        where: { id: auth.petId, userId: auth.userId },
        select: { bookingCode: true },
      });
      code = saved?.bookingCode ?? null;
      if (!code) return { ok: false, error: "That pet no longer exists." };
    }

    const requestHeaders = await headers();
    const base = getAppUrl(
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto") ?? "http",
    );
    return { ok: true, url: `${base}/book/${code}` };
  } catch (error) {
    console.error("Failed to get the booking link:", error);
    return { ok: false, error: "Could not create the link. Please try again." };
  }
}

export type CheckoutResult =
  { ok: true; url: string } | { ok: false; error: string };

const requestSchema = z.object({
  code: z.string().min(1).max(64),
  start: z.string().max(10),
  end: z.string().max(10),
});

/**
 * Starts a booking from the public booking page: saves the request and sends the owner
 * to Stripe to pay. There is no sign-in here (the link's secret code is the only
 * credential), so everything is decided on the server: the price comes from the daycare's
 * current rate, never from the browser. The booking stays PENDING_PAYMENT, which is not
 * a reservation, until Stripe's webhook confirms the payment (fulfillBookingPayment).
 */
export async function startBookingCheckout(
  code: string,
  start: string,
  end: string,
): Promise<CheckoutResult> {
  const parsed = requestSchema.safeParse({ code, start, end });
  if (!parsed.success) {
    return { ok: false, error: "Choose a drop-off and a pick-up date." };
  }

  try {
    const pet = await prisma.pet.findUnique({
      where: { bookingCode: parsed.data.code },
      select: {
        id: true,
        name: true,
        userId: true,
        user: {
          select: {
            dailyRateCents: true,
            stripeChargesEnabled: true,
            stripeAccountId: true,
          },
        },
      },
    });
    const rateCents = pet?.user.dailyRateCents ?? null;
    const destination = pet?.user.stripeAccountId ?? null;
    if (
      !pet ||
      rateCents === null ||
      !destination ||
      !pet.user.stripeChargesEnabled
    ) {
      return { ok: false, error: "Booking isn't available for this link." };
    }

    // Yesterday (UTC) is still allowed, so an owner whose date is behind UTC isn't
    // refused for booking "today".
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const quote = quoteBooking({
      start: parsed.data.start,
      end: parsed.data.end,
      rateCents,
      today: yesterday,
    });
    if (!quote.ok) return quote;

    const startDate = parseDay(parsed.data.start)!;
    const endDate = parseDay(parsed.data.end)!;

    // One transaction, so two requests at once can't both slip past the checks.
    const reserved = await prisma.$transaction(async (tx) => {
      // Postgres runs transactions side by side: take the pet's lock so simultaneous
      // requests queue up and each sees the previous one's result.
      await lockPet(tx, pet.id);
      // The pet is already booked and paid for on some of these days.
      const taken = await tx.booking.findFirst({
        where: {
          petId: pet.id,
          status: "CONFIRMED",
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });
      if (taken) {
        return { error: "These dates are already booked. Try other dates." };
      }

      // Asking again for the same dates reuses the open request instead of piling up.
      const same = await tx.booking.findFirst({
        where: {
          petId: pet.id,
          status: "PENDING_PAYMENT",
          startDate,
          endDate,
        },
        select: { id: true },
      });
      if (same) return { id: same.id };

      // The link is public, so cap how many unpaid requests it can pile up. Old ones
      // stop counting, so an abandoned request frees its place by itself.
      const open = await tx.booking.count({
        where: {
          petId: pet.id,
          status: "PENDING_PAYMENT",
          createdAt: { gt: new Date(Date.now() - OPEN_REQUEST_WINDOW_MS) },
        },
      });
      if (open >= MAX_OPEN_BOOKING_REQUESTS_PER_PET) {
        return {
          error: "Too many open requests. Please contact your daycare.",
        };
      }

      const created = await tx.booking.create({
        data: {
          startDate,
          endDate,
          days: quote.days,
          dailyRateCents: rateCents,
          amountCents: quote.amountCents,
          petId: pet.id,
          userId: pet.userId,
        },
        select: { id: true },
      });
      return { id: created.id };
    });
    if (!reserved.id) {
      return { ok: false, error: reserved.error ?? "Could not start booking." };
    }

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: reserved.id },
      select: {
        id: true,
        amountCents: true,
        days: true,
        stripeSessionId: true,
      },
    });

    // Clicking again while a payment page is still open goes back to that same page,
    // instead of making another one each time.
    const stripe = getStripe();
    if (booking.stripeSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          booking.stripeSessionId,
        );
        if (existing.status === "open" && existing.url) {
          return { ok: true, url: existing.url };
        }
      } catch {
        // Can't read it: just make a new one.
      }
    }

    const requestHeaders = await headers();
    const base = getAppUrl(
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto") ?? "http",
    );
    const fee = platformFee(booking.amountCents);
    const metadata = { product: "booking", bookingId: booking.id };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: booking.amountCents,
            product_data: {
              name: `Stay for ${pet.name}`,
              description: `${parsed.data.start} to ${parsed.data.end} (${booking.days} ${booking.days === 1 ? "day" : "days"})`,
            },
          },
        },
      ],
      // A destination charge: the owner pays PawK9's Stripe account, the daycare is paid
      // the amount minus our fee, and the daycare's account is the one that gets paid out.
      payment_intent_data: {
        application_fee_amount: fee,
        transfer_data: { destination },
        metadata,
      },
      metadata,
      // Stripe needs at least 30 minutes; a little more avoids clock-skew rejections.
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_MINUTES * 60,
      success_url: `${base}/book/${parsed.data.code}/thanks`,
      cancel_url: `${base}/book/${parsed.data.code}`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    // Remember the session, unless the request was cancelled in the meantime.
    const { count } = await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING_PAYMENT" },
      data: { stripeSessionId: session.id, platformFeeCents: fee },
    });
    if (count === 0) {
      await expireCheckoutSession(session.id);
      return {
        ok: false,
        error: "This request was cancelled. Please start again.",
      };
    }
    if (booking.stripeSessionId)
      await expireCheckoutSession(booking.stripeSessionId);

    return { ok: true, url: session.url };
  } catch (error) {
    console.error("Failed to start booking checkout:", error);
    return {
      ok: false,
      error: "Could not start payment. Please try again in a moment.",
    };
  }
}

export type CancelBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels one of the signed-in daycare's unpaid booking requests, and closes its payment
 * page so it can't be paid afterwards (if it somehow is, the webhook refunds it). Only a
 * request still waiting for payment can be cancelled here; a paid booking is cancelled
 * (and refunded) by cancelPaidBooking.
 */
export async function cancelBookingRequest(
  bookingId: string,
): Promise<CancelBookingResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    return { ok: false, error: "That request no longer exists." };
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: auth.userId, status: "PENDING_PAYMENT" },
      select: { stripeSessionId: true },
    });

    // Matches on the owner and the status together, so someone else's booking, a paid
    // one and a missing one all look the same.
    const { count } = await prisma.booking.updateMany({
      where: { id: bookingId, userId: auth.userId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (count === 0) {
      return { ok: false, error: "That request can't be cancelled." };
    }
    await expireCheckoutSession(booking?.stripeSessionId ?? null);
    revalidatePath("/app/bookings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to cancel a booking request:", error);
    return { ok: false, error: "Could not cancel. Please try again." };
  }
}

/**
 * Cancels one of the signed-in daycare's paid bookings and refunds the owner in full. The
 * refund is made before the booking is touched (see refundAndCancelBooking), and the owner
 * is told by email afterwards.
 */
export async function cancelPaidBooking(
  bookingId: string,
): Promise<CancelBookingResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  if (typeof bookingId !== "string" || bookingId.length === 0) {
    return { ok: false, error: "That booking no longer exists." };
  }

  try {
    const result = await refundAndCancelBooking({
      bookingId,
      userId: auth.userId,
    });
    if (!result.ok) return result;
    await notifyBookingCancelled(bookingId);
    revalidatePath("/app/bookings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to cancel a paid booking:", error);
    return { ok: false, error: "Could not cancel. Please try again." };
  }
}
