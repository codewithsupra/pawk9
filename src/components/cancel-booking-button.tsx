"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cancelBookingRequest } from "@/actions/bookings";
import { Button } from "@/components/ui/button";

export default function CancelBookingButton({
  bookingId,
  petName,
}: {
  bookingId: string;
  petName: string;
}) {
  const [isWorking, setIsWorking] = useState(false);

  const handleClick = async () => {
    if (!window.confirm(`Cancel the booking request for ${petName}?`)) return;
    setIsWorking(true);
    try {
      const result = await cancelBookingRequest(bookingId);
      if (result.ok) toast.success("Request cancelled.");
      else toast.error(result.error);
    } catch {
      toast.error("Could not cancel. Please try again.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer"
      disabled={isWorking}
      aria-busy={isWorking}
      onClick={handleClick}
    >
      {isWorking && (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      )}
      Cancel request
    </Button>
  );
}
