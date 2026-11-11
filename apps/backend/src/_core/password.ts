/** Хеширование паролей, проверка старых хешей и единая нормализация email для identity-границ. */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Оборачивает callback scrypt в Promise, сохраняя различие результата и криптографической ошибки. */
function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
const KEYLEN = 32;
const N = 16384;
const R = 8;
const P = 1;

/** Создаёт случайную соль и сохраняет параметры scrypt вместе с 32-байтовым digest для последующей совместимой проверки. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/** Проверяет формат и полную длину digest, вычисляет scrypt с сохранёнными параметрами и сравнивает timingSafeEqual; неизвестный crypto-сбой не маскирует. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  // Stored digests use KEYLEN. Corruption must not shorten the comparison to
  // a prefix, or to zero bytes where every password would match.
  if (expected.length !== KEYLEN) return false;
  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, KEYLEN, { N: n, r, p });
  } catch (error) {
    // Node rejects unsupported stored parameters before checking the password.
    // Other crypto failures still need the server-error path, not a fake denial.
    if (
      error instanceof RangeError &&
      "code" in error &&
      (error.code === "ERR_OUT_OF_RANGE" ||
        error.code === "ERR_CRYPTO_INVALID_SCRYPT_PARAMS")
    ) {
      return false;
    }
    throw error;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Убирает внешние пробелы и приводит email к нижнему регистру для общего поиска identity. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Проверяет базовую форму одного email без пробелов; это не доказательство владения адресом. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
