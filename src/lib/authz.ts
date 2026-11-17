import { getCurrentUser, hasAccess } from "@/lib/auth";
import { petIdSchema } from "@/lib/validations";

export const NOT_SIGNED_IN = "You must be signed in to do that.";
export const SUBSCRIPTION_REQUIRED =
  "An active subscription or lifetime access is required.";

export type AuthorizedUser =
  { ok: true; userId: string } | { ok: false; error: string };

export type Authorized =
  { ok: true; userId: string; petId: string } | { ok: false; error: string };

/**
 * Who is calling, and are they allowed in? Server actions are public endpoints, so this
 * can't be left to the page that happens to call them.
 */
export async function authorizeUser(): Promise<AuthorizedUser> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  if (!(await hasAccess(user))) {
    return { ok: false, error: SUBSCRIPTION_REQUIRED };
  }
  return { ok: true, userId: user.id };
}

/** The first thing every pet-related action does: the above, plus "is the pet id sane". */
export async function authorize(petId: string): Promise<Authorized> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;
  const parsedId = petIdSchema.safeParse(petId);
  if (!parsedId.success) {
    return { ok: false, error: parsedId.error.issues[0].message };
  }
  return { ok: true, userId: auth.userId, petId: parsedId.data };
}
