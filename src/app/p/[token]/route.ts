import { prisma } from "@/lib/db";
import { readPhotoToken } from "@/lib/photo-links";
import { getObject } from "@/lib/storage";

// Public on purpose (outside /app, no sign-in): this is where an owner lands from an
// email or text. The signed token is the only credential, and it names one photo.
// Anything wrong with it (forged, expired, photo deleted) is the same plain 404.
export async function GET(
  _request: Request,
  context: RouteContext<"/p/[token]">,
) {
  const { token } = await context.params;

  const photoId = readPhotoToken(token);
  if (!photoId) return new Response("Not found", { status: 404 });

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { key: true, contentType: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  const bytes = await getObject(photo.key);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // Not cached by shared caches, and not indexed.
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}
