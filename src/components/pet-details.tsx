"use client";

import Image from "next/image";
import { usePetContext } from "@/lib/hooks";
import { formatDuration, getCurrentStay } from "@/lib/stays";
import type { Pet, Stay } from "@/lib/types";
import PetButton from "@/components/pet-button";
import PetBookingLink from "@/components/pet-booking-link";
import PetPhotos from "@/components/pet-photos";

// Formatted in the browser's own locale and time zone. This panel only renders after a
// pet is selected (on the client), so there is no server-rendered text to mismatch.
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export default function PetDetails() {
  const { selectedPet } = usePetContext();

  if (!selectedPet) {
    return <EmptyView />;
  }

  return (
    <section className="flex h-full w-full flex-col bg-white">
      <TopBar pet={selectedPet} />
      <OtherInfo pet={selectedPet} />
      <Contact pet={selectedPet} />
      <Notes pet={selectedPet} />
      <PetPhotos pet={selectedPet} />
      <PetBookingLink pet={selectedPet} />
      <RecentStays stays={selectedPet.stays} />
    </section>
  );
}

function TopBar({ pet }: { pet: Pet }) {
  const { checkInPet, checkOutPet, removePet } = usePetContext();
  const isIn = getCurrentStay(pet) !== null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-black/8 bg-zinc-50 px-8 py-6">
      <Image
        src={pet.imageUrl}
        alt={pet.name}
        width={75}
        height={75}
        className="size-18.75 shrink-0 rounded-full object-cover ring-4 ring-white shadow-sm"
      />
      <h2 className="min-w-0 flex-1 truncate text-3xl font-semibold tracking-tight">
        {pet.name}
      </h2>
      <div className="flex flex-wrap gap-2">
        {isIn ? (
          <PetButton
            actionType="checkOut"
            onClick={() => checkOutPet(pet.id)}
          />
        ) : (
          <PetButton actionType="checkIn" onClick={() => checkInPet(pet.id)} />
        )}
        <PetButton actionType="edit" />
        <PetButton
          actionType="remove"
          petName={pet.name}
          onClick={() => removePet(pet.id)}
        />
      </div>
    </div>
  );
}

function OtherInfo({ pet }: { pet: Pet }) {
  const current = getCurrentStay(pet);

  return (
    <dl className="grid grid-cols-3 gap-6 px-8 py-8 text-center">
      <Field label="Owner name" value={pet.ownerName || "Unknown"} />
      <Field label="Age" value={formatAge(pet.age)} />
      <Field
        label="Status"
        value={
          current
            ? `In since ${timeFormat.format(current.checkedInAt)}`
            : "Not checked in"
        }
        highlight={current !== null}
      />
    </dl>
  );
}

// 0 is a real age (a puppy under a year old), so don't treat it as missing.
function formatAge(age: number) {
  if (age === 0) return "Under a year";
  return `${age} ${age === 1 ? "year" : "years"}`;
}

function Field({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
        {label}
      </dt>
      <dd
        className={
          highlight
            ? "mt-1 truncate text-lg font-medium text-emerald-700"
            : "mt-1 truncate text-lg text-zinc-800"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Contact({ pet }: { pet: Pet }) {
  const hasContact = pet.ownerEmail || pet.ownerPhone;

  return (
    <div className="mx-8 mb-4 rounded-md border border-black/8 bg-zinc-50 px-6 py-5">
      <h3 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
        Owner contact
      </h3>
      {hasContact ? (
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-base">
          {pet.ownerEmail && (
            <div className="min-w-0">
              <dt className="sr-only">Email</dt>
              <dd className="truncate">
                <a
                  href={`mailto:${pet.ownerEmail}`}
                  className="text-zinc-800 underline-offset-2 hover:underline"
                >
                  {pet.ownerEmail}
                </a>
              </dd>
            </div>
          )}
          {pet.ownerPhone && (
            <div>
              <dt className="sr-only">Phone</dt>
              <dd>
                <a
                  href={`tel:${pet.ownerPhone}`}
                  className="text-zinc-800 underline-offset-2 hover:underline"
                >
                  {pet.ownerPhone}
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-2 text-base text-zinc-500">
          No contact details yet. Use Edit to add an email or phone number.
        </p>
      )}
    </div>
  );
}

function Notes({ pet }: { pet: Pet }) {
  return (
    <div className="mx-8 rounded-md border border-black/8 bg-zinc-50 px-6 py-5">
      <h3 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
        Notes
      </h3>
      <p className="mt-2 text-base leading-relaxed text-zinc-800">
        {pet.notes || "No notes available."}
      </p>
    </div>
  );
}

function RecentStays({ stays }: { stays: Stay[] }) {
  return (
    <div className="mx-8 mt-4 mb-8 min-h-44 flex-1 rounded-md border border-black/8 bg-zinc-50 px-6 py-5">
      <h3 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
        Recent stays
      </h3>
      {stays.length === 0 ? (
        <p className="mt-2 text-base text-zinc-600">No stays yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-black/8">
          {stays.map((stay) => (
            <StayRow key={stay.id} stay={stay} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StayRow({ stay }: { stay: Stay }) {
  const { checkedInAt, checkedOutAt } = stay;
  // A stay that ends on a later day names that day, so "9:00 AM → 8:00 AM" isn't a puzzle.
  const endsOtherDay =
    checkedOutAt !== null &&
    dayFormat.format(checkedOutAt) !== dayFormat.format(checkedInAt);

  return (
    <li className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="w-28 shrink-0 font-medium text-zinc-800">
        {dayFormat.format(checkedInAt)}
      </span>
      <span className="min-w-0 flex-1 text-zinc-600">
        {timeFormat.format(checkedInAt)} →{" "}
        {checkedOutAt === null
          ? "now"
          : `${endsOtherDay ? `${dayFormat.format(checkedOutAt)}, ` : ""}${timeFormat.format(checkedOutAt)}`}
      </span>
      <span
        className={
          checkedOutAt === null
            ? "shrink-0 font-medium text-emerald-700"
            : "shrink-0 text-zinc-700 tabular-nums"
        }
      >
        {checkedOutAt === null
          ? "In progress"
          : formatDuration(checkedInAt, checkedOutAt)}
      </span>
    </li>
  );
}

function EmptyView() {
  return (
    <section className="flex h-full w-full items-center justify-center px-8 py-16">
      <p className="text-center text-lg text-zinc-400">
        Select a pet to see its details
      </p>
    </section>
  );
}
