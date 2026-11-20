import { describe, expect, it } from "vitest";
import { dailyRateSchema, petFormSchema } from "@/lib/validations";
import { getSignedInRedirect } from "@/lib/redirects";

describe("dailyRateSchema", () => {
  it.each([
    ["45", 4500],
    ["45.5", 4550],
    ["45.50", 4550],
    ["  12  ", 1200],
  ])("turns %j into %i cents", (text, cents) => {
    expect(dailyRateSchema.parse(text)).toBe(cents);
  });

  it("treats an empty string as no rate", () => {
    expect(dailyRateSchema.parse("")).toBeNull();
  });

  it.each(["abc", "-5", "1e3", "45.555", "$45", "0"])("rejects %j", (text) => {
    expect(dailyRateSchema.safeParse(text).success).toBe(false);
  });

  it("rejects a rate above the maximum", () => {
    expect(dailyRateSchema.safeParse("1001").success).toBe(false);
  });
});

describe("petFormSchema owner contact", () => {
  const form = {
    name: "Rex",
    ownerName: "Sam",
    age: 3,
    imageUrl: "",
    notes: "",
  };

  it("lowercases and trims the owner email", () => {
    const parsed = petFormSchema.parse({
      ...form,
      ownerEmail: "  Sam@Example.COM ",
    });
    expect(parsed.ownerEmail).toBe("sam@example.com");
  });

  it("strips punctuation from the phone number", () => {
    const parsed = petFormSchema.parse({
      ...form,
      ownerPhone: "+1 (415) 555-2671",
    });
    expect(parsed.ownerPhone).toBe("+14155552671");
  });

  it("leaves a cleared optional field out of the output entirely", () => {
    const parsed = petFormSchema.parse({
      ...form,
      ownerEmail: "",
      ownerPhone: "",
    });
    expect("ownerEmail" in parsed && parsed.ownerEmail !== undefined).toBe(
      false,
    );
    expect("ownerPhone" in parsed && parsed.ownerPhone !== undefined).toBe(
      false,
    );
  });

  it("rejects a bad email and a too-short phone number", () => {
    expect(
      petFormSchema.safeParse({ ...form, ownerEmail: "not-an-email" }).success,
    ).toBe(false);
    expect(
      petFormSchema.safeParse({ ...form, ownerPhone: "12345" }).success,
    ).toBe(false);
  });
});

describe("getSignedInRedirect", () => {
  it("sends a signed-in user from the landing and auth pages to the dashboard", () => {
    expect(getSignedInRedirect("/")).toBe("/app/dashboard");
    expect(getSignedInRedirect("/sign-in")).toBe("/app/dashboard");
    expect(getSignedInRedirect("/sign-up/")).toBe("/app/dashboard");
  });

  it("does not interrupt Clerk's multi-step flows", () => {
    expect(getSignedInRedirect("/sign-in/sso-callback")).toBeNull();
    expect(getSignedInRedirect("/sign-up/verify-email")).toBeNull();
  });

  it("leaves other pages alone", () => {
    expect(getSignedInRedirect("/app/dashboard")).toBeNull();
    expect(getSignedInRedirect("/pricing")).toBeNull();
  });
});
