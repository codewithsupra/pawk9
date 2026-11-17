import { getCurrentUser, hasAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

// Serves a pet photo. Photos are private: there is no public file URL, so this is the
// only way to read one, and it only answers for a signed-in user with access who owns the
// pet. Anyone else gets a 404, which doesn't reveal whether the photo exists.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/photos/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!(await hasAccess(user))) {
    return new Response("Subscription required", { status: 403 });
  }

  const { id } = await context.params;
  const photo = await prisma.photo.findFirst({
    where: { id, userId: user.id },
    select: { key: true, contentType: true },
  });
  if (!photo) return new Response("Not found", { status: 404 });

  const bytes = await getObject(photo.key);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      // The type comes from what we verified at upload, never from the request.
      "Content-Type": photo.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      // Stops a browser guessing a different type from the content.
      "X-Content-Type-Options": "nosniff",
      // Private: a shared cache or proxy must never keep another user's photo.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
