import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  buildCheckoutUrl,
  buildShopCheckoutUrl,
  handleProdamusReturn,
} from "../apps/backend/src/prodamus";

const input = {
  orderId: "club-7-fixture",
  email: "member@example.test",
  userId: 7,
};
beforeEach(() => {
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://auth.example.test");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-signing-key");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "12345");
});
afterEach(() => vi.unstubAllEnvs());

describe("checkout links stay on the configured application", () => {
  it("preserves a plus-addressed recipient through the signed checkout query", () => {
    const params = new URL(
      buildCheckoutUrl({ ...input, email: "member+club@example.test" }),
    ).searchParams;
    expect(params.get("customer_email")).toBe("member+club@example.test");
  });
  it("uses Prodamus's documented SBP identifier for the monthly subscription", () => {
    const params = new URL(buildCheckoutUrl(input)).searchParams;
    expect(params.get("payment_method")).toBe("SBP");
    expect(params.get("subscription")).toBe("12345");
  });
  it("does not force Russian SBP on the foreign-card one-off plan", () => {
    const params = new URL(buildCheckoutUrl({ ...input, orderId: "club6m-7-fixture", plan: "semiannual" })).searchParams;
    expect(params.has("payment_method")).toBe(false);
    expect(params.has("subscription")).toBe(false);
    expect(params.get("products[0][price]")).toBe("4740");
  });
  it.each(["monthly", "semiannual"] as const)(
    "keeps every %s callback on staging rather than production or the auth host",
    (plan) => {
      const params = new URL(buildCheckoutUrl({ ...input, plan })).searchParams;
      expect(params.get("urlSuccess")).toBe(
        "https://daryadarcy.dev.reeskeen.ru/api/prodamus/return?order=club-7-fixture",
      );
      expect(params.get("urlReturn")).toBe(
        "https://daryadarcy.dev.reeskeen.ru/club",
      );
      expect(params.get("urlNotification")).toBe(
        "https://daryadarcy.dev.reeskeen.ru/api/prodamus/webhook",
      );
      expect(params.get("paid_content")).toContain(
        "https://daryadarcy.dev.reeskeen.ru/login",
      );
      expect(params.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    },
  );
  it("uses the same application origin for shop callbacks without enabling shop payments", () => {
    const params = new URL(
      buildShopCheckoutUrl({
        productId: "digital-1",
        orderId: "shop-digital-1-fixture",
      })!,
    ).searchParams;
    expect(params.get("urlSuccess")).toBe(
      "https://daryadarcy.dev.reeskeen.ru/api/prodamus/return?order=shop-digital-1-fixture",
    );
    expect(params.get("urlReturn")).toBe(
      "https://daryadarcy.dev.reeskeen.ru/shop/digital-1",
    );
    expect(params.get("urlNotification")).toBe(
      "https://daryadarcy.dev.reeskeen.ru/api/prodamus/webhook",
    );
  });
  it("returns the browser to staging without using a request-supplied host", async () => {
    let location = "";
    const req = {
      query: { order: input.orderId },
      body: {},
      headers: { host: "attacker.example.test" },
    } as unknown as Request;
    const res = {
      redirect: (_code: number, value: string) => {
        location = value;
      },
    } as Response;
    await handleProdamusReturn(req, res);
    expect(location).toBe("https://daryadarcy.dev.reeskeen.ru/club?paid=1");
  });
  it.each([
    "",
    "javascript:alert(1)",
    "https://user:PRIVATE_VALUE@club.example.test",
    "http://club.example.test",
  ])("refuses unsafe application configuration without leaking it", (app) => {
    vi.stubEnv("PUBLIC_APP_URL", app);
    vi.stubEnv("NODE_ENV", "production");
    expect(() => buildCheckoutUrl(input)).toThrow();
    try {
      buildCheckoutUrl(input);
    } catch (error) {
      expect(String(error)).not.toContain("PRIVATE_VALUE");
    }
  });
  it("responds safely when the browser return is misconfigured", async () => {
    vi.stubEnv("PUBLIC_APP_URL", "");
    let status = 0;
    const res = {
      status: (code: number) => {
        status = code;
        return res;
      },
      send: () => res,
      redirect: (code: number) => {
        status = code;
      },
    } as unknown as Response;
    await handleProdamusReturn(
      { query: {}, body: {}, headers: {} } as Request,
      res,
    );
    expect(status).toBe(503);
  });
});
