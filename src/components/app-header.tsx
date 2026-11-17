"use client";
import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Logo from "./logo";
import { usePathname } from "next/navigation";

const routes = [
  {
    label: "Dashboard",
    path: "/app/dashboard",
  },
  {
    label: "Bookings",
    path: "/app/bookings",
  },
  {
    label: "Profile",
    path: "/app/account",
  },
];
export default function AppHeader() {
  const activePathname = usePathname();
  return (
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-white/20 py-4">
      <Logo />
      <nav aria-label="App navigation">
        <ul className="flex flex-wrap items-center justify-end gap-1 text-sm font-medium sm:gap-3">
          {routes.map((route) => (
            <li key={route.path}>
              <Link
                href={route.path}
                aria-current={
                  activePathname === route.path ? "page" : undefined
                }
                className="inline-flex min-h-11 items-center rounded-md px-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white aria-[current=page]:bg-white/15 aria-[current=page]:text-white aria-[current=page]:font-semibold"
              >
                {route.label}
              </Link>
            </li>
          ))}
          <li className="flex items-center pl-1 sm:pl-2">
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <SignInButton>
                <button
                  type="button"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-md px-3 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Sign in
                </button>
              </SignInButton>
            </Show>
          </li>
        </ul>
      </nav>
    </header>
  );
}
