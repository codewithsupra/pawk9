import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for the database and for Stripe, so the decisions made when a
// payment arrives can be tested without either. The logic under test is the real code.
type FakeBooking = {
  id: string;
  petId: string;
  userId: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED";
  amountCents: number;
  startDate: Date;
  endDate: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
  stripePaymentIntentId: string | null;
  stripeSessionId: string | null;
};

const fake = vi.hoisted(() => ({
  bookings: [] as FakeBooking[],
  locked: [] as string[],
  refunds: [] as { params: Record<string, unknown>; options: unknown }[],
  expired: [] as string[],
  expireThrows: false,
  refundError: null as { code?: string } | null,
}));

vi.mock("@/lib/locks", () => ({
  lockPet: async (_tx: unknown, petId: string) => {
    fake.locked.push(petId);
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    refunds: {
      create: async (params: Record<string, unknown>, options: unknown) => {
        if (fake.refundError) throw fake.refundError;
        fake.refunds.push({ params, options });
        return { id: "re_1" };
      },
    },
    checkout: {
      sessions: {
        expire: async (id: string) => {
          if (fake.expireThrows) throw new Error("already expired");
          fake.expired.push(id);
        },
      },
    },
  }),
}));

vi.mock("@/lib/db", () => {
  const find = (id: string) => fake.bookings.find((b) => b.id === id) ?? null;
  const booking = {
    findUnique: async ({ where }: { where: { id: string } }) => find(where.id),
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const found = find(where.id);
      if (!found) throw new Error("not found");
      return found;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      if ("startDate" in where) {
        // The overlap query.
        const w = where as unknown as {
          petId: string;
          id: { not: string };
          status: string;
          startDate: { lte: Date };
          endDate: { gte: Date };
        };
        return (
          fake.bookings.find(
            (b) =>
              b.petId === w.petId &&
              b.id !== w.id.not &&
              b.status === w.status &&
              b.startDate <= w.startDate.lte &&
              b.endDate >= w.endDate.gte,
          ) ?? null
        );
      }
      // "This booking, if it belongs to this daycare."
      return (
        fake.bookings.find(
          (b) => b.id === where.id && b.userId === where.userId,
        ) ?? null
      );
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<FakeBooking>;
    }) => Object.assign(find(where.id)!, data),
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<FakeBooking>;
    }) => {
      const matches = fake.bookings.filter((b) =>
        Object.entries(where).every(
          ([key, value]) => b[key as keyof FakeBooking] === value,
        ),
      );
      matches.forEach((b) => Object.assign(b, data));
      return { count: matches.length };
    },
  };
  return {
    prisma: {
      booking,
      $transaction: async (run: (tx: { booking: typeof booking }) => unknown) =>
        run({ booking }),
    },
  };
});

import {
  cancelBookingForExpiredSession,
  expireCheckoutSession,
  fulfillBookingPayment,
  platformFee,
  refundAndCancelBooking,
} from "@/lib/booking-payments";

const day = (text: string) => new Date(`${text}T00:00:00.000Z`);

