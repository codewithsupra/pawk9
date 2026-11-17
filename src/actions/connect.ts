"use server";

import { headers } from "next/headers";
import { authorizeUser } from "@/lib/authz";
import { CONNECT_COUNTRY } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getAppUrl, getStripe } from "@/lib/stripe";

export type ConnectResult =
  { ok: true; url: string } | { ok: false; error: string };

const ACCOUNT_PAGE = "/app/account";

/**
 * Sends the signed-in daycare to Stripe's own form to connect (or finish connecting) the
 * account that booking payments go to. Stripe collects the bank and identity details, so
 * none of them touch this app. Returns the URL to send the browser to.
 */
export async function startStripeOnboarding(): Promise<ConnectResult> {
  const auth = await authorizeUser();
  if (!auth.ok) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, stripeAccountId: true },
    });
    if (!user) return { ok: false, error: "Account not found." };

    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await getStripe().accounts.create({
        type: "express",
        country: CONNECT_COUNTRY,
        // Placeholder addresses (phone-only sign-ups) aren't real, so don't prefill them.
        email: user.email.endsWith(".local") ? undefined : user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId: auth.userId },
      });

      // Two clicks at once could each create an account: only the first one is kept.
      const { count } = await prisma.user.updateMany({
        where: { id: auth.userId, stripeAccountId: null },
        data: { stripeAccountId: account.id },
      });
      if (count === 1) {
        accountId = account.id;
      } else {
        await getStripe()
          .accounts.del(account.id)
          .catch((error) =>
            console.error(
              "Could not remove a duplicate Stripe account:",
              error,
            ),
          );
        const saved = await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { stripeAccountId: true },
        });
        accountId = saved?.stripeAccountId ?? null;
      }
    }
    if (!accountId)
      return { ok: false, error: "Could not create the account." };

    const requestHeaders = await headers();
    const base = getAppUrl(
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto") ?? "http",
    );
    const link = await getStripe().accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      // An expired or reused Stripe link lands here, and the button starts a fresh one.
      refresh_url: `${base}${ACCOUNT_PAGE}`,
      return_url: `${base}${ACCOUNT_PAGE}`,
    });
    return { ok: true, url: link.url };
  } catch (error) {
    console.error("Failed to start Stripe onboarding:", error);
    return {
      ok: false,
      error: "Could not reach Stripe. Please try again in a moment.",
    };
  }
}
