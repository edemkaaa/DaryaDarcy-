import { afterAll, beforeAll, expect, it, vi } from "vitest";
let isOwnerUser: typeof import("../apps/frontend/src/shared/config/api").isOwnerUser;
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_OWNER_EMAIL", "owner@example.test");
  vi.stubEnv("NEXT_PUBLIC_OWNER_OPEN_ID", "legacy-owner-id");
  ({ isOwnerUser } = await import("../apps/frontend/src/shared/config/api"));
});
afterAll(() => vi.unstubAllEnvs());
it("uses an explicit administrator role for owner controls", () => {
  expect(isOwnerUser({ role: "admin", email: "staff@example.test" })).toBe(true);
  expect(isOwnerUser({ role: "moderator", email: "staff@example.test" })).toBe(false);
});
it("does not infer owner controls from a matching email", () => {
  expect(isOwnerUser({ role: "user", email: "OWNER@example.test" })).toBe(false);
});
it("does not infer owner controls from a legacy openId label", () => {
  expect(isOwnerUser({ role: "user", openId: "legacy-owner-id" })).toBe(false);
});
it("does not grant owner controls without a loaded user", () => {
  expect(isOwnerUser(null)).toBe(false);
});
