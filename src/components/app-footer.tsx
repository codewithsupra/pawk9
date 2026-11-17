import { cacheLife } from "next/cache";
import LegalLinks from "@/components/legal-links";

export default async function AppFooter() {
  // The year comes from the clock, which Next won't allow during prerendering unless the
  // result is cached. Caching for a day keeps it current without a dynamic render.
  "use cache";
  cacheLife("days");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-black/5 ">
      <small className="opacity-50">
        &copy; {year} PawK9. All rights reserved.
      </small>
      <LegalLinks className="mt-1 opacity-60" />
    </footer>
  );
}
