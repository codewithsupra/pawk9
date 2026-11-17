"use client";

import { usePetContext } from "@/lib/hooks";
import { isCheckedIn } from "@/lib/stays";

export default function Stats() {
  // Counts every pet, not just the ones the search box is showing: "who is here now"
  // shouldn't change as you type.
  const { pets } = usePetContext();
  const guests = pets.filter(isCheckedIn).length;

  return (
    <section className="text-center">
      <p className="text-2xl font-bold leading-6">{guests}</p>
      <p className="opacity-80">Current guests</p>
      <p className="text-xs opacity-60">
        of {pets.length} {pets.length === 1 ? "pet" : "pets"}
      </p>
    </section>
  );
}
