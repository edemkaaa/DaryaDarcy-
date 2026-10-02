import { afterEach, expect, it, vi } from "vitest";
import { isOwnerAccount } from "../apps/backend/src/db";
afterEach(() => vi.unstubAllEnvs());
it("public email and derived openId do not confer staff privileges", () => {
  vi.stubEnv("OWNER_EMAIL", "owner@example.test");
  vi.stubEnv("OWNER_OPEN_ID", "public-derived-open-id");
  expect(
    isOwnerAccount({
      email: "owner@example.test",
      openId: "public-derived-open-id",
      role: "user",
    }),
  ).toBe(false);
  expect(isOwnerAccount({ role: "admin" })).toBe(true);
});
