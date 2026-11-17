import { shadcn } from "@clerk/ui/themes";

// One look for every Clerk component in the app (sign-in, sign-up, the account menu,
// the pricing table). The shadcn theme makes them follow the app's own design tokens;
// the variables below are the brand on top of it. The logo's charcoal is the primary
// colour because white text on the brand mint is too faint to read.
export const clerkAppearance = {
  theme: shadcn,
  variables: {
    colorPrimary: "#23272D",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  options: {
    socialButtonsVariant: "blockButton",
    termsPageUrl: "/terms",
    privacyPageUrl: "/privacy",
  },
} as const;

// Extra touches for the two full-page forms only. The page around them already has the
// brand and the headline, so Clerk's own card drops its box and sits flat on the page.
export const authFormElements = {
  rootBox: "w-full",
  cardBox: "w-full !shadow-none !border-0 !bg-transparent",
  card: "!shadow-none !border-0 !bg-transparent !p-0 !gap-6",
  headerTitle:
    "!font-[family-name:var(--font-display)] !text-3xl !font-bold !tracking-tight",
  headerSubtitle: "!text-base",
  socialButtonsBlockButton: "!h-11",
  formFieldInput: "!h-11",
  formButtonPrimary: "!h-11 !text-base",
} as const;
