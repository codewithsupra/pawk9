import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring links to a single photo, for messages sent to a pet's owner (an email
// or text has no sign-in session, so /api/photos/[id] can't be used). The token carries
// the photo id and an expiry time; a signature made with PHOTO_LINK_SECRET stops anyone
// from editing either. It grants access to exactly that one photo until it expires.

/** How long a link works: long enough for an owner to open it later, not forever. */
export const PHOTO_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.PHOTO_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PHOTO_LINK_SECRET is missing or shorter than 32 characters",
    );
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Returns an opaque token for the photo that stops working after `ttlMs`. */
export function createPhotoToken(
  photoId: string,
  now = Date.now(),
  ttlMs = PHOTO_LINK_TTL_MS,
) {
  const payload = Buffer.from(
    JSON.stringify({ p: photoId, e: now + ttlMs }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The photo id inside a valid, unexpired token, otherwise null (never throws on junk). */
export function readPhotoToken(token: string, now = Date.now()) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const data: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      typeof data === "object" &&
      data !== null &&
      "p" in data &&
      "e" in data &&
      typeof data.p === "string" &&
      typeof data.e === "number" &&
      data.e > now
    ) {
      return data.p;
    }
  } catch {
    // Signed but not readable: treat like any other bad token.
  }
  return null;
}
