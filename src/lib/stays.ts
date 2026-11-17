import type { Pet, Stay } from "@/lib/types";

// Pure helpers, safe to use from server and client code alike.

/** The visit the pet is on right now, if any. */
export function getCurrentStay(pet: Pick<Pet, "stays">): Stay | null {
  return pet.stays.find((stay) => stay.checkedOutAt === null) ?? null;
}

export function isCheckedIn(pet: Pick<Pet, "stays">) {
  return getCurrentStay(pet) !== null;
}

/** "45m", "3h 12m", "2d 4h". Rounds down to the minute; under a minute reads "<1m". */
export function formatDuration(from: Date, to: Date) {
  const totalMinutes = Math.max(
    0,
    Math.floor((to.getTime() - from.getTime()) / 60_000),
  );
  if (totalMinutes < 1) return "<1m";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
