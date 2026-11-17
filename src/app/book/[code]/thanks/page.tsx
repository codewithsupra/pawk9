import Logo from "@/components/logo";

export const metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

// Where Stripe sends the owner after paying. It deliberately proves nothing: a booking is
// only confirmed when Stripe's webhook says the payment went through, so this page only
// thanks them and explains what happens next.
export default function ThanksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-[#5DC9A8] px-6 py-12 text-zinc-900">
      <Logo />
      <section className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="mt-3 text-zinc-700">
          Your payment is being confirmed. Stripe will email you a receipt, and
          your daycare will see the booking as soon as it is confirmed, usually
          within a minute.
        </p>
      </section>
    </main>
  );
}
