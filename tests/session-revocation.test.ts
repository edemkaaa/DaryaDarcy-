import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
const state = vi.hoisted(() => ({ version: 0, blocked: false }));
vi.mock("../apps/backend/src/db", () => ({
  getUserByOpenId: async () => ({
    id: 1,
    openId: "session-test",
    sessionVersion: state.version,
    blockedAt: state.blocked ? new Date() : null,
  }),
  recordAuthenticatedActivity: async () => {},
}));
import { sdk } from "../apps/backend/src/_core/sdk";
vi.stubEnv("JWT_SECRET", "local-test-only-session-signing-key");
describe("session revocation", () => {
  it("rejects a previously issued token after password version changes", async () => {
    state.version = 0;
    state.blocked = false;
    const token = await sdk.createSessionToken("session-test");
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    expect((await sdk.authenticateRequest(req)).id).toBe(1);
    state.version = 1;
    await expect(sdk.authenticateRequest(req)).rejects.toThrow();
  });
  it("rejects blocked users at the shared authentication boundary", async () => {
    state.version = 0;
    state.blocked = true;
    const token = await sdk.createSessionToken("session-test");
    await expect(
      sdk.authenticateRequest({
        headers: { authorization: `Bearer ${token}` },
      } as Request),
    ).rejects.toThrow();
  });
});
