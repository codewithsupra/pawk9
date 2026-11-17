import BackgroundPattern from "@/components/background-pattern";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import PetContextProvider from "@/contexts/pet-context-provider";
import SearchContextProvider from "@/contexts/search-context-provider";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { getPets } from "@/lib/data";
import { PRICING } from "@/lib/redirects";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <BackgroundPattern />
      <div className="mx-auto flex w-full max-w-262.5 flex-1 flex-col px-4 sm:px-6 lg:px-0">
        <AppHeader />
        <main className="min-w-0 flex-1 py-8">
          <Suspense
            fallback={
              <p role="status" className="py-8 text-white">
                Loading pets…
              </p>
            }
          >
            <PetDataProvider>{children}</PetDataProvider>
          </Suspense>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

async function PetDataProvider({ children }: { children: React.ReactNode }) {
  // Belt and braces with the proxy: never query pets without the paid plan.
  await auth.protect();

  const user = await getCurrentUser();
  if (!user) throw new Error("Signed-in user not found");
  if (!(await hasAccess(user))) redirect(PRICING);
  const pets = await getPets(user.id);

  return (
    <SearchContextProvider>
      <PetContextProvider initialPets={pets}>{children}</PetContextProvider>
    </SearchContextProvider>
  );
}
