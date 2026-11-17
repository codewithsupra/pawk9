"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startStripeOnboarding } from "@/actions/connect";
import { Button } from "@/components/ui/button";

export default function ConnectStripeButton({ label }: { label: string }) {
  const [isWorking, setIsWorking] = useState(false);

  const handleClick = async () => {
    setIsWorking(true);
    try {
      const result = await startStripeOnboarding();
      if (!result.ok) {
        toast.error(result.error);
        setIsWorking(false);
        return;
      }
      // Leaves the app for Stripe's own page; stay in the loading state until it does.
      window.location.assign(result.url);
    } catch {
      toast.error("Could not reach Stripe. Please try again in a moment.");
      setIsWorking(false);
    }
  };

  return (
    <Button
      type="button"
      className="cursor-pointer"
      disabled={isWorking}
      aria-busy={isWorking}
      onClick={handleClick}
    >
      {isWorking && (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
