"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, authorizeUser } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { lockPet } from "@/lib/locks";
import { parseDay, quoteBooking } from "@/lib/bookings";
import { MAX_OPEN_BOOKING_REQUESTS_PER_PET } from "@/lib/constants";
import { getAppUrl } from "@/lib/stripe";

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

export type BookingRequestResult =
  | { ok: true; days: number; amountCents: number }
  | { ok: false; error: string };

const requestSchema = z.object({
  code: z.string().min(1).max(64),
  start: z.string().max(10),
  end: z.string().max(10),
});

/**
 * Creates a booking request from the public booking page. There is no sign-in here (the
 * link's secret code is the only credential), so everything is decided on the server:
 * the price comes from the daycare's current rate, never from the browser. The booking
 * starts as PENDING_PAYMENT and is not a reservation until it is paid.
 */
export async function requestBooking(
  code: string,
  start: string,
  end: string,
): Promise<BookingRequestResult> {
  const parsed = requestSchema.safeParse({ code, start, end });
  if (!parsed.success) {
    return { ok: false, error: "Choose a drop-off and a pick-up date." };
  }

  try {
    const pet = await prisma.pet.findUnique({
      where: { bookingCode: parsed.data.code },
      select: {
        id: true,
        userId: true,
        user: { select: { dailyRateCents: true, stripeChargesEnabled: true } },
      },
    });
    const rateCents = pet?.user.dailyRateCents ?? null;
    if (!pet || rateCents === null || !pet.user.stripeChargesEnabled) {
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
    const outcome = await prisma.$transaction(async (tx) => {
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
      if (same) return { created: false };

      // The link is public, so cap how many unpaid requests it can pile up.
      const open = await tx.booking.count({
        where: { petId: pet.id, status: "PENDING_PAYMENT" },
      });
      if (open >= MAX_OPEN_BOOKING_REQUESTS_PER_PET) {
        return {
          error: "Too many open requests. Please contact your daycare.",
        };
      }

      await tx.booking.create({
        data: {
          startDate,
          endDate,
          days: quote.days,
          dailyRateCents: rateCents,
          amountCents: quote.amountCents,
          petId: pet.id,
          userId: pet.userId,
        },
      });
      return { created: true };
    });
    if ("error" in outcome && outcome.error) {
      return { ok: false, error: outcome.error };
    }

    return { ok: true, days: quote.days, amountCents: quote.amountCents };
  } catch (error) {
    console.error("Failed to create a booking request:", error);
    return {
      ok: false,
      error: "Could not save your request. Please try again.",
    };
  }
}

export type CancelBookingResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels one of the signed-in daycare's unpaid booking requests. Only a request still
 * waiting for payment can be cancelled here: a confirmed (paid) booking needs a refund,
 * which is not built yet.
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
    // Matches on the owner and the status together, so someone else's booking, a paid
    // one and a missing one all look the same.
    const { count } = await prisma.booking.updateMany({
      where: { id: bookingId, userId: auth.userId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (count === 0) {
      return { ok: false, error: "That request can't be cancelled." };
    }
    revalidatePath("/app/bookings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to cancel a booking request:", error);
    return { ok: false, error: "Could not cancel. Please try again." };
  }
}
