import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CancelBookingButton from "@/components/cancel-booking-button";
import ContentBlock from "@/components/content-block";
import RefundBookingButton from "@/components/refund-booking-button";
import H1 from "@/components/h1";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/bookings";
import { getBookings } from "@/lib/data";
import { SIGN_IN } from "@/lib/redirects";

// Booking days are stored as UTC midnight, so show them in UTC or they'd shift a day.
const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS = {
  PENDING_PAYMENT: {
    label: "Waiting for payment",
    className: "bg-amber-100 text-amber-900",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-800",
  },
  CANCELLED: { label: "Cancelled", className: "bg-zinc-200 text-zinc-700" },
} as const;

export default function BookingsPage() {
  return (
    <main>
      <H1 className="my-8 text-white">Bookings</H1>
      <Suspense
        fallback={
          <ContentBlock className="p-8">
            <p role="status">Loading bookings…</p>
          </ContentBlock>
        }
      >
        <BookingList />
      </Suspense>
    </main>
  );
}

async function BookingList() {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN); // The proxy already guards /app; this is a backstop.

  const bookings = await getBookings(user.id);
  // Reads today's date (to hide the refund button on stays that already ended), which
  // cacheComponents only allows once the page is known to be rendered per request.
  await connection();
  const today = new Date(
    `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
  );

  if (bookings.length === 0) {
    return (
      <ContentBlock className="p-8">
        <p className="text-zinc-700">
          No booking requests yet. Open a pet on the dashboard and use{" "}
          <strong>Copy booking link</strong> to send an owner a link.
        </p>
      </ContentBlock>
    );
  }

  return (
    <ContentBlock className="p-2 sm:p-4">
      <ul className="divide-y divide-black/8">
        {bookings.map((booking) => {
          const refunded = booking.status === "CANCELLED" && booking.refundedAt;
          const status = refunded
            ? {
                label: "Cancelled and refunded",
                className: "bg-zinc-200 text-zinc-700",
              }
            : STATUS[booking.status];
          return (
            <li
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">
                  {booking.pet.name}
                  <span className="ml-2 text-base font-normal text-zinc-600">
                    {booking.pet.ownerName}
                  </span>
                </p>
                <p className="text-zinc-700">
                  {dayFormat.format(booking.startDate)} to{" "}
                  {dayFormat.format(booking.endDate)} · {booking.days}{" "}
                  {booking.days === 1 ? "day" : "days"} ·{" "}
                  <span className="font-medium">
                    {formatMoney(booking.amountCents)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
                {booking.status === "PENDING_PAYMENT" && (
                  <CancelBookingButton
                    bookingId={booking.id}
                    petName={booking.pet.name}
                  />
                )}
                {booking.status === "CONFIRMED" && booking.endDate >= today && (
                  <RefundBookingButton
                    bookingId={booking.id}
                    petName={booking.pet.name}
                    amount={formatMoney(booking.amountCents)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ContentBlock>
  );
}
