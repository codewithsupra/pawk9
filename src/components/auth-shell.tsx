import { Bricolage_Grotesque } from "next/font/google";
import Image from "next/image";
import Logo from "@/components/logo";
import { cn } from "@/lib/utils";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

const copy = {
  "sign-in": {
    title: "Welcome back",
    text: "Pick up where you left off: check guests in and out, send owners their photos, take bookings.",
  },
  "sign-up": {
    title: "Run your daycare from one screen",
    text: "Check guests in and out, send owners photo updates, and take booked and paid stays online.",
  },
} as const;

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=96&h=96&q=75`;

// Made-up guests, shown only to say what the app looks like once you are in.
const guests = [
  {
    name: "Luna",
    status: "In since 8:05 AM",
    here: true,
    image: "1537151625747-768eb6cf92b2",
  },
  {
    name: "Benjamin",
    status: "In since 8:40 AM",
    here: true,
    image: "1530281700549-e82e7bf110d6",
  },
  {
    name: "Bella",
    status: "In since 9:15 AM",
    here: true,
    image: "1561037404-61cd46aa615b",
  },
  {
    name: "Max",
    status: "Not checked in",
    here: false,
    image: "1558788353-f76d92427f16",
  },
] as const;

/**
 * The page around Clerk's sign-in and sign-up forms: brand and a glimpse of the product
 * on the left (on its own mint), the form on the right. On a phone the glimpse is
 * dropped and the brand becomes a short header above the form.
 */
export default function AuthShell({
  mode,
  children,
}: {
  mode: keyof typeof copy;
  children: React.ReactNode;
}) {
  const { title, text } = copy[mode];

  return (
    <main
      className={cn(
        display.variable,
        "grid min-h-screen grid-cols-[minmax(0,1fr)] bg-white text-zinc-900 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
      )}
    >
      <aside className="flex flex-col gap-10 bg-[#5DC9A8] px-6 py-8 sm:px-12 lg:justify-between lg:px-14 lg:py-14">
        <Logo />

        <div className="max-w-md">
          <p className="font-[family-name:var(--font-display)] text-4xl leading-[1.02] font-bold tracking-tighter text-balance sm:text-6xl">
            {title}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-zinc-900/80">
            {text}
          </p>
        </div>

        <div className="hidden max-w-md lg:block" aria-hidden="true">
          <div className="rounded-2xl bg-white p-3 shadow-[0_18px_40px_-18px_rgba(35,39,45,0.45)]">
            <ul className="flex flex-col">
              {guests.map((guest, index) => (
                <li
                  key={guest.name}
                  style={{ animationDelay: `${index * 110}ms` }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards motion-reduce:animate-none"
                >
                  <Image
                    src={photo(guest.image)}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 rounded-full object-cover"
                  />
                  <span className="flex-1 font-medium">{guest.name}</span>
                  <span
                    className={cn(
                      "text-sm",
                      guest.here
                        ? "font-medium text-emerald-700"
                        : "text-zinc-500",
                    )}
                  >
                    {guest.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-sm text-zinc-900/70">Sample guests</p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
