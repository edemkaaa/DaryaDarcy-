import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-signing-key");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "12345");
  vi.stubEnv("CLUB_PRICE", "790");
  vi.stubEnv("CLUB_SEMIANNUAL_PRICE", "4740");
});
afterEach(() => vi.unstubAllEnvs());

describe("club checkout configuration fails closed", () => {
  it.each([
    ["PRODAMUS_SECRET", ""],
    ["PRODAMUS_SECRET", "  "],
    ["PRODAMUS_PAYFORM_URL", ""],
    ["PRODAMUS_PAYFORM_URL", "https://payments-disabled.invalid"],
    ["PRODAMUS_PAYFORM_URL", "http://fixture.payform.ru"],
    ["PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru.attacker.test"],
    ["PRODAMUS_PAYFORM_URL", "https://PRIVATE_VALUE@fixture.payform.ru"],
    ["PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru:8443"],
    ["PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru/path"],
    [
      "PRODAMUS_PAYFORM_URL",
      "https://fixture.payform.ru?subscription=PRIVATE_VALUE",
    ],
    ["PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru#PRIVATE_VALUE"],
  ])(
    "refuses invalid %s instead of producing a payable or unsigned link",
    async (name, value) => {
      vi.stubEnv(name, value);
      const { buildCheckoutUrl } = await import("../apps/backend/src/prodamus");
      for (const plan of ["monthly", "semiannual"] as const) {
        expect(() =>
          buildCheckoutUrl({
            orderId: "club-7-fixture",
            email: "member@example.test",
            userId: 7,
            plan,
          }),
        ).toThrowError("Оплата временно недоступна. Попробуйте позже.");
      }
    },
  );
  it.each(["", "0", "-1", "abc", "1.5"])(
    "refuses invalid monthly subscription ID %s",
    async (id) => {
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", id);
      const { buildCheckoutUrl } = await import("../apps/backend/src/prodamus");
      expect(() =>
        buildCheckoutUrl({
          orderId: "club-7-fixture",
          email: "member@example.test",
          userId: 7,
        }),
      ).toThrowError("Оплата временно недоступна. Попробуйте позже.");
    },
  );
  it.each(["CLUB_PRICE", "CLUB_SEMIANNUAL_PRICE"])(
    "validates the configured %s with the same rules as settlement",
    async (name) => {
      const plan = name === "CLUB_PRICE" ? "monthly" : "semiannual";
      for (const price of ["0", "-1", "NaN", "790.001", "1e3", "99999999"]) {
        vi.stubEnv(name, price);
        vi.resetModules();
        const { buildCheckoutUrl } =
          await import("../apps/backend/src/prodamus");
        expect(() =>
          buildCheckoutUrl({
            orderId: "club-7-fixture",
            email: "member@example.test",
            userId: 7,
            plan,
          }),
        ).toThrowError("Оплата временно недоступна. Попробуйте позже.");
      }
    },
  );
  it("accepts an explicit HTTPS payform root and positive fractional price", async () => {
    vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru/");
    vi.stubEnv("CLUB_SEMIANNUAL_PRICE", "4740.50");
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
    const { buildCheckoutUrl } = await import("../apps/backend/src/prodamus");
    const url = new URL(
      buildCheckoutUrl({
        orderId: "club6m-7-fixture",
        email: "member@example.test",
        userId: 7,
      }),
    );
    expect(url.origin).toBe("https://fixture.payform.ru");
    expect(url.searchParams.get("sum")).toBe("4740.50");
    expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.has("subscription")).toBe(false);
  });
});
