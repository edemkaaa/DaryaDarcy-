import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import superjson from "superjson";

const key = "34567890-1234-4123-8123-123456789abc";
let app: INestApplication;
let url: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
  // A configured legacy provider must never be a return-check fallback.
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-test-only");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru/");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/trpc/club.reconcileCheckout`;
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
function check(
  options: {
    key?: string | null;
    input?: unknown;
    body?: string;
    suffix?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const intentKey = options.key === undefined ? key : options.key;
  return fetch(url + (options.suffix || ""), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(intentKey ? { "Idempotency-Key": intentKey } : {}),
      ...options.headers,
    },
    body: options.body ?? JSON.stringify(superjson.serialize(options.input)),
  });
}
it("refuses disabled test return checking without entering legacy checkout or DB", async () => {
  const response = await check();
  expect(response.status).toBe(412);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
  const body = await response.json();
  expect(body.error.json.data.code).toBe("PRECONDITION_FAILED");
  expect(body.error.json.data.stack).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain(key);
});
it.each([null, "not-a-uuid", `${key},${key}`])(
  "rejects missing/malformed intent header %s before storage",
  async (intentKey) => {
    const response = await check({ key: intentKey });
    expect(response.status).toBe(400);
    expect((await response.json()).error.json.data.code).toBe("BAD_REQUEST");
  },
);
it.each([
  { state: "succeeded" },
  { email: "guest@example.test" },
  { paymentId: key },
  {},
])("rejects client supplied payment/identity input %j", async (input) => {
  const response = await check({ input });
  expect(response.status).toBe(400);
});
it("cannot settle through a browser GET or paid URL parameter", async () => {
  const response = await fetch(url + "?paid=1&state=succeeded", {
    headers: { "Idempotency-Key": key },
  });
  expect(response.status).toBe(405);
});
it("rejects a payment-keyed batch instead of applying one key to multiple operations", async () => {
  const response = await check({
    suffix: ",club.reconcileCheckout?batch=1",
    body: JSON.stringify({
      "0": superjson.serialize(undefined),
      "1": superjson.serialize(undefined),
    }),
  });
  expect(response.status).toBe(400);
});
it.each<{ headers: Record<string, string> }>([
  { headers: { Origin: "https://attacker.example" } },
  { headers: { "Sec-Fetch-Site": "cross-site" } },
])("keeps the existing cross-site rejection %j", async ({ headers }) => {
  expect((await check({ headers })).status).toBe(403);
});
