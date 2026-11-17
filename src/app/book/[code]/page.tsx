import { connection } from "next/server";
import { Suspense } from "react";
import BookingForm from "@/components/booking-form";
import Logo from "@/components/logo";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Book a stay",
  // A private link meant for one owner: keep it out of search results.
  robots: { index: false, follow: false },
};

export default function BookPage(props: PageProps<"/book/[code]">) {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-[#5DC9A8] px-6 py-12 text-zinc-900">
      <Logo />
      <Suspense fallback={<p role="status">Loading…</p>}>
        <BookingDetails params={props.params} />
      </Suspense>
    </main>
  );
}

async function BookingDetails({
  params,
}: {
  params: PageProps<"/book/[code]">["params"];
}) {
  // The earliest bookable day is today's date, so this is request-time work.
  await connection();
  const { code } = await params;

  // Only the fields the page shows: never the owner's contact details or other pets.
  const pet = await prisma.pet.findUnique({
    where: { bookingCode: code },
    select: {
      name: true,
      user: {
        select: {
          name: true,
          dailyRateCents: true,
          stripeChargesEnabled: true,
        },
      },
    },
  });

  // A wrong code, a pet that was removed and a daycare without a rate all look the same.
  if (
    !pet ||
    pet.user.dailyRateCents === null ||
    !pet.user.stripeChargesEnabled
  ) {
    return (
      <section className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Booking isn&apos;t available</h1>
        <p className="mt-2 text-zinc-600">
          This link is no longer active. Please ask your daycare for a new one.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Book a stay for {pet.name}</h1>
      <p className="mt-1 text-zinc-600">
        at {pet.user.name || "your pet's daycare"}
      </p>
      <BookingForm
        code={code}
        rateCents={pet.user.dailyRateCents}
        today={new Date().toISOString().slice(0, 10)}
      />
    </section>
  );
}