function addBooking(overrides: Partial<FakeBooking> = {}) {
  const created: FakeBooking = {
    id: "b1",
    petId: "pet1",
    userId: "u1",
    status: "PENDING_PAYMENT",
    amountCents: 13500,
    startDate: day("2026-12-10"),
    endDate: day("2026-12-12"),
    paidAt: null,
    refundedAt: null,
    stripePaymentIntentId: null,
    stripeSessionId: "cs_1",
    ...overrides,
  };
  fake.bookings.push(created);
  return created;
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    mode: "payment",
    payment_status: "paid",
    payment_intent: "pi_1",
    amount_total: 13500,
    currency: "usd",
    metadata: { product: "booking", bookingId: "b1" },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

beforeEach(() => {
  fake.bookings.length = 0;
  fake.locked.length = 0;
  fake.refunds.length = 0;
  fake.expired.length = 0;
  fake.expireThrows = false;
  fake.refundError = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("platformFee", () => {
  it("takes 8% and rounds to the nearest cent", () => {
    expect(platformFee(13500)).toBe(1080);
    expect(platformFee(1234)).toBe(99); // 98.72
    expect(platformFee(1231)).toBe(98); // 98.48
    expect(platformFee(0)).toBe(0);
  });
});

describe("fulfillBookingPayment: confirming", () => {
  it("confirms a paid, waiting booking and records the payment", async () => {
    const booking = addBooking();
    const result = await fulfillBookingPayment(paidSession());

    expect(result).toEqual({ outcome: "confirmed" });
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.stripePaymentIntentId).toBe("pi_1");
    expect(booking.paidAt).toBeInstanceOf(Date);
    expect(fake.refunds).toHaveLength(0);
  });

  it("locks the pet before deciding", async () => {
    addBooking();
    await fulfillBookingPayment(paidSession());
    expect(fake.locked).toEqual(["pet1"]);
  });

  it("does nothing the second time the same webhook arrives", async () => {
    const booking = addBooking();
    await fulfillBookingPayment(paidSession());
    const again = await fulfillBookingPayment(paidSession());

    expect(again).toEqual({ outcome: "already-confirmed" });
    expect(booking.status).toBe("CONFIRMED");
    expect(fake.refunds).toHaveLength(0);
  });
});

describe("fulfillBookingPayment: ignoring what it cannot trust", () => {
  it("ignores a session that is not a booking", async () => {
    addBooking();
    const result = await fulfillBookingPayment(
      paidSession({ metadata: { product: "lifetime" } }),
    );
    expect(result.outcome).toBe("ignored");
  });

  it("ignores an unpaid session", async () => {
    const booking = addBooking();
    const result = await fulfillBookingPayment(
      paidSession({ payment_status: "unpaid" }),
    );
    expect(result.outcome).toBe("ignored");
    expect(booking.status).toBe("PENDING_PAYMENT");
  });

  it("ignores an unknown booking id", async () => {
    const result = await fulfillBookingPayment(paidSession());
    expect(result).toEqual({ outcome: "ignored", reason: "unknown booking" });
  });

  it("does not confirm or refund when the amount differs from the booking", async () => {
    const booking = addBooking();
    const result = await fulfillBookingPayment(
      paidSession({ amount_total: 100 }),
    );
    expect(result.outcome).toBe("ignored");
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(fake.refunds).toHaveLength(0);
  });

  it("does not confirm when the currency is not USD", async () => {
    const booking = addBooking();
    const result = await fulfillBookingPayment(
      paidSession({ currency: "eur" }),
    );
    expect(result.outcome).toBe("ignored");
    expect(booking.status).toBe("PENDING_PAYMENT");
  });
});

describe("fulfillBookingPayment: refunds a payment it cannot honour", () => {
  it("refunds in full, fee included, when the request was cancelled first", async () => {
    const booking = addBooking({ status: "CANCELLED" });
    const result = await fulfillBookingPayment(paidSession());

    expect(result).toEqual({
      outcome: "refunded",
      reason: "request was cancelled before payment",
    });
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0].params).toMatchObject({
      payment_intent: "pi_1",
      reverse_transfer: true,
      refund_application_fee: true,
    });
    // One refund per payment, even if Stripe retries the webhook.
    expect(fake.refunds[0].options).toEqual({
      idempotencyKey: "booking-refund-pi_1",
    });
    expect(booking.status).toBe("CANCELLED");
    expect(booking.refundedAt).toBeInstanceOf(Date);
  });

  it("cancels and refunds the later payment when the dates were taken first", async () => {
    const winner = addBooking({
      id: "b1",
      status: "CONFIRMED",
      stripePaymentIntentId: "pi_winner",
      paidAt: new Date(),
    });
    const loser = addBooking({
      id: "b2",
      startDate: day("2026-12-11"),
      endDate: day("2026-12-14"),
      stripeSessionId: "cs_2",
    });

    const result = await fulfillBookingPayment(
      paidSession({
        id: "cs_2",
        payment_intent: "pi_loser",
        metadata: { product: "booking", bookingId: "b2" },
      }),
    );

    expect(result).toEqual({
      outcome: "refunded",
      reason: "dates were booked by someone else first",
    });
    expect(loser.status).toBe("CANCELLED");
    expect(winner.status).toBe("CONFIRMED");
    expect(winner.stripePaymentIntentId).toBe("pi_winner");
    expect(fake.refunds[0].params).toMatchObject({
      payment_intent: "pi_loser",
    });
  });

  it("does not treat back-to-back stays as overlapping", async () => {
    addBooking({
      id: "b1",
      status: "CONFIRMED",
      stripePaymentIntentId: "pi_other",
      endDate: day("2026-12-12"),
    });
    const next = addBooking({
      id: "b2",
      startDate: day("2026-12-13"),
      endDate: day("2026-12-14"),
      stripeSessionId: "cs_2",
    });

    const result = await fulfillBookingPayment(
      paidSession({
        id: "cs_2",
        metadata: { product: "booking", bookingId: "b2" },
      }),
    );
    expect(result).toEqual({ outcome: "confirmed" });
    expect(next.status).toBe("CONFIRMED");
  });

  it("refunds a second, different payment for an already-paid booking and keeps the first", async () => {
    const booking = addBooking({
      status: "CONFIRMED",
      stripePaymentIntentId: "pi_first",
      paidAt: new Date(),
    });
    const result = await fulfillBookingPayment(
      paidSession({ payment_intent: "pi_second" }),
    );

    expect(result).toEqual({
      outcome: "refunded",
      reason: "booking already paid by another payment",
    });
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.stripePaymentIntentId).toBe("pi_first");
    expect(fake.refunds[0].params).toMatchObject({
      payment_intent: "pi_second",
    });
  });

  it("is quiet when the cancelled booking's own refund is replayed", async () => {
    addBooking({
      status: "CANCELLED",
      refundedAt: new Date(),
      stripePaymentIntentId: "pi_1",
    });
    const result = await fulfillBookingPayment(paidSession());
    expect(result).toEqual({ outcome: "already-confirmed" });
    expect(fake.refunds).toHaveLength(0);
  });
});

