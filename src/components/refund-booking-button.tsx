"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cancelPaidBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";

export default function RefundBookingButton({
  bookingId,
  petName,
  amount,
}: {
  bookingId: string;
  petName: string;
  /** Already formatted, for example "$135". */
  amount: string;
}) {
  const [isWorking, setIsWorking] = useState(false);

  const handleClick = async () => {
    if (
      !window.confirm(
        `Cancel ${petName}'s booking and refund ${amount} to the owner? This can't be undone.`,
      )
    ) {
      return;
    }
    setIsWorking(true);
    try {
      const result = await cancelPaidBooking(bookingId);
      if (result.ok) toast.success(`Cancelled and refunded ${amount}.`);
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
      Cancel and refund
    </Button>
  );
}
