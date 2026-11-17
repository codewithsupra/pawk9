import { auth, currentUser } from "@clerk/nextjs/server";
import { PRO_PLAN } from "@/lib/constants";
import { prisma } from "@/lib/db";

// Prisma's "unique constraint failed" error code.
const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === UNIQUE_VIOLATION
  );
}

/**
 * The database user for the signed-in Clerk user, or null when signed out.
 *
 * Users sign up through Clerk, so their row here is created lazily the first time
 * they hit the app. After that it is a single indexed lookup (Clerk is only asked
 * for the email and name once, when the row is created).
 */
export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    // Email is unique and required here; phone-only Clerk users don't have one.
    `${clerkId}@users.noreply.petsoft.local`;
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    null;

  try {
    return await prisma.user.create({ data: { clerkId, email, name } });
  } catch (error) {
    // Two requests can race to create the same user (the layout and a server action,
    // for instance). The loser just reads the row the winner created.
    if (isUniqueViolation(error)) {
      return prisma.user.findUniqueOrThrow({ where: { clerkId } });
    }
    throw error;
  }
}

/** Whether the signed-in user has an active subscription to the paid plan. */
export async function hasProPlan() {
  const { has } = await auth();
  return has({ plan: PRO_PLAN });
}

/**
 * Whether this user may use the app: an active Pro subscription (checked via the
 * Clerk session) or a lifetime purchase (stored on the user row).
 */
export async function hasAccess(user: { lifetimePurchasedAt: Date | null }) {
  return user.lifetimePurchasedAt !== null || (await hasProPlan());
}
