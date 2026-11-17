import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import LegalLinks from "@/components/legal-links";
import preview from "../../../public/pawk9-preview.jpg";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#5DC9A8] px-6 py-12 text-zinc-900 sm:px-10 lg:py-20">
      <div className="flex w-full max-w-6xl flex-col items-center gap-10 lg:flex-row lg:gap-14">
        <Image
          src={preview}
          alt="The PawK9 dashboard: a list of dogs on the left and the selected dog's details on the right"
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="h-auto w-full max-w-150 min-w-0 rounded-lg shadow-lg lg:flex-1"
        />
        <div className="w-full max-w-125 min-w-0 lg:flex-1">
          <Logo />
          <h1 className="my-6 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Manage your{" "}
            <span className="font-extrabold">pet daycare business</span>
          </h1>
          <p className="text-lg leading-relaxed">
            Easily manage your pet daycare business with PawK9. Keep track of
            your pets, appointments, and staff all in one place.
            <br />
            <strong>From just $39 per month.</strong>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              className="h-12 px-7 text-base cursor-pointer"
            >
              <Link href="/sign-up">Get Started</Link>
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-12 border-zinc-900/20 bg-transparent px-7  cursor-pointer text-base hover:bg-white/20"
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
          </div>
          <LegalLinks className="mt-8 opacity-70" />
        </div>
      </div>
    </main>
  );
}
