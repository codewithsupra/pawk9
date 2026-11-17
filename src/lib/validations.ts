import { z } from "zod";
import { DEFAULT_PET_IMAGE } from "@/lib/constants";

const emptyToUndefined = (value: string | null | undefined) =>
  value || undefined;

// Empty, missing or null all mean "no custom image", so every pet ends up with one.
const withDefaultImage = (value: string | null | undefined) =>
  value || DEFAULT_PET_IMAGE;

// Owner contact details. Both are optional: an empty field means "none".
const ownerEmailField = z
  .string()
  .trim()
  .max(254, "Email is too long")
  .pipe(
    z.union([z.literal(""), z.email({ error: "Enter a valid email address" })]),
  )
  .optional()
  .transform((value) => value?.toLowerCase() || undefined);

// Spaces, dashes, dots and brackets are stripped, so "+1 (415) 555-2671" is stored as
// "+14155552671". Country-code handling is left to whatever sends the texts.
const ownerPhoneField = z
  .string()
  .trim()
  .max(40, "Phone number is too long")
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(
    z.union([
      z.literal(""),
      z
        .string()
        .regex(
          /^\+?\d{7,15}$/,
          "Enter a valid phone number, e.g. +1 415 555 2671",
        ),
    ]),
  )
  .optional()
  .transform(emptyToUndefined);

// One definition of "a valid pet id", shared by petSchema and the edit/checkout actions.
export const petIdSchema = z.string().min(1, "Pet not found.");

export const petFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name is too long"),
  ownerName: z
    .string()
    .trim()
    .min(1, "Owner name is required")
    .max(100, "Owner name is too long"),
  ownerEmail: ownerEmailField,
  ownerPhone: ownerPhoneField,
  // Form fields arrive as strings; treat an empty field as missing, not 0.
  age: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z
      .number("Age is required")
      .int("Age must be a whole number")
      .min(0, "Age can't be negative")
      .max(100, "Age is too high"),
  ),
  imageUrl: z
    .string()
    .trim()
    .pipe(
      z.union([
        z.literal(""),
        z.url({
          protocol: /^https?$/,
          error: "Image URL must be a valid http(s) URL",
        }),
      ]),
    )
    .optional()
    .transform(withDefaultImage),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes are too long")
    .optional()
    .transform(emptyToUndefined),
});

// What the form fields hold before validation (age is still a string, etc.).
export type PetFormValues = z.input<typeof petFormSchema>;
// What validation produces: trimmed, age as a number, image URL always set.
export type PetFormData = z.output<typeof petFormSchema>;

// A pet as the UI uses it. Parse database rows with this: nulls become the default
// image / undefined, so components never have to handle a missing image.
// One visit. A null checkedOutAt means the pet is still in.
export const staySchema = z.object({
  id: z.string(),
  checkedInAt: z.date(),
  checkedOutAt: z.date().nullable(),
});

// A photo as the UI needs it. The image is fetched from /api/photos/<id>.
export const photoSchema = z
  .object({
    id: z.string(),
    createdAt: z.date(),
    // The newest send only (see recentPhotos in lib/data.ts).
    sends: z.array(z.object({ createdAt: z.date() })).default([]),
  })
  .transform(({ sends, ...photo }) => ({
    ...photo,
    /** When this photo was last emailed to the owner, or null if never. */
    lastSentAt: sends[0]?.createdAt ?? null,
  }));

export const petSchema = z.object({
  id: petIdSchema,
  name: z.string(),
  ownerName: z.string(),
  age: z.number(),
  imageUrl: z.string().nullish().transform(withDefaultImage),
  notes: z.string().nullish().transform(emptyToUndefined),
  ownerEmail: z.string().nullish().transform(emptyToUndefined),
  ownerPhone: z.string().nullish().transform(emptyToUndefined),
  // The most recent visits, newest first (see petSelect in lib/data.ts).
  stays: z.array(staySchema).default([]),
  // The most recent photos, newest first (see recentPhotos in lib/data.ts).
  photos: z.array(photoSchema).default([]),
});
