import { describe, expect, it } from "vitest";
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from "../apps/backend/src/_core/password";

describe("email auth helpers", () => {
  it("normalizes and validates email", () => {
    expect(normalizeEmail("  DaryaDarcy19@gmail.com ")).toBe("daryadarcy19@gmail.com");
    expect(isValidEmail("daryadarcy19@gmail.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("cottagecore");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("cottagecore", hash)).toBe(true);
    expect(await verifyPassword("wrong-pass", hash)).toBe(false);
  });

  it.each([0, 1, 31, 33])(
    "rejects a damaged stored digest of %i bytes instead of accepting a partial comparison",
    async (length) => {
      const password = "synthetic-correct-password";
      const parts = (await hashPassword(password)).split("$");
      const complete = Buffer.from(parts[5], "base64");
      parts[5] = (length <= complete.length
        ? complete.subarray(0, length)
        : Buffer.concat([complete, Buffer.alloc(length - complete.length)])
      ).toString("base64");
      const damaged = parts.join("$");
      expect(await verifyPassword(password, damaged)).toBe(false);
      expect(await verifyPassword("synthetic-wrong-password", damaged)).toBe(false);
    },
  );

});
