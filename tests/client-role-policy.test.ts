import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
let isOwnerUser: typeof import("../apps/frontend/constants/oauth").isOwnerUser;
beforeAll(async () => {
  vi.stubEnv("EXPO_PUBLIC_OWNER_EMAIL", "owner@example.test");
  vi.stubEnv("EXPO_PUBLIC_OWNER_OPEN_ID", "legacy-owner-id");
  ({ isOwnerUser } = await import("../apps/frontend/constants/oauth"));
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
