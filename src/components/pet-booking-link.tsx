"use client";

import { Link2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getBookingLink } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import type { Pet } from "@/lib/types";

// Plain state, not a transition: nothing here updates the pet list, and the clipboard
// write should stay as close to the click as possible.
export default function PetBookingLink({ pet }: { pet: Pet }) {
  const [isWorking, setIsWorking] = useState(false);

  const handleCopy = async () => {
    setIsWorking(true);
    try {
      const result = await getBookingLink(pet.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Booking link copied. Send it to the owner.");
      } catch {
        // Some browsers refuse clipboard writes after a wait: show the link instead.
        toast.message("Copy this booking link:", {
          description: result.url,
          duration: 20000,
        });
      }
    } catch {
      toast.error("Could not create the link. Please try again.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="mx-8 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-black/8 bg-zinc-50 px-6 py-5">
      <div className="min-w-0">
        <h3 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
          Online booking
        </h3>
        <p className="mt-1 text-base text-zinc-600">
          Send {pet.ownerName} a link to book {pet.name}&apos;s next stay.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        disabled={isWorking}
        aria-busy={isWorking}
        onClick={handleCopy}
      >
        {isWorking ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Link2 aria-hidden="true" />
        )}
        Copy booking link
      </Button>
    </div>
  );
}
