"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { authorize, authorizeUser } from "@/lib/authz";
import {
  PHOTO_RESEND_COOLDOWN_MS,
  PHOTO_SENDS_PER_HOUR,
} from "@/lib/constants";
import { recentPhotos } from "@/lib/data";
import { prisma } from "@/lib/db";
import {
  detectImageType,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PET,
} from "@/lib/images";
import { sendPhotoEmail } from "@/lib/email";
import { createPhotoToken } from "@/lib/photo-links";
import { deleteObject, putObject } from "@/lib/storage";
import { getAppUrl } from "@/lib/stripe";
import type { Photo } from "@/lib/types";
import { photoSchema } from "@/lib/validations";

// Both actions return the pet's whole recent-photos list, which the client swaps in, so
// two tabs that disagreed heal on the next action (the same approach as stays).
export type PhotosResult =
  { ok: true; petId: string; photos: Photo[] } | { ok: false; error: string };

const PET_GONE = "That pet no longer exists.";

async function recentPhotosOf(petId: string) {
  const rows = await prisma.photo.findMany({
    where: { petId },
    ...recentPhotos,
  });
  return photoSchema.array().parse(rows);
}

/** Saves an uploaded photo for a pet. */
export async function addPetPhoto(
  petId: string,
  formData: FormData,
): Promise<PhotosResult> {
  const auth = await authorize(petId);
  if (!auth.ok) return auth;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `That photo is too large (the limit is ${MAX_PHOTO_BYTES / 1024 / 1024} MB).`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The file's real type comes from its bytes: its name and claimed type are the
  // uploader's to choose.
  const type = detectImageType(bytes);
  if (!type) {
    return { ok: false, error: "Only JPEG, PNG or WebP photos are supported." };
  }

  try {
    const pet = await prisma.pet.findFirst({
      where: { id: auth.petId, userId: auth.userId },
      select: { id: true },
    });
    if (!pet) return { ok: false, error: PET_GONE };

    const count = await prisma.photo.count({ where: { petId: pet.id } });
    if (count >= MAX_PHOTOS_PER_PET) {
      return {
        ok: false,
        error: `A pet can have up to ${MAX_PHOTOS_PER_PET} photos. Delete one to add another.`,
      };
    }

    // File first, then the database row; if the row fails, take the file back out so no
    // orphan is left on disk.
    const key = `photos/${crypto.randomUUID()}.${type.extension}`;
    await putObject(key, bytes);
    try {
      await prisma.photo.create({
        data: {
          key,
          contentType: type.contentType,
          sizeBytes: bytes.length,
          petId: pet.id,
          userId: auth.userId,
        },
      });
    } catch (error) {
      await deleteObject(key).catch(() => {});
      throw error;
    }

    revalidatePath("/app", "layout");

    return { ok: true, petId: pet.id, photos: await recentPhotosOf(pet.id) };
  } catch (error) {
    console.error("Failed to save photo:", error);
    return { ok: false, error: "Could not save the photo. Please try again." };
  }
}

/** Deletes one of the signed-in user's photos (the database row, then the file). */
export async function removePetPhoto(photoId: string): Promise<PhotosResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  if (typeof photoId !== "string" || photoId.length === 0) {
    return { ok: false, error: "That photo no longer exists." };
  }

  try {
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, userId: auth.userId },
      select: { id: true, key: true, petId: true },
    });
    // Someone else's photo is indistinguishable from a missing one.
    if (!photo) return { ok: false, error: "That photo no longer exists." };

    await prisma.photo.deleteMany({
      where: { id: photo.id, userId: auth.userId },
    });
    await deleteObject(photo.key).catch((error) =>
      console.error("Photo row deleted but its file could not be:", error),
    );

    revalidatePath("/app", "layout");

    return {
      ok: true,
      petId: photo.petId,
      photos: await recentPhotosOf(photo.petId),
    };
  } catch (error) {
    console.error("Failed to remove photo:", error);
    return {
      ok: false,
      error: "Could not delete the photo. Please try again.",
    };
  }
}

/** Emails one of the signed-in user's photos to the pet's owner, as a 7-day link. */
export async function sendPhotoToOwner(photoId: string): Promise<PhotosResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  if (typeof photoId !== "string" || photoId.length === 0) {
    return { ok: false, error: "That photo no longer exists." };
  }

  let reservationId: string | null = null;
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: photoId, userId: auth.userId },
      select: {
        id: true,
        petId: true,
        pet: { select: { name: true, ownerName: true, ownerEmail: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!photo) return { ok: false, error: "That photo no longer exists." };

    const to = photo.pet.ownerEmail;
    if (!to) {
      return {
        ok: false,
        error: `${photo.pet.name} has no owner email. Use Edit to add one.`,
      };
    }

    // Check the limits and record the send in one transaction, before sending, so two
    // clicks at once can't both pass. If the email then fails, the record is removed.
    const now = Date.now();
    const reservation = await prisma.$transaction(async (tx) => {
      const recentOfPhoto = await tx.photoSend.findFirst({
        where: {
          photoId: photo.id,
          createdAt: { gt: new Date(now - PHOTO_RESEND_COOLDOWN_MS) },
        },
        select: { id: true },
      });
      if (recentOfPhoto) {
        return {
          error: "You already sent this photo today. Try again tomorrow.",
        };
      }
      const lastHour = await tx.photoSend.count({
        where: {
          userId: auth.userId,
          createdAt: { gt: new Date(now - 60 * 60 * 1000) },
        },
      });
      if (lastHour >= PHOTO_SENDS_PER_HOUR) {
        return {
          error: `You can send up to ${PHOTO_SENDS_PER_HOUR} photos per hour. Try again later.`,
        };
      }
      const created = await tx.photoSend.create({
        data: { photoId: photo.id, petId: photo.petId, userId: auth.userId },
        select: { id: true },
      });
      return { id: created.id };
    });
    if (!reservation.id) {
      return { ok: false, error: reservation.error ?? "Could not send." };
    }
    reservationId = reservation.id;

    const requestHeaders = await headers();
    const base = getAppUrl(
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto") ?? "http",
    );

    await sendPhotoEmail({
      to,
      ownerName: photo.pet.ownerName,
      petName: photo.pet.name,
      daycareName: photo.user.name || "Your pet's daycare",
      replyTo: photo.user.email,
      photoUrl: `${base}/p/${createPhotoToken(photo.id)}`,
    });

    revalidatePath("/app", "layout");

    return {
      ok: true,
      petId: photo.petId,
      photos: await recentPhotosOf(photo.petId),
    };
  } catch (error) {
    // The owner's address is personal data: log the failure, not the address.
    console.error("Failed to send photo:", error);
    // Not sent, so it must not count as sent.
    if (reservationId) {
      await prisma.photoSend
        .delete({ where: { id: reservationId } })
        .catch(() => {});
    }
    return { ok: false, error: "Could not send the email. Please try again." };
  }
}
