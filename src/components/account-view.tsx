import AccountActions from "@/components/account-actions";
import ContentBlock from "@/components/content-block";

export type AccountPlan =
  | { kind: "lifetime"; since: Date; alsoSubscribed: boolean }
  | { kind: "subscription" };

type AccountViewProps = {
  name: string | null;
  email: string;
  memberSince: Date;
  petCount: number;
  plan: AccountPlan;
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
