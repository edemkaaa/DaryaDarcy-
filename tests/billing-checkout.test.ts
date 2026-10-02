import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../packages/database/src/schema";
import type { TrpcContext } from "../apps/backend/src/_core/context";

const state = vi.hoisted(() => ({ orders: [] as string[], issued: false, activated: false, blocked: false, paid: false, password: false }));
const member: User = {
  id: 7, openId: "member", email: "member@example.test", name: null, phone: null,
  passwordHash: null, sessionVersion: 0, loginMethod: "email", gender: null, avatarUrl: null, role: "user",
  blockedAt: null, blockedReason: null, accountDeletionRequestedAt: null,
  createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
};
vi.mock("../apps/backend/src/db", () => ({
  getUserByEmail: async () => ({ ...member, blockedAt: state.blocked ? new Date() : null, passwordHash: state.password ? "existing-hash" : null }),
  ensureUserByEmail: async () => member,
  createClubPayment: async ({ orderId }: { orderId: string }) => { state.orders.push(orderId); },
  getActiveClubSubscription: async () => state.paid ? { orderId: "club-7-paid" } : undefined,
  activateLatestPendingClubPayment: async () => { state.activated = true; return { granted: true, orderId: "club-7-pending" }; },
}));
vi.mock("../apps/backend/src/_core/oauth", () => ({ issueSession: async () => { state.issued = true; } }));
import { appRouter } from "../apps/backend/src/routers";
function caller(user: User | null = null) {
  return appRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
}
beforeEach(() => {
  state.orders = []; state.issued = false; state.activated = false;
  state.blocked = false; state.paid = false; state.password = false;
});
afterEach(() => vi.restoreAllMocks());
describe("checkout cannot establish identity or payment", () => {
  it.each(["monthly", "semiannual"] as const)("creates distinct %s orders for concurrent requests in the same millisecond", async plan => {
    vi.spyOn(Date, "now").mockReturnValue(1790940000000);
    const results = await Promise.all(Array.from({ length: 8 }, () => caller().club.createCheckout({ email: member.email!, plan })));
    expect(new Set(state.orders).size).toBe(8);
    expect(state.orders.every(id => id.length <= 64 && id.startsWith(plan === "semiannual" ? "club6m-7-" : "club-7-"))).toBe(true);
    expect(results.every(result => result.user === null)).toBe(true);
    expect(results.map(result => new URL(result.url).searchParams.get("order_id")).sort()).toEqual([...state.orders].sort());
  });
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
    await expect(caller().club.createCheckout({ email: member.email! })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.orders).toEqual([]);
  });
  it("rejects checkout from a blocked session", async () => {
    await expect(caller({ ...member, blockedAt: new Date() }).club.createCheckout()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.orders).toEqual([]);
  });
  it("does not bind another email to the logged-in account's payment", async () => {
    await expect(caller(member).club.createCheckout({ email: "other@example.test" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.orders).toEqual([]);
  });
  it("claimPending never grants an unpaid order", async () => {
    const result = await caller(member).club.claimPending();
    expect(result).toEqual({ granted: false, orderId: null });
    expect(state.activated).toBe(false);
  });
  it("claimPending reports access already verified by the server", async () => {
    state.paid = true;
    expect(await caller(member).club.claimPending()).toEqual({ granted: true, orderId: "club-7-paid" });
    expect(state.activated).toBe(false);
  });
});
