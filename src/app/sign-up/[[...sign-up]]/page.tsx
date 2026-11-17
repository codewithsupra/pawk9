import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import AuthShell from "@/components/auth-shell";
import { authFormElements } from "@/lib/clerk-appearance";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <Suspense>
        <SignUp appearance={{ elements: authFormElements }} />
      </Suspense>
    </AuthShell>
  );
}
