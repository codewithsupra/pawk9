"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { requestBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, quoteBooking } from "@/lib/bookings";

// Shows the price as the dates change. That is only a preview: the server works the price
// out again itself when the request is sent.
export default function BookingForm({
  code,
  rateCents,
  today,
}: {
  code: string;
  rateCents: number;
  /** "YYYY-MM-DD", the earliest day that can be booked. */
  today: string;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    days: number;
    amountCents: number;
  } | null>(null);

  const quote =
    start && end ? quoteBooking({ start, end, rateCents, today }) : null;

  const handleRequest = async () => {
    setIsSending(true);
    setError(null);
    try {
      const result = await requestBooking(code, start, end);
      if (result.ok) setSent(result);
      else setError(result.error);
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <div
        role="status"
        className="mt-6 rounded-md bg-emerald-50 p-4 text-emerald-900"
      >
        <p className="font-semibold">Your request is saved.</p>
        <p className="mt-1">
          {sent.days} {sent.days === 1 ? "day" : "days"},{" "}
          {formatMoney(sent.amountCents)}, {start} to {end}. It isn&apos;t
          confirmed until it is paid, and online payment isn&apos;t available
          yet, so your daycare will be in touch.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-lg">
        <span className="font-semibold">{formatMoney(rateCents)}</span> per day
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Drop-off
          <Input
            type="date"
            min={today}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              // Keep pick-up from being left before the new drop-off.
              if (end && event.target.value > end) setEnd(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Pick-up
          <Input
            type="date"
            min={start || today}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>

      <div aria-live="polite" className="min-h-14 rounded-md bg-zinc-50 p-4">
        {quote === null ? (
          <p className="text-zinc-600">Choose your dates to see the price.</p>
        ) : quote.ok ? (
          <p>
            {quote.days} {quote.days === 1 ? "day" : "days"} ×{" "}
            {formatMoney(rateCents)} ={" "}
            <span className="text-lg font-semibold">
              {formatMoney(quote.amountCents)}
            </span>
          </p>
        ) : (
          <p className="text-destructive">{quote.error}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        size="lg"
        className="h-12 cursor-pointer text-base"
        disabled={isSending || !quote?.ok}
        aria-busy={isSending}
        onClick={handleRequest}
      >
        {isSending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          "Request booking"
        )}
      </Button>
    </div>
  );
}
