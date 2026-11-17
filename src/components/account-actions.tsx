"use client";

import { SignOutButton, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

// Clerk's own account modal covers profile details, security (password, 2FA) and
// billing (cancel or change the subscription), so there is no need to rebuild them.
export default function AccountActions() {
  const { openUserProfile } = useClerk();

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        size="lg"
        className="cursor-pointer"
        onClick={() => openUserProfile()}
      >
        Manage profile, security &amp; billing
      </Button>
      <SignOutButton>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="cursor-pointer"
        >
          Sign out
        </Button>
      </SignOutButton>
    </div>
  );
}
