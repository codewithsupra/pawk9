import LegalPage from "@/components/legal-page";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        PawK9 is software that pet daycares use to run their business. This page
        explains what information PawK9 handles and why.
      </p>

      <h2>Who is responsible for what</h2>
      <p>
        For the details of a daycare&apos;s own account (its sign-in and
        billing), PawK9 decides how the information is used. For the records a
        daycare enters about the pets and owners it looks after, the daycare
        decides what is collected and why, and PawK9 only stores and processes
        them on the daycare&apos;s behalf. If you are a pet owner and want to
        see or remove your information, please ask your daycare first.
      </p>

      <h2>What we handle</h2>
      <ul>
        <li>
          <strong>Daycare account:</strong> name, email address and sign-in
          details, kept by our sign-in provider.
        </li>
        <li>
          <strong>Pet and owner records a daycare enters:</strong> pet names,
          ages, notes and photos; owner names, email addresses and phone
          numbers; check-in and check-out times; bookings and amounts.
        </li>
        <li>
          <strong>Payments:</strong> handled by Stripe. PawK9 never sees full
          card numbers or bank details.
        </li>
        <li>
          <strong>Technical data:</strong> basic server logs, used to keep the
          service running and secure.
        </li>
      </ul>

      <h2>How it is used</h2>
      <p>
        To run the service: show a daycare its records, take bookings and
        payments, and send the emails a daycare chooses to send (for example a
        photo of a pet to its owner). We do not sell personal information and we
        do not show advertising.
      </p>

      <h2>Photo and booking links</h2>
      <p>
        A photo emailed to an owner is shared as a link that works for 7 days.
        Anyone who has the link can open that one photo until it expires. A
        booking link lets whoever holds it request a stay for one pet. Please
        treat both like a private message.
      </p>

      <h2>Companies that help us run PawK9</h2>
      <p>These providers process information for us:</p>
      <ul>
        <li>Clerk: sign-in and subscriptions.</li>
        <li>Stripe: payments and payouts to daycares.</li>
        <li>Resend: sending emails.</li>
        <li>Neon: database.</li>
        <li>Vercel: hosting and photo storage.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use only the cookies needed to keep you signed in and to run payments
        securely. We do not use advertising or tracking cookies.
      </p>

      <h2>Keeping and deleting information</h2>
      <p>
        Records stay while the daycare&apos;s account is active. When a daycare
        removes a pet, that pet&apos;s stays, photos and bookings are deleted
        permanently. Payment records may be kept by Stripe as the law requires.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted. Each daycare can only see its own records,
        and photos are stored privately and are only reachable by the daycare or
        through a link it sends.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this page in a way that matters, we will update the date at
        the top.
      </p>
    </LegalPage>
  );
}
