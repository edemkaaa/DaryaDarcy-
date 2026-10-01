import { describe, expect, it } from "vitest";
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from "../server/_core/password";

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
});
