"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { authorize, NOT_SIGNED_IN, SUBSCRIPTION_REQUIRED } from "@/lib/authz";
import { petSelect, recentStays } from "@/lib/data";
import { prisma } from "@/lib/db";
import { lockPet } from "@/lib/locks";
import { deleteObject } from "@/lib/storage";
import { DEFAULT_PET_IMAGE } from "@/lib/constants";
import {
  petFormSchema,
  petIdSchema,
  petSchema,
  staySchema,
  type PetFormData,
} from "@/lib/validations";
import type { Pet, Stay } from "@/lib/types";

// Server actions are public endpoints that can be called without ever loading a
// protected page, so each one resolves the signed-in user itself and scopes its
// queries to that user.

export type PetActionState =
  | { ok: true; pet: Pet }
  | { ok: false; error: string; values: Record<string, string> }
  | null;

// Keep only the text fields so they can be sent back to refill the form.
function echoValues(raw: Record<string, FormDataEntryValue>) {
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function failure(
  error: string,
  raw: Record<string, FormDataEntryValue>,
): PetActionState {
  // Echo the input back so the form can refill itself (React resets it after an action).
  return { ok: false, error, values: echoValues(raw) };
}

function toDbData({
  name,
  ownerName,
  ownerEmail,
  ownerPhone,
  age,
  imageUrl,
  notes,
}: PetFormData) {
  return {
    name,
    ownerName,
    ownerEmail: ownerEmail ?? null,
    ownerPhone: ownerPhone ?? null,
    age,
    // Keep "no custom image" as null so changing the default later still applies.
    imageUrl: imageUrl === DEFAULT_PET_IMAGE ? null : imageUrl,
    notes: notes ?? null,
  };
}

export async function addPet(
  _prevState: PetActionState,
  formData: FormData,
): Promise<PetActionState> {
  const raw = Object.fromEntries(formData.entries());

  const user = await getCurrentUser();
  if (!user) return failure(NOT_SIGNED_IN, raw);
  if (!(await hasAccess(user))) return failure(SUBSCRIPTION_REQUIRED, raw);

  // Server actions are public endpoints, so validate here and don't trust the client.
  const parsed = petFormSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, raw);
  }

  try {
    const pet = await prisma.pet.create({
      data: { ...toDbData(parsed.data), userId: user.id },
      select: petSelect,
    });

    revalidatePath("/app", "layout");

    return { ok: true, pet: petSchema.parse(pet) };
  } catch (error) {
    console.error("Failed to add pet:", error);
    return failure("Could not add the pet. Please try again.", raw);
  }
}

// The pet id is bound on the client (`editPet.bind(null, id)`), which keeps the
// action usable as a plain form submission.
export async function editPet(
  petId: string,
  _prevState: PetActionState,
  formData: FormData,
): Promise<PetActionState> {
  const raw = Object.fromEntries(formData.entries());

  const user = await getCurrentUser();
  if (!user) return failure(NOT_SIGNED_IN, raw);
  if (!(await hasAccess(user))) return failure(SUBSCRIPTION_REQUIRED, raw);

  // Server actions are public endpoints, so the id gets validated like any other input.
  const parsedId = petIdSchema.safeParse(petId);
  if (!parsedId.success) {
    return failure(parsedId.error.issues[0].message, raw);
  }

  const parsed = petFormSchema.safeParse(raw);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, raw);
  }

  try {
    const pet = await prisma.pet.update({
      // Scoped to the owner: someone else's pet is indistinguishable from a missing one.
      where: { id: parsedId.data, userId: user.id },
      data: toDbData(parsed.data),
      select: petSelect,
    });

    revalidatePath("/app", "layout");

    return { ok: true, pet: petSchema.parse(pet) };
  } catch (error) {
    // Prisma throws P2025 when the record to update doesn't exist.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return failure("That pet no longer exists.", raw);
    }
    console.error("Failed to edit pet:", error);
    return failure("Could not save the changes. Please try again.", raw);
  }
}

export type RemovePetResult = { ok: true } | { ok: false; error: string };

/** Permanently deletes a pet and (by cascade) its stay history. */
export async function removePet(petId: string): Promise<RemovePetResult> {
  const auth = await authorize(petId);
  if (!auth.ok) return auth;

  try {
    // The database cascades the photo rows away, but not the files, so note their keys
    // first (scoped to this user, like everything else) and delete the files afterwards.
    const photos = await prisma.photo.findMany({
      where: { petId: auth.petId, userId: auth.userId },
      select: { key: true },
    });

    // deleteMany doesn't throw when the pet is gone (or isn't yours), so removal is idempotent.
    await prisma.pet.deleteMany({
      where: { id: auth.petId, userId: auth.userId },
    });

    await Promise.allSettled(photos.map((photo) => deleteObject(photo.key)));

    revalidatePath("/app", "layout");

    return { ok: true };
  } catch (error) {
    console.error("Failed to remove pet:", error);
    return {
      ok: false,
      error: "Could not remove the pet. Please try again.",
    };
  }
}

// Check-in and check-out return the pet's whole recent-stays list, not just the one that
// changed, so the client can replace its copy and heal if two tabs ever disagreed.
export type StaysResult =
  { ok: true; stays: Stay[] } | { ok: false; error: string };

const PET_GONE = "That pet no longer exists.";

/** Checks a pet in. Idempotent: a pet that is already in stays on its open stay. */
export async function checkInPet(petId: string): Promise<StaysResult> {
  const auth = await authorize(petId);
  if (!auth.ok) return auth;

  try {
    // One transaction holding a lock on the pet, so two quick check-ins can't both see
    // "no open stay" and each create one. The database also refuses a second open stay
    // (the Stay_one_open_per_pet index) as a last line of defence.
    const rows = await prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findFirst({
        where: { id: auth.petId, userId: auth.userId },
        select: { id: true },
      });
      if (!pet) return null;
      // Without this, two simultaneous check-ins could both see "no open stay".
      await lockPet(tx, pet.id);

      const open = await tx.stay.findFirst({
        where: { petId: pet.id, checkedOutAt: null },
        select: { id: true },
      });
      if (!open) {
        await tx.stay.create({
          data: { petId: pet.id, userId: auth.userId, checkedInAt: new Date() },
        });
      }
      return tx.stay.findMany({ where: { petId: pet.id }, ...recentStays });
    });
    if (!rows) return { ok: false, error: PET_GONE };

    revalidatePath("/app", "layout");

    return { ok: true, stays: staySchema.array().parse(rows) };
  } catch (error) {
    console.error("Failed to check in pet:", error);
    return { ok: false, error: "Could not check in. Please try again." };
  }
}

/** Checks a pet out. Idempotent: checking out a pet that is not in changes nothing. */
export async function checkOutPet(petId: string): Promise<StaysResult> {
  const auth = await authorize(petId);
  if (!auth.ok) return auth;

  try {
    const rows = await prisma.$transaction(async (tx) => {
      const pet = await tx.pet.findFirst({
        where: { id: auth.petId, userId: auth.userId },
        select: { id: true },
      });
      if (!pet) return null;

      await tx.stay.updateMany({
        where: { petId: pet.id, userId: auth.userId, checkedOutAt: null },
        data: { checkedOutAt: new Date() },
      });
      return tx.stay.findMany({ where: { petId: pet.id }, ...recentStays });
    });
    if (!rows) return { ok: false, error: PET_GONE };

    revalidatePath("/app", "layout");

    return { ok: true, stays: staySchema.array().parse(rows) };
  } catch (error) {
    console.error("Failed to check out pet:", error);
    return { ok: false, error: "Could not check out. Please try again." };
  }
}
