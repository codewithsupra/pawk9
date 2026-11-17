"use server";

import { revalidatePath } from "next/cache";
import { authorizeUser } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dailyRateSchema } from "@/lib/validations";

export type SetRateResult =
  { ok: true; dailyRateCents: number | null } | { ok: false; error: string };

/** Sets what the signed-in daycare charges per day (empty clears it). */
export async function setDailyRate(rate: string): Promise<SetRateResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  const parsed = dailyRateSchema.safeParse(rate);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    await prisma.user.update({
      where: { id: auth.userId },
      data: { dailyRateCents: parsed.data },
    });
    revalidatePath("/app/account");
    return { ok: true, dailyRateCents: parsed.data };
  } catch (error) {
    console.error("Failed to save the daily rate:", error);
    return { ok: false, error: "Could not save the rate. Please try again." };
  }
}
