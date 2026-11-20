import { describe, expect, it } from "vitest";
import { detectImageType } from "@/lib/images";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectImageType", () => {
  it("recognises JPEG", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({
      contentType: "image/jpeg",
      extension: "jpg",
    });
  });

  it("recognises PNG", () => {
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toEqual({ contentType: "image/png", extension: "png" });
  });

  it("recognises WebP (RIFF....WEBP)", () => {
    const webp = bytes(
      ...[0x52, 0x49, 0x46, 0x46],
      ...[0, 0, 0, 0],
      ...[0x57, 0x45, 0x42, 0x50],
    );
    expect(detectImageType(webp)).toEqual({
      contentType: "image/webp",
      extension: "webp",
    });
  });

  it("refuses a RIFF file that is not WebP (for example a WAV)", () => {
    const wav = bytes(
      ...[0x52, 0x49, 0x46, 0x46],
      ...[0, 0, 0, 0],
      ...[0x57, 0x41, 0x56, 0x45],
    );
    expect(detectImageType(wav)).toBeNull();
  });

  it("refuses SVG, which can carry scripts", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(detectImageType(svg)).toBeNull();
  });

  it("refuses HTML dressed up as an image", () => {
    expect(
      detectImageType(new TextEncoder().encode("<html><body>hi</body></html>")),
    ).toBeNull();
  });

  it("refuses empty and truncated input", () => {
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