describe("cancelBookingForExpiredSession", () => {
  const expiredSession = (id: string) =>
    ({
      id,
      metadata: { product: "booking", bookingId: "b1" },
    }) as unknown as Stripe.Checkout.Session;

  it("cancels a waiting request when its latest session expires", async () => {
    const booking = addBooking({ stripeSessionId: "cs_latest" });
    await cancelBookingForExpiredSession(expiredSession("cs_latest"));
    expect(booking.status).toBe("CANCELLED");
  });

  it("ignores an old session expiring after a newer one replaced it", async () => {
    const booking = addBooking({ stripeSessionId: "cs_new" });
    await cancelBookingForExpiredSession(expiredSession("cs_old"));
    expect(booking.status).toBe("PENDING_PAYMENT");
  });

  it("never cancels a booking that is already paid", async () => {
    const booking = addBooking({
      status: "CONFIRMED",
      stripeSessionId: "cs_1",
    });
    await cancelBookingForExpiredSession(expiredSession("cs_1"));
    expect(booking.status).toBe("CONFIRMED");
  });
});

describe("expireCheckoutSession", () => {
  it("expires the session", async () => {
    await expireCheckoutSession("cs_1");
    expect(fake.expired).toEqual(["cs_1"]);
  });

  it("does nothing without a session id", async () => {
    await expireCheckoutSession(null);
    expect(fake.expired).toEqual([]);
  });

  it("never throws, even when Stripe refuses", async () => {
    fake.expireThrows = true;
    await expect(expireCheckoutSession("cs_1")).resolves.toBeUndefined();
  });
});

