import AccountActions from "@/components/account-actions";
import BookingRateForm from "@/components/booking-rate-form";
import ConnectStripeButton from "@/components/connect-stripe-button";
import ContentBlock from "@/components/content-block";
import { BOOKING_FEE_PERCENT } from "@/lib/constants";

export type AccountPlan =
  | { kind: "lifetime"; since: Date; alsoSubscribed: boolean }
  | { kind: "subscription" };

type AccountViewProps = {
  name: string | null;
  email: string;
  memberSince: Date;
  petCount: number;
  plan: AccountPlan;
  dailyRateCents: number | null;
  payments: { connected: boolean; ready: boolean };
};

// UTC so the date doesn't shift with the server's time zone.
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);

export default function AccountView({
  name,
  email,
  memberSince,
  petCount,
  plan,
  dailyRateCents,
  payments,
}: AccountViewProps) {
  // Placeholder addresses (phone-only sign-ups) aren't real, so don't show them.
  const shownEmail = email.endsWith(".local") ? "Not provided" : email;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ContentBlock className="p-8">
        <h2 className="text-xl font-semibold">Your account</h2>
        <dl className="mt-5 flex flex-col gap-4">
          <Field label="Name" value={name ?? "Not set"} />
          <Field label="Email" value={shownEmail} />
          <Field label="Member since" value={formatDate(memberSince)} />
          <Field label="Pets in your daycare" value={String(petCount)} />
        </dl>
      </ContentBlock>

      <ContentBlock className="p-8">
        <h2 className="text-xl font-semibold">Your plan</h2>
        <div className="mt-5">
          {plan.kind === "lifetime" ? (
            <>
              <PlanBadge>Lifetime</PlanBadge>
              <p className="mt-3 text-zinc-700">
                Purchased on {formatDate(plan.since)}. One payment, no renewals,
                no further charges.
              </p>
              {plan.alsoSubscribed && (
                <p
                  role="note"
                  className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
                >
                  You also have an active Pro subscription. Lifetime already
                  covers everything, so you can cancel the subscription under
                  Manage profile, security &amp; billing to stop paying for it.
                </p>
              )}
            </>
          ) : (
            <>
              <PlanBadge>Pro subscription</PlanBadge>
              <p className="mt-3 text-zinc-700">
                You can change or cancel it under Manage profile, security &amp;
                billing.
              </p>
            </>
          )}
        </div>
      </ContentBlock>

      <ContentBlock className="p-8 md:col-span-2">
        <h2 className="text-xl font-semibold">Online booking</h2>
        <BookingRateForm dailyRateCents={dailyRateCents} />

        <div className="mt-8 border-t border-black/8 pt-6">
          <h3 className="text-sm font-medium">Get paid</h3>
          {payments.ready ? (
            <p className="mt-2">
              <PlanBadge>Stripe connected</PlanBadge>
              <span className="ml-3 text-zinc-700">
                Booking payments go straight to your bank account.
              </span>
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-prose text-zinc-700">
                {payments.connected
                  ? "Stripe still needs a few details before you can take payments."
                  : "Connect Stripe so owners can pay for bookings and the money is sent to you. Stripe collects your bank details; PawK9 never sees them."}
              </p>
              <div className="mt-4">
                <ConnectStripeButton
                  label={
                    payments.connected
                      ? "Finish Stripe setup"
                      : "Connect Stripe to get paid"
                  }
                />
              </div>
            </>
          )}
          <p className="mt-4 max-w-prose text-sm text-zinc-600">
            Fee: PawK9 keeps {BOOKING_FEE_PERCENT}% of each booking, which also
            covers Stripe&apos;s card charges. You receive the other{" "}
            {100 - BOOKING_FEE_PERCENT}%.
          </p>
        </div>
      </ContentBlock>

      <ContentBlock className="p-8 md:col-span-2">
        <AccountActions />
      </ContentBlock>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg text-zinc-800">{value}</dd>
    </div>
  );
}

function PlanBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
      {children}
    </span>
  );
}
