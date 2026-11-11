/** Ограниченный TEST runtime проверяется настоящим локальным HTTP с выключенной БД и synthetic proofs. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createHmac, randomUUID } from "node:crypto";
import { createBackendApplication } from "../apps/backend/src/_core/application";

let app: INestApplication;
let base: string;
/** Фабрика принимает только явные TEST POST paths, а не весь обычный API. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
  vi.stubEnv("PRODAMUS_TEST_PAYFORM_URL", "https://testpage1.payform.ru");
  vi.stubEnv("PRODAMUS_TEST_SECRET", "a".repeat(64));
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
  app = await createBackendApplication({
    allowedPostPaths: [
      "/api/trpc/club.createCheckout",
      "/api/prodamus/test/webhook",
      "/api/prodamus/test/result",
    ],
  });
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
/** Закрываем app и возвращаем TEST env. */
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
/** Посторонние routes, mixed batch и GET не достигают handlers и дают404/security headers. */
it.each([
  ["GET", "/api/launch-config"],
  ["POST", "/api/prodamus/webhook"],
  ["POST", "/api/trpc/profile.update"],
  ["POST", "/api/trpc/club.createCheckout,profile.update"],
  ["POST", "/api/auth/register"],
  ["GET", "/api/trpc/club.createCheckout"],
  ["GET", "/api/prodamus/test/result"],
])(
  "restricted runtime refuses %s %s before unrelated application handlers",
  async (method, path) => {
    const response = await fetch(base + path, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  },
);
/** Неверный token возвращает minimal unknown без cookie, PII и доступа. */
it("exposes only a read-only unknown result for invalid proof, never session or identity data", async () => {
  const response = await fetch(base + "/api/prodamus/test/result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ token: "not-a-receipt-or-session" }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    state: "unknown",
    nextAction: null,
    emailStatus: null,
  });
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
/** Валидная подпись при отсутствующей receipt DB даёт503, не выдуманный статус оплаты. */
it("returns a sanitized unavailable response, not paid or pending, when receipt storage is absent", async () => {
  const payload = `club-test-94321-83be933e-a277-41f3-801d-45771c12b051.${Math.floor(Date.now() / 1000) + 3600}`;
  const token = `${payload}.${createHmac("sha256", "a".repeat(64)).update(`prodamus-test-return:v1:${payload}`).digest("hex")}`;
  const response = await fetch(base + "/api/prodamus/test/result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ token }),
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "test result unavailable" });
  expect(response.headers.get("set-cookie")).toBeNull();
});
/** Cookie/query/type/лишние поля/длинный token/неверный key запрещены с безопасным ответом. */
it.each([
  ["?paid=1", {}, "application/json", { token: "fixture" }, 400],
  [
    "",
    { Cookie: "session=PRIVATE_FIXTURE" },
    "application/json",
    { token: "fixture" },
    400,
  ],
  ["", {}, "text/plain", { token: "fixture" }, 415],
  [
    "",
    {},
    "application/json",
    { token: "fixture", email: "PRIVATE_FIXTURE" },
    400,
  ],
  ["", {}, "application/json", { token: "x".repeat(193) }, 400],
  [
    "",
    { "Idempotency-Key": "invalid" },
    "application/json",
    { token: "fixture" },
    400,
  ],
])(
  "refuses malformed result transport without echoing data (%s)",
  async (query, headers, type, body, status) => {
    const response = await fetch(base + "/api/prodamus/test/result" + query, {
      method: "POST",
      headers: {
        "Content-Type": type,
        "Idempotency-Key": randomUUID(),
        ...headers,
      },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("PRIVATE_FIXTURE");
  },
);
/** Один intent допускает12checks, затем429 и положительный Retry-After. */
it("stops at the existing twelve-check intent budget rather than adding a new quota", async () => {
  const intent = randomUUID();
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": intent },
    body: JSON.stringify({ token: "fixture" }),
  };
  for (let attempt = 0; attempt < 12; attempt++)
    expect(
      (await fetch(base + "/api/prodamus/test/result", options)).status,
    ).toBe(200);
  const refused = await fetch(base + "/api/prodamus/test/result", options);
  expect(refused.status).toBe(429);
  expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
});
/** TEST webhook не получает CORS исключение для чужого браузера. */
it("retains browser-origin protection on the selected test receiver", async () => {
  const response = await fetch(base + "/api/prodamus/test/webhook", {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(response.status).toBe(403);
});
/** Webhook сохраняет query/cookie/MIME/body bounds до разбора proof. */
it.each([
  ["?injected=1", {}, "application/json", "{}", 400],
  ["", { Cookie: "session=fixture" }, "application/json", "{}", 400],
  ["", {}, "text/plain", "{}", 415],
  ["", {}, "application/json", "x".repeat(65537), 413],
])(
  "refuses untrusted receiver transport without echoing request data (%s)",
  async (query, headers, type, body, status) => {
    const response = await fetch(base + "/api/prodamus/test/webhook" + query, {
      method: "POST",
      headers: { ...headers, "Content-Type": type },
      body,
    });
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("session=fixture");
  },
);
