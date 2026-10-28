import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../packages/database/src/schema";
import type { TrpcContext } from "../apps/backend/src/_core/context";

const state = vi.hoisted(() => ({
  orders: [] as string[],
  issued: false,
  activated: false,
  blocked: false,
  paid: false,
  password: false,
  existing: true,
  created: 0,
}));
const member: User = {
  id: 7,
  openId: "member",
  email: "member@example.test",
  name: null,
  phone: null,
  passwordHash: null,
  sessionVersion: 0, profileRevision: 0,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  role: "user",
  blockedAt: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};
vi.mock("../apps/backend/src/db", () => ({
  getUserByEmail: async () =>
    state.existing
      ? {
          ...member,
          blockedAt: state.blocked ? new Date() : null,
          passwordHash: state.password ? "existing-hash" : null,
        }
      : undefined,
  ensureUserByEmail: async () => {
    state.created += 1;
    return member;
  },
  createClubPayment: async ({ orderId }: { orderId: string }) => {
    state.orders.push(orderId);
  },
  getActiveClubSubscription: async () =>
    state.paid ? { orderId: "club-7-paid" } : undefined,
  activateLatestPendingClubPayment: async () => {
    state.activated = true;
    return { granted: true, orderId: "club-7-pending" };
  },
}));
vi.mock("../apps/backend/src/_core/sdk", () => ({
  sdk: {
    createSessionToken: async () => {
      state.issued = true;
      return "CHECKOUT_MUST_NOT_ISSUE_SESSION";
    },
  },
}));
import { appRouter } from "../apps/backend/src/routers";
import * as prodamus from "../apps/backend/src/prodamus";
function caller(user: User | null = null, intentKey?: string) {
  const context = { user, req: {}, res: {} } as TrpcContext;
  context.req.headers = { "idempotency-key": intentKey };
  return appRouter.createCaller(context);
}
let checkoutClock = 1790940000000;
beforeEach(() => {
  checkoutClock += 16 * 60_000;
  vi.spyOn(Date, "now").mockImplementation(() => checkoutClock);
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "");
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-signing-key");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "12345");
  state.orders = [];
  state.issued = false;
  state.activated = false;
  state.blocked = false;
  state.paid = false;
  state.password = false;
  state.existing = true;
  state.created = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("checkout cannot establish identity or payment", () => {
  it.each(["", "false"])(
    "a keyed test intent cannot fall back to Prodamus when YooKassa mode is %j",
    async (enabled) => {
      vi.stubEnv("YOOKASSA_TEST_ENABLED", enabled);
      for (const existing of [false, true]) {
        state.existing = existing;
        for (const plan of ["monthly", "semiannual"] as const) {
          await expect(
            caller(
              null,
              "8d427a00-4a92-4508-874c-b265d7e92d1c",
            ).club.createCheckout({ email: member.email!, plan }),
          ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
        }
      }
      expect(state.orders).toEqual([]);
      expect(state.created).toBe(0);
      expect(state.issued).toBe(false);
    },
  );

  it("does not persist an order if building its payment link fails", async () => {
    vi.spyOn(prodamus, "buildCheckoutUrl").mockImplementation(() => {
      throw new Error("synthetic checkout failure");
    });
    await expect(
      caller().club.createCheckout({ email: member.email! }),
    ).rejects.toThrow("synthetic checkout failure");
    expect(state.orders).toEqual([]);
    expect(state.issued).toBe(false);
  });
  it.each([
    ["PRODAMUS_SECRET", ""],
    ["PRODAMUS_PAYFORM_URL", ""],
    ["PRODAMUS_PAYFORM_URL", "https://payments-disabled.invalid"],
    ["PUBLIC_APP_URL", ""],
    ["PUBLIC_APP_URL", "https://user:PRIVATE_VALUE@club.example.test"],
    ["PRODAMUS_SUBSCRIPTION_ID", ""],
    ["PRODAMUS_SUBSCRIPTION_ID", "not-an-id"],
  ])(
    "rejects invalid %s before creating a recipient or order",
    async (name, value) => {
      vi.stubEnv(name, value);
      for (const existing of [false, true]) {
        state.existing = existing;
        await expect(
          caller().club.createCheckout({ email: member.email! }),
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: "Оплата временно недоступна. Попробуйте позже.",
        });
      }
      expect(state.orders).toEqual([]);
      expect(state.created).toBe(0);
      expect(state.issued).toBe(false);
    },
  );
  it("keeps the semiannual one-off checkout independent of a monthly subscription ID", async () => {
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
    state.existing = false;
    const result = await caller().club.createCheckout({
      email: member.email!,
      plan: "semiannual",
    });
    expect(new URL(result.url).searchParams.has("subscription")).toBe(false);
    expect(state.orders).toHaveLength(1);
    expect(state.created).toBe(1);
    expect(result.user).toBeNull();
  });
  it.each(["monthly", "semiannual"] as const)(
    "creates distinct %s orders for concurrent requests in the same millisecond",
    async (plan) => {
      vi.spyOn(Date, "now").mockReturnValue(checkoutClock);
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          caller().club.createCheckout({ email: member.email!, plan }),
        ),
      );
      expect(new Set(state.orders).size).toBe(8);
      expect(
        state.orders.every(
          (id) =>
            id.length <= 64 &&
            id.startsWith(plan === "semiannual" ? "club6m-7-" : "club-7-"),
        ),
      ).toBe(true);
      expect(results.every((result) => result.user === null)).toBe(true);
      expect(
        results
          .map((result) => new URL(result.url).searchParams.get("order_id"))
          .sort(),
      ).toEqual([...state.orders].sort());
    },
  );
  it("creates checkout without logging into a passwordless existing account", async () => {
    const result = await caller().club.createCheckout({ email: member.email! });
    expect(result.url).toContain("order_id=club-7-");
    expect(result.user).toBeNull();
    expect(state.issued).toBe(false);
  });
  it("can pay for an existing account without changing its password or authenticating", async () => {
    state.password = true;
    const result = await caller().club.createCheckout({ email: member.email! });
    expect(result.user).toBeNull();
    expect(state.issued).toBe(false);
  });
  it("rejects a blocked checkout email", async () => {
    state.blocked = true;
    await expect(
      caller().club.createCheckout({ email: member.email! }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.orders).toEqual([]);
  });
  it("rejects checkout from a blocked session", async () => {
    await expect(
      caller({ ...member, blockedAt: new Date() }).club.createCheckout(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.orders).toEqual([]);
  });
  it("does not bind another email to the logged-in account's payment", async () => {
    await expect(
      caller(member).club.createCheckout({ email: "other@example.test" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.orders).toEqual([]);
  });
  it("claimPending never grants an unpaid order", async () => {
    const result = await caller(member).club.claimPending();
    expect(result).toEqual({ granted: false, orderId: null });
    expect(state.activated).toBe(false);
  });
  it("claimPending reports access already verified by the server", async () => {
    state.paid = true;
    expect(await caller(member).club.claimPending()).toEqual({
      granted: true,
      orderId: "club-7-paid",
    });
    expect(state.activated).toBe(false);
  });
});
