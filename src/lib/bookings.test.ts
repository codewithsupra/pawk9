import { describe, expect, it } from "vitest";
import {
  MAX_BOOKING_DAYS,
  formatMoney,
  parseDay,
  quoteBooking,
} from "@/lib/bookings";

describe("parseDay", () => {
  it("parses a real calendar day to UTC midnight", () => {
    expect(parseDay("2026-12-24")?.toISOString()).toBe(
      "2026-12-24T00:00:00.000Z",
    );
  });

  it("rejects days JavaScript would roll into the next month", () => {
    expect(parseDay("2026-02-31")).toBeNull();
  });

  it("accepts a leap day only in a leap year", () => {
    expect(parseDay("2028-02-29")).not.toBeNull();
    expect(parseDay("2027-02-29")).toBeNull();
  });

  it.each(["", "2026-1-5", "12/24/2026", "2026-12-24T10:00", "tomorrow"])(
    "rejects %j",
    (text) => {
      expect(parseDay(text)).toBeNull();
    },
  );
});

describe("quoteBooking", () => {
  const base = { rateCents: 4500, today: "2026-12-01" };

  it("counts every day from start to end inclusive", () => {
    expect(
      quoteBooking({ ...base, start: "2026-12-10", end: "2026-12-12" }),
    ).toEqual({ ok: true, days: 3, amountCents: 13500 });
  });

  it("prices a single day", () => {
    expect(
      quoteBooking({ ...base, start: "2026-12-10", end: "2026-12-10" }),
    ).toEqual({ ok: true, days: 1, amountCents: 4500 });
  });

  it("allows booking on the earliest allowed day", () => {
    expect(
      quoteBooking({ ...base, start: "2026-12-01", end: "2026-12-01" }).ok,
    ).toBe(true);
  });

  it("refuses a drop-off before the earliest allowed day", () => {
    const quote = quoteBooking({
      ...base,
      start: "2026-11-30",
      end: "2026-12-02",
    });
    expect(quote.ok).toBe(false);
  });

  it("refuses a pick-up before the drop-off", () => {
    const quote = quoteBooking({
      ...base,
      start: "2026-12-10",
      end: "2026-12-09",
    });
    expect(quote.ok).toBe(false);
  });

  it("refuses garbage dates", () => {
    expect(quoteBooking({ ...base, start: "nope", end: "2026-12-09" }).ok).toBe(
      false,
    );
  });

  it("allows exactly the maximum number of days, and refuses one more", () => {
    // 2026-12-01 + 59 days is the 60th day.
    const last = new Date(Date.UTC(2026, 11, 1 + MAX_BOOKING_DAYS - 1));
    const tooLate = new Date(Date.UTC(2026, 11, 1 + MAX_BOOKING_DAYS));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    expect(
      quoteBooking({ ...base, start: "2026-12-01", end: iso(last) }),
    ).toMatchObject({ ok: true, days: MAX_BOOKING_DAYS });
    expect(
      quoteBooking({ ...base, start: "2026-12-01", end: iso(tooLate) }).ok,
    ).toBe(false);
  });

  it("counts days correctly across a month and year boundary", () => {
    expect(
      quoteBooking({ ...base, start: "2026-12-30", end: "2027-01-02" }),
    ).toMatchObject({ ok: true, days: 4 });
  });
});

describe("formatMoney", () => {
  it("shows whole dollars without cents", () => {
    expect(formatMoney(4500)).toBe("$45");
  });

  it("never hides cents that exist", () => {
    expect(formatMoney(4550)).toBe("$45.50");
  });
});
