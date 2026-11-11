/** Проверяем нормализацию email и формат scrypt на синтетических паролях, без создания аккаунтов. */
import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { hashPassword, isValidEmail, normalizeEmail, verifyPassword } from "../apps/backend/src/_core/password";

/** Набор проверяет чистые helpers, а не доставку письма и не реальную пользовательскую сессию. */
describe("email auth helpers", () => {
  /** Убираем внешние пробелы и регистр, отклоняем строку без формы email. */
  it("normalizes and validates email", () => {
    expect(normalizeEmail("  DaryaDarcy19@gmail.com ")).toBe("daryadarcy19@gmail.com");
    expect(isValidEmail("daryadarcy19@gmail.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  /** Корректный пароль проверяется по хешу, другой пароль отклоняется. */
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("cottagecore");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("cottagecore", hash)).toBe(true);
    expect(await verifyPassword("wrong-pass", hash)).toBe(false);
  });

  /** Длина сохранённого digest должна совпадать с форматом; частичное сравнение недопустимо даже для правильного пароля. */
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


  /** Повреждённые параметры старой записи дают false вместо исключения или опасной работы scrypt. */
  it.each([
    [1, "invalid"],
    [1, "3"],
    [1, "1048576"],
    [2, "-1"],
    [3, "-1"],
  ])("rejects invalid stored scrypt field %i=%s without throwing", async (index, value) => {
    const parts = (await hashPassword("synthetic-password")).split("$");
    parts[Number(index)] = String(value);
    await expect(verifyPassword("synthetic-password", parts.join("$"))).resolves.toBe(false);
  });


  /** Поддерживаемая прежняя стоимость scrypt берётся из записи, а не заменяется новыми defaults. */
  it("retains supported encoded parameters rather than forcing the current hashing defaults", async () => {
    const salt = Buffer.alloc(16, 7);
    const digest = scryptSync("synthetic-password", salt, 32, { N: 8192, r: 8, p: 1 });
    const stored = `scrypt$8192$8$1$${salt.toString("base64")}$${digest.toString("base64")}`;
    expect(await verifyPassword("synthetic-password", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

});
