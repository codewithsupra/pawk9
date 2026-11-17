import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import AuthShell from "@/components/auth-shell";
import { authFormElements } from "@/lib/clerk-appearance";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <Suspense>
        <SignIn appearance={{ elements: authFormElements }} />
      </Suspense>
    </AuthShell>
  );
}
