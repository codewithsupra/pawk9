import Link from "next/link";
import Logo from "@/components/logo";
import { LEGAL_UPDATED, contactEmail } from "@/lib/site";

export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const email = contactEmail();
  return (
    <main className="min-h-screen bg-[#5DC9A8] px-6 py-12 text-zinc-900">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Logo />
        <article className="rounded-xl bg-white p-8 shadow-sm [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="!mt-1 text-sm text-zinc-600">
            Last updated {LEGAL_UPDATED}
          </p>
          {children}
          {email && (
            <>
              <h2>Contact</h2>
              <p>
                Questions about this page or your data:{" "}
                <a className="underline" href={`mailto:${email}`}>
                  {email}
                </a>
                .
              </p>
            </>
          )}
        </article>
        <p className="text-sm">
          <Link href="/" className="underline-offset-2 hover:underline">
            Back to PawK9
          </Link>
        </p>
      </div>
    </main>
  );
}
