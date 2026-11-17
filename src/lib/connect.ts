import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Asks Stripe whether a daycare's connected account can take payments, and remembers the
 * answer in the database. Ready means Stripe has the details it needs (`details_submitted`)
 * and has switched card payments on (`charges_enabled`).
 *
 * If Stripe can't be reached, the last remembered answer is returned rather than an
 * error, since this runs while rendering the Account page.
 */
export async function syncConnectStatus(user: {
  id: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
}): Promise<{ connected: boolean; ready: boolean }> {
  if (!user.stripeAccountId) return { connected: false, ready: false };

  try {
    const account = await getStripe().accounts.retrieve(user.stripeAccountId);
    const ready = account.charges_enabled && account.details_submitted;
    if (ready !== user.stripeChargesEnabled) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeChargesEnabled: ready },
      });
    }
    return { connected: true, ready };
  } catch (error) {
    console.error("Could not check the Stripe account status:", error);
    return { connected: true, ready: user.stripeChargesEnabled };
  }
}
