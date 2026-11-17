import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Petsoft",
  description: "Petsoft - Your pet management solution",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", inter.variable, "font-sans")}
    >
      <body className="min-h-screen flex flex-col  text-zinc-900 bg-[#E5E8EC]">
        {/* Fallback, not force: a redirect_url from a protected route still wins. */}
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/app/dashboard"
          signUpFallbackRedirectUrl="/app/dashboard"
        >
          {children}
          <Toaster position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
