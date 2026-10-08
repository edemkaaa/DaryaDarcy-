import { createHmac } from "node:crypto";

function stringifyValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stringifyValues);
  if (value && typeof value === "object") {
    // Preserve every own JSON field, including __proto__, as signature data.
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

function toProdamusJson(value: unknown): string {
  return JSON.stringify(value).replace(/\//g, "\\/");
}

export function createProdamusSign(data: unknown, secret: string): string {
  const prepared = sortDeep(stringifyValues(data));
  return createHmac("sha256", secret)
    .update(toProdamusJson(prepared), "utf8")
    .digest("hex");
}
