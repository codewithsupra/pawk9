import { beforeEach, describe, expect, it } from "vitest";
import {
  PHOTO_LINK_TTL_MS,
  createPhotoToken,
  readPhotoToken,
} from "@/lib/photo-links";

const NOW = 1_800_000_000_000;

beforeEach(() => {
  process.env.PHOTO_LINK_SECRET = "a".repeat(40);
});

describe("photo links", () => {
  it("round-trips a photo id", () => {
    const token = createPhotoToken("photo-1", NOW);
    expect(readPhotoToken(token, NOW + 1000)).toBe("photo-1");
  });

  it("stops working after the expiry time", () => {
    const token = createPhotoToken("photo-1", NOW);
    expect(readPhotoToken(token, NOW + PHOTO_LINK_TTL_MS - 1)).toBe("photo-1");
    expect(readPhotoToken(token, NOW + PHOTO_LINK_TTL_MS + 1)).toBeNull();
  });

  it("rejects a token whose photo id was edited", () => {
    const [, signature] = createPhotoToken("photo-1", NOW).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ p: "photo-2", e: NOW + PHOTO_LINK_TTL_MS }),
    ).toString("base64url");
    expect(readPhotoToken(`${forgedPayload}.${signature}`, NOW)).toBeNull();
  });

  it("rejects a token whose expiry was extended", () => {
    const [, signature] = createPhotoToken("photo-1", NOW).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ p: "photo-1", e: NOW + 100 * PHOTO_LINK_TTL_MS }),
    ).toString("base64url");
    expect(readPhotoToken(`${forgedPayload}.${signature}`, NOW)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createPhotoToken("photo-1", NOW);
    process.env.PHOTO_LINK_SECRET = "b".repeat(40);
    expect(readPhotoToken(token, NOW)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "not-a-token.at-all"])(
    "returns null instead of throwing for junk %j",
    (junk) => {
      expect(readPhotoToken(junk, NOW)).toBeNull();
    },
  );

  it("refuses to make links without a long enough secret", () => {
    process.env.PHOTO_LINK_SECRET = "short";
    expect(() => createPhotoToken("photo-1", NOW)).toThrow();
  });
});
