import type Stripe from "stripe";
import { formatMoney } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { SITE_NAME } from "@/lib/site";
import { getStripe } from "@/lib/stripe";

// Booking days are stored as UTC midnight, so show them in UTC or they'd shift a day.
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Tells the owner and the daycare that a booking is confirmed. Called once, by the
 * webhook, when a booking *becomes* confirmed (a replayed event never gets here, so
 * nobody gets two emails). It never throws: the payment is already safely recorded, and
 * a failed email must not make Stripe retry the whole delivery. Failures are logged.
 */
export async function notifyBookingConfirmed(session: Stripe.Checkout.Session) {
  try {
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) return;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        startDate: true,
        endDate: true,
        days: true,
        amountCents: true,
        platformFeeCents: true,
        pet: { select: { name: true, ownerName: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!booking) return;

    const dates = `${dayFormat.format(booking.startDate)} to ${dayFormat.format(booking.endDate)}`;
    const daysText = `${booking.days} ${booking.days === 1 ? "day" : "days"}`;
    const total = formatMoney(booking.amountCents);
    const daycare = booking.user.name || "Your pet's daycare";
    // Phone-only sign-ups get a placeholder address that isn't real (see lib/auth.ts).
    const daycareEmail = booking.user.email.endsWith(".local")
      ? null
      : booking.user.email;

    const jobs: Promise<void>[] = [];

    // The owner typed this at Stripe's payment page; we never asked for it ourselves.
    const ownerEmail = session.customer_details?.email;
    if (ownerEmail) {
      jobs.push(
        sendEmail({
          to: ownerEmail,
          fromName: daycare,
          replyTo: daycareEmail ?? undefined,
          subject: `Booking confirmed for ${booking.pet.name}`,
          html: `<p>Hi,</p>
<p>${escapeHtml(daycare)} has confirmed ${escapeHtml(booking.pet.name)}'s stay.</p>
<ul><li><strong>Dates:</strong> ${escapeHtml(dates)} (${daysText})</li><li><strong>Paid:</strong> ${total}</li></ul>
<p>Stripe sends your receipt separately. Just reply to this email if you need to change anything.</p>`,
          text: `${daycare} has confirmed ${booking.pet.name}'s stay.\n\nDates: ${dates} (${daysText})\nPaid: ${total}\n\nStripe sends your receipt separately. Just reply to this email if you need to change anything.`,
        }),
      );
    }

    if (daycareEmail) {
      const receives = formatMoney(
        booking.amountCents - booking.platformFeeCents,
      );
      jobs.push(
        sendEmail({
          to: daycareEmail,
          fromName: SITE_NAME,
          subject: `New booking: ${booking.pet.name}, ${dates}`,
          html: `<p>A booking was paid and confirmed.</p>
<ul><li><strong>Pet:</strong> ${escapeHtml(booking.pet.name)} (${escapeHtml(booking.pet.ownerName)})</li><li><strong>Dates:</strong> ${escapeHtml(dates)} (${daysText})</li><li><strong>Paid by the owner:</strong> ${total}</li><li><strong>You receive:</strong> ${receives}</li></ul>
<p>See all bookings in your ${SITE_NAME} account.</p>`,
          text: `A booking was paid and confirmed.\n\nPet: ${booking.pet.name} (${booking.pet.ownerName})\nDates: ${dates} (${daysText})\nPaid by the owner: ${total}\nYou receive: ${receives}\n\nSee all bookings in your ${SITE_NAME} account.`,
        }),
      );
    }

    const results = await Promise.allSettled(jobs);
    for (const result of results) {
      // Log why, never who: the addresses are personal data.
      if (result.status === "rejected") {
        console.error(
          `Booking ${bookingId}: a confirmation email failed:`,
          result.reason,
        );
      }
    }
  } catch (error) {
    console.error("Could not send booking confirmation emails:", error);
  }
}

/**
 * Tells the owner their paid booking was cancelled and refunded. Like the confirmation it
 * never throws: the refund already happened, and a failed email must not undo or hide
 * that. The owner's address is only known to Stripe (typed at its payment page), so it is
 * read back from the booking's Checkout Session.
 */
export async function notifyBookingCancelled(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        startDate: true,
        endDate: true,
        amountCents: true,
        stripeSessionId: true,
        pet: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!booking?.stripeSessionId) return;

    const session = await getStripe().checkout.sessions.retrieve(
      booking.stripeSessionId,
    );
    const ownerEmail = session.customer_details?.email;
    if (!ownerEmail) return;

    const dates = `${dayFormat.format(booking.startDate)} to ${dayFormat.format(booking.endDate)}`;
    const total = formatMoney(booking.amountCents);
    const daycare = booking.user.name || "Your pet's daycare";
    const daycareEmail = booking.user.email.endsWith(".local")
      ? undefined
      : booking.user.email;

    await sendEmail({
      to: ownerEmail,
      fromName: daycare,
      replyTo: daycareEmail,
      subject: `Booking cancelled for ${booking.pet.name}`,
      html: `<p>Hi,</p>
<p>${escapeHtml(daycare)} had to cancel ${escapeHtml(booking.pet.name)}'s stay (${escapeHtml(dates)}).</p>
<p>You have been refunded ${total} in full. It can take 5 to 10 business days to appear on your statement. Reply to this email if you have questions.</p>`,
      text: `${daycare} had to cancel ${booking.pet.name}'s stay (${dates}).\n\nYou have been refunded ${total} in full. It can take 5 to 10 business days to appear on your statement. Reply to this email if you have questions.`,
    });
  } catch (error) {
    console.error(
      `Booking ${bookingId}: the cancellation email failed:`,
      error,
    );
  }
}
