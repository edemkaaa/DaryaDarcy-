/** Канонизация и HMAC-подпись Prodamus; сравнение подписи не раскрывает различие по байтам. */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Канонизирует scalar в строки и null в пустую строку рекурсивно, сохраняя собственные __proto__ как данные в null-prototype объектах. */
function stringifyValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stringifyValues);
  if (value && typeof value === "object") {
    // Сохраняем все собственные JSON-поля, включая __proto__, как данные подписи.
    const out: Record<string, unknown> = Object.create(null);
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = stringifyValues(nested);
    }
    return out;
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

/** Сортирует ключи объектов на каждом уровне, сохраняя порядок массива и исключая влияние порядка полей на подпись. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Сериализует канонические данные с PHP-совместимым экранированием slash. */
function toProdamusJson(value: unknown): string {
  return JSON.stringify(value).replace(/\//g, "\\/");
}

/** Выводит HMAC-SHA256 hex из строково-нормализованного, глубоко отсортированного JSON и переданного секрета. */
export function createProdamusSign(data: unknown, secret: string): string {
  const prepared = sortDeep(stringifyValues(data));
  return createHmac("sha256", secret)
    .update(toProdamusJson(prepared), "utf8")
    .digest("hex");
}

/** Сравнивает подпись канонических данных без раннего выхода на различающемся байте. */
export function verifyProdamusSignature(
  data: unknown,
  signature: string,
  secrets: readonly string[],
): boolean {
  if (!signature) return false;
  const keys = [...new Set(secrets.filter(Boolean))];
  return keys.some((key) => {
    const expected = Buffer.from(createProdamusSign(data, key).toLowerCase());
    const received = Buffer.from(signature.toLowerCase());
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  });
}
