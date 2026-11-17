import LegalPage from "@/components/legal-page";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms apply when you use PawK9. By creating an account you agree
        to them.
      </p>

      <h2>The service</h2>
      <p>
        PawK9 is software for pet daycares: records of pets and owners,
        check-ins, photo updates and online booking. PawK9 does not provide pet
        care. The daycare is solely responsible for the animals in its care and
        for how it runs its business.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your sign-in details safe and give accurate information. You are
        responsible for what happens under your account.
      </p>

      <h2>Plans and payment</h2>
      <ul>
        <li>
          The Pro plan is a subscription, billed monthly or yearly until you
          cancel. You can cancel at any time from your account, and you keep
          access until the end of the period you paid for.
        </li>
        <li>
          Lifetime is a single payment for access for as long as PawK9 is
          offered.
        </li>
        <li>
          If you take online bookings, payments go to your own Stripe account
          and you also agree to Stripe&apos;s terms. Any fee PawK9 takes on
          bookings will be shown to you before you turn bookings on.
        </li>
      </ul>

      <h2>What you promise</h2>
      <ul>
        <li>
          You have the right to store the information you enter, and pet
          owners&apos; agreement to be contacted by email about their pets.
        </li>
        <li>
          You will not upload anything unlawful or that you do not have the
          right to share, and you will not misuse the service or try to access
          other daycares&apos; records.
        </li>
        <li>
          You will set prices and dates honestly and honour the bookings you
          confirm.
        </li>
      </ul>

      <h2>Your data</h2>
      <p>
        Your records are yours. See the privacy policy for how they are handled.
        You can delete pets and their photos at any time.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We work to keep PawK9 running but cannot promise it will never be
        interrupted. We may improve or change features, and we will tell you
        about changes that matter.
      </p>

      <h2>Limits of our responsibility</h2>
      <p>
        PawK9 is provided as it is. To the extent the law allows, we are not
        liable for indirect losses, lost income, or harm to animals, and our
        total liability for any claim is limited to what you paid us in the 12
        months before it.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can stop using PawK9 at any time. We may suspend an account that
        breaks these terms.
      </p>
    </LegalPage>
  );
}
