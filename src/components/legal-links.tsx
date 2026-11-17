import Link from "next/link";

export default function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <li>
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
        </li>
        <li>
          <Link href="/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
        </li>
      </ul>
    </nav>
  );
}
