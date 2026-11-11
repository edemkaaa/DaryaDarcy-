/** HMAC проверяется на независимо заданной канонической строке и синтетических merchant keys. */
import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { verifyProdamusSignature } from "../apps/backend/src/billing/prodamus-signature";
import { verifyProdamusSign } from "../apps/backend/src/prodamus";

const body = Object.freeze({ sum: 790, order_num: "club-7-fixture" });
const canonical = '{"order_num":"club-7-fixture","sum":"790"}';
const key = "verification-fixture-only";
const signature = createHmac("sha256", key).update(canonical).digest("hex");

/** Не оставляем подстановки merchant-настроек между сценариями. */
afterEach(() => vi.unstubAllEnvs());

/** Таблица различает допустимый hex-регистр, ротацию ключей и все повреждённые digest/пустые ключи; секрет не нормализуется самим verifier. */
it.each([
  { name: "exact signature", received: signature, secrets: [key], want: true },
  {
    name: "uppercase signature",
    received: signature.toUpperCase(),
    secrets: [key],
    want: true,
  },
  {
    name: "later matching key",
    received: signature,
    secrets: ["foreign", key],
    want: true,
  },
  {
    name: "empty and duplicate keys",
    received: signature,
    secrets: ["", key, key],
    want: true,
  },
  { name: "missing signature", received: "", secrets: [key], want: false },
  { name: "missing keys", received: signature, secrets: [], want: false },
  {
    name: "empty key",
    received: createHmac("sha256", "").update(canonical).digest("hex"),
    secrets: [""],
    want: false,
  },
  { name: "wrong key", received: signature, secrets: ["foreign"], want: false },
  {
    name: "truncated digest",
    received: signature.slice(0, -1),
    secrets: [key],
    want: false,
  },
  {
    name: "appended digest",
    received: signature + "0",
    secrets: [key],
    want: false,
  },
  {
    name: "same-length wrong digest",
    received: "0".repeat(64),
    secrets: [key],
    want: false,
  },
  {
    name: "non-hex digest",
    received: "z".repeat(64),
    secrets: [key],
    want: false,
  },
  {
    name: "Unicode digest",
    received: "я".repeat(32),
    secrets: [key],
    want: false,
  },
  {
    name: "whitespace",
    received: " " + signature,
    secrets: [key],
    want: false,
  },
  {
    name: "demo suffix",
    received: createHmac("sha256", key + "demo")
      .update(canonical)
      .digest("hex"),
    secrets: [key],
    want: false,
  },
  {
    name: "configured whitespace key is not normalized",
    received: signature,
    secrets: [" " + key],
    want: false,
  },
])("preserves $name verification", ({ received, secrets, want }) => {
  expect(verifyProdamusSignature(body, received, Object.freeze(secrets))).toBe(
    want,
  );
});

/** Изменение подписанной суммы делает прежнюю подпись недействительной. */
it("rejects changed signed fields", () => {
  expect(verifyProdamusSignature({ ...body, sum: 791 }, signature, [key])).toBe(
    false,
  );
});

/** Следующий вызов использует только переданный ему набор ключей. */
it("does not retain keys across verification calls", () => {
  expect(verifyProdamusSignature(body, signature, [key])).toBe(true);
  expect(verifyProdamusSignature(body, signature, ["foreign"])).toBe(false);
});

/** Совместимый env-фасад перечитывает и обрезает конфигурационные ключи без process-cache прежнего значения. */
it("legacy facade reads and trims the current merchant keys on each call", () => {
  vi.stubEnv("PRODAMUS_SECRET", "");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", " " + key + " ");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
  expect(verifyProdamusSign(body, signature)).toBe(true);
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "foreign");
  expect(verifyProdamusSign(body, signature)).toBe(false);
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", key);
  expect(verifyProdamusSign(body, signature)).toBe(true);
});
