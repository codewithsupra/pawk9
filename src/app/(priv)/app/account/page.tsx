import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import AccountView, { type AccountPlan } from "@/components/account-view";
import ContentBlock from "@/components/content-block";
import H1 from "@/components/h1";
import { getCurrentUser, hasProPlan } from "@/lib/auth";
import { countPets } from "@/lib/data";
import { SIGN_IN } from "@/lib/redirects";

export default function Account() {
  return (
    <main>
      <H1 className="my-8 text-white">Account</H1>
      <Suspense
        fallback={
          <ContentBlock className="p-8">
            <p role="status">Loading your account…</p>
          </ContentBlock>
        }
      >
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  // Time-dependent work follows (dates), so opt into request-time rendering first.
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN); // The proxy already guards /app; this is a backstop.

  const [petCount, subscribed] = await Promise.all([
    countPets(user.id),
    hasProPlan(),
  ]);

  // Lifetime wins when both apply, and we say so, so nobody keeps paying by accident.
  const plan: AccountPlan = user.lifetimePurchasedAt
    ? {
        kind: "lifetime",
        since: user.lifetimePurchasedAt,
        alsoSubscribed: subscribed,
      }
    : { kind: "subscription" };

  return (
    <AccountView
      name={user.name}
      email={user.email}
      memberSince={user.createdAt}
      petCount={petCount}
      plan={plan}
    />
  );
}
