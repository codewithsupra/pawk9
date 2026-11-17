import { prisma } from "@/lib/db";
import type { Pet } from "@/lib/types";
import { petSchema } from "@/lib/validations";

// How many of a pet's most recent visits travel with it to the browser.
const STAYS_SHOWN = 10;

/** The query for a pet's recent visits, newest first. Shared so every result matches. */
export const recentStays = {
  orderBy: { checkedInAt: "desc" },
  take: STAYS_SHOWN,
  select: { id: true, checkedInAt: true, checkedOutAt: true },
} as const;

// How many of a pet's most recent photos travel with it to the browser.
const PHOTOS_SHOWN = 12;

/** The query for a pet's recent photos, newest first. Shared so every result matches. */
export const recentPhotos = {
  orderBy: { createdAt: "desc" },
  take: PHOTOS_SHOWN,
  select: {
    id: true,
    createdAt: true,
    // Only the latest send, to show "Sent" on the thumbnail.
    sends: {
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { createdAt: true },
    },
  },
} as const;

/**
 * The fields of a pet the UI uses, including its recent visits. Shared by every query
 * that returns a pet (reads, and the results of create/update) so they stay identical.
 */
export const petSelect = {
  id: true,
  name: true,
  ownerName: true,
  imageUrl: true,
  age: true,
  notes: true,
  ownerEmail: true,
  ownerPhone: true,
  stays: recentStays,
  photos: recentPhotos,
} as const;

/**
 * A user's own pets. `userId` is required so there is no way to ask for pets without
 * saying whose, and it always comes from the signed-in session, never from the client.
 */
export async function getPets(userId: string): Promise<Pet[]> {
  const pets = await prisma.pet.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: petSelect,
  });

  // Parsing turns database nulls into the default image / undefined.
  return petSchema.array().parse(pets);
}

/** How many pets a user has, without loading them. */
export async function countPets(userId: string) {
  return prisma.pet.count({ where: { userId } });
}
