import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "../server/_core/password";

describe("password compatibility", () => {
  it("preserves the existing scrypt format and verifies correct passwords", async () => {
    const hash = await hashPassword("local-test-password");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("local-test-password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("verifies a legacy-format fixture generated independently", async () => {
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const key = scryptSync("fixture", salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
    expect(await verifyPassword("fixture", stored)).toBe(true);
  });
});
