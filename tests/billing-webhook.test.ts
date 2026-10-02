import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

// Only persistence is replaced: the real parser, signature check and HTTP handlers run.
const state = vi.hoisted(() => ({ paid: false, cancelled: false }));
vi.mock("../apps/backend/src/db", () => ({
  getClubPaymentByOrderId: async () => ({ userId: 7, email: "member@example.test", status: "pending" }),
  getShopPurchaseByOrderId: async () => undefined,
  getUserByEmail: async () => ({ id: 7 }),
  getActiveClubSubscription: async () => ({ userId: 7, status: "paid" }),
  nextClubExpiry: async () => new Date("2026-11-01T00:00:00Z"),
  markClubPaymentPaid: async () => { state.paid = true; },
  settleClubPayment: async () => { state.paid = true; return true; },
  cancelClubSubscription: async () => { state.cancelled = true; },
}));
import { createProdamusSign, handleProdamusReturn, handleProdamusWebhook } from "../apps/backend/src/prodamus";

const payment = {
  order_id: "300155", order_num: "club-7-100", domain: "daryadarcy-club.payform.ru",
  sum: "790.00", currency: "rub", customer_email: "member@example.test",
  payment_status: "success", products: [{ name: "Клуб", price: "790.00", quantity: "1", sum: "790.00" }],
};
function response() {
  const result = { status: 200, body: "", location: "" };
  const res = {
    status(code: number) { result.status = code; return this; },
    send(body: string) { result.body = body; return this; },
    redirect(code: number, url: string) { result.status = code; result.location = url; },
  } as Response;
  return { result, res };
}
async function notify(body: Record<string, unknown>, secret?: string) {
  const { result, res } = response();
  const req = { method: "POST", query: {}, headers: secret ? { sign: createProdamusSign(body, secret) } : {},
    body: Buffer.from(JSON.stringify(body)) } as Request;
  await handleProdamusWebhook(req, res);
  return result;
}
beforeEach(() => {
  state.paid = false; state.cancelled = false;
  vi.stubEnv("PRODAMUS_SECRET", "test-only-secret");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
});
describe("billing notification trust boundary", () => {
  it("does not allow unsigned form parsing to mutate Object.prototype", async () => {
    const { res } = response();
    const req: Partial<Request> = { method: "POST", query: {}, headers: {},
      body: Buffer.from("__proto__[billingAuditPolluted]=yes") };
    try {
      await handleProdamusWebhook(req as Request, res);
      expect(({} as Record<string, unknown>).billingAuditPolluted).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>).billingAuditPolluted;
    }
  });
  it("browser return never activates an order", async () => {
    const { result, res } = response();
    const req: Partial<Request> = { query: { order: "club-7-100" }, body: {}, headers: {} };
    await handleProdamusReturn(req as Request, res);
    expect(state.paid).toBe(false);
    expect(result.status).toBe(302);
  });
  it.each([undefined, "wrong-secret", "test-only-secretdemo"])("rejects unauthenticated notification signed with %s", async (secret) => {
    const result = await notify(payment, secret);
    expect(state.paid).toBe(false);
    expect(result.status).toBe(400);
  });
  it("rejects unsigned cancellation before any state change", async () => {
    const result = await notify({ ...payment, subscription: { action_code: "deactivation" } });
    expect(state.cancelled).toBe(false);
    expect(result.status).toBe(400);
  });
  it.each(["failed", "", "order_canceled"])("cannot fulfil recurrence with status %s", async (status) => {
    await notify({ ...payment, payment_status: status, subscription: { action_code: "auto_payment" } }, "test-only-secret");
    expect(state.paid).toBe(false);
  });
  it("accepts a valid signed successful payment", async () => {
    const result = await notify(payment, "test-only-secret");
    expect(result.body).toBe("success");
    expect(state.paid).toBe(true);
  });
  it("accepts signed cancellation without granting a payment", async () => {
    await notify({ ...payment, subscription: { action_code: "deactivation" } }, "test-only-secret");
    expect(state.cancelled).toBe(true);
    expect(state.paid).toBe(false);
  });
});
