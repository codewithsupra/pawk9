// Pure helpers for validating uploaded photos. Safe to import from server and client.

// Kept under both Next's server-action body limit (raised to 4mb in next.config.ts) and
// Vercel's 4.5 MB request limit. The browser shrinks photos long before this matters.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_PET = 50;

export type PhotoType = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/**
 * What an image really is, judged by its first bytes, not by its file name or the type
 * the browser claims (both are chosen by whoever uploads). Only JPEG, PNG and WebP are
 * accepted. SVG is refused on purpose: it can carry scripts.
 */
export function detectImageType(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  // WebP is "RIFF" <4 size bytes> "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}