describe("refundAndCancelBooking", () => {
  const NOW = new Date("2026-12-11T15:00:00.000Z");
  const paid = (overrides: Partial<FakeBooking> = {}) =>
    addBooking({
      status: "CONFIRMED",
      stripePaymentIntentId: "pi_1",
      paidAt: new Date(),
      ...overrides,
    });
  const run = (overrides: { bookingId?: string; userId?: string } = {}) =>
    refundAndCancelBooking({
      bookingId: "b1",
      userId: "u1",
      now: NOW,
      ...overrides,
    });

  it("refunds in full, fee included, and cancels the booking", async () => {
    const booking = paid();
    const result = await run();

    expect(result).toEqual({ ok: true, paymentIntentId: "pi_1" });
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0].params).toMatchObject({
      payment_intent: "pi_1",
      reverse_transfer: true,
      refund_application_fee: true,
    });
    expect(fake.refunds[0].options).toEqual({
      idempotencyKey: "booking-cancel-pi_1",
    });
    expect(booking.status).toBe("CANCELLED");
    expect(booking.refundedAt).toBeInstanceOf(Date);
    // Kept, so a replayed payment webhook is recognised as already handled.
    expect(booking.stripePaymentIntentId).toBe("pi_1");
  });

  it("frees the dates for someone else", async () => {
    paid();
    await run();
    const other = addBooking({
      id: "b2",
      stripeSessionId: "cs_2",
    });
    const result = await fulfillBookingPayment(
      paidSession({
        id: "cs_2",
        payment_intent: "pi_2",
        metadata: { product: "booking", bookingId: "b2" },
      }),
    );
    expect(result).toEqual({ outcome: "confirmed" });
    expect(other.status).toBe("CONFIRMED");
  });

  it("a replayed payment webhook after the cancellation refunds nothing more", async () => {
    paid();
    await run();
    fake.refunds.length = 0;

    const replay = await fulfillBookingPayment(paidSession());
    expect(replay).toEqual({ outcome: "already-confirmed" });
    expect(fake.refunds).toHaveLength(0);
  });

  it("cannot cancel another daycare's booking, and says nothing about it", async () => {
    const booking = paid({ userId: "someone-else" });
    const result = await run();

    expect(result).toEqual({
      ok: false,
      error: "That booking can't be cancelled.",
    });
    expect(booking.status).toBe("CONFIRMED");
    expect(fake.refunds).toHaveLength(0);
  });

  it.each(["PENDING_PAYMENT", "CANCELLED"] as const)(
    "refuses a booking that is %s",
    async (status) => {
      addBooking({ status, stripePaymentIntentId: "pi_1" });
      const result = await run();
      expect(result.ok).toBe(false);
      expect(fake.refunds).toHaveLength(0);
    },
  );

  it("refuses an unknown booking id", async () => {
    expect((await run({ bookingId: "nope" })).ok).toBe(false);
  });

  it("refuses a stay that has already ended", async () => {
    const booking = paid({ endDate: day("2026-12-10") });
    const result = await run();
    expect(result.ok).toBe(false);
    expect(booking.status).toBe("CONFIRMED");
    expect(fake.refunds).toHaveLength(0);
  });

  it("still allows a stay that ends today", async () => {
    paid({ endDate: day("2026-12-11") });
    expect((await run()).ok).toBe(true);
  });

  it("changes nothing when Stripe refuses the refund", async () => {
    const booking = paid();
    fake.refundError = { code: "api_connection_error" };
    const result = await run();

    expect(result.ok).toBe(false);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.refundedAt).toBeNull();
  });

  it("records the cancellation when the payment was already refunded in Stripe", async () => {
    const booking = paid();
    fake.refundError = { code: "charge_already_refunded" };
    const result = await run();

    expect(result.ok).toBe(true);
    expect(booking.status).toBe("CANCELLED");
    expect(booking.refundedAt).toBeInstanceOf(Date);
  });

  it("a second click after success is refused and refunds nothing again", async () => {
    paid();
    await run();
    fake.refunds.length = 0;
    const again = await run();

    expect(again.ok).toBe(false);
    expect(fake.refunds).toHaveLength(0);
  });
});
