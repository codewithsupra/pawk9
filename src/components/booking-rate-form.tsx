"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDailyRate } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const toDollars = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toFixed(2).replace(/\.00$/, "");

export default function BookingRateForm({
  dailyRateCents,
}: {
  dailyRateCents: number | null;
}) {
  const [value, setValue] = useState(toDollars(dailyRateCents));
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await setDailyRate(value);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setValue(toDollars(result.dailyRateCents));
        toast.success(
          result.dailyRateCents === null
            ? "Daily rate cleared."
            : "Daily rate saved.",
        );
      } catch {
        toast.error("Could not save the rate. Please try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
      <label htmlFor="daily-rate" className="text-sm font-medium">
        Price per day (USD)
      </label>
      <div className="flex gap-2">
        <div className="relative max-w-40 flex-1">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-3 flex items-center text-zinc-500"
          >
            $
          </span>
          <Input
            id="daily-rate"
            inputMode="decimal"
            autoComplete="off"
            placeholder="45"
            className="pl-7"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="cursor-pointer"
        >
          {isPending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      <p className="text-sm text-zinc-600">
        What owners will pay for each day their pet stays. Leave it empty to
        turn online booking off.
      </p>
    </form>
  );
}
