/** Проверяем совместимость паролей с действующим и прежним форматом scrypt без реальных учётных данных. */
import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { hashPassword, verifyPassword } from "../../apps/backend/src/_core/password";

/** Новый хеш и независимо построенная старая фикстура должны проверяться одним контрактом. */
describe("password compatibility", () => {
  /** Проверяем префикс параметров scrypt, успешный пароль и отказ для другого значения. */
  it("preserves the existing scrypt format and verifies correct passwords", async () => {
    const hash = await hashPassword("local-test-password");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("local-test-password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  /** Фикстура строится напрямую через crypto, чтобы тест не повторял ошибку проверяемого генератора. */
  it("verifies a legacy-format fixture generated independently", async () => {
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
    const key = scryptSync("fixture", salt, 32, { N: 16384, r: 8, p: 1 });
    const stored = `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
    expect(await verifyPassword("fixture", stored)).toBe(true);
  });
});
