import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createProdamusSandboxApplication } from "../apps/backend/src/billing/prodamus-sandbox.application";

const path = "/api/prodamus/sandbox/webhook";
const raw =
  '{"currency":"rub","customer_email":"prodamus-demo@example.test","demo_mode":"1","domain":"testpage1.payform.ru","order_id":"300155","order_num":"dd-demo-83be933e-a277-41f3-801d-45771c12b051","payment_status":"success","sum":"790.00"}';
const sign = createHmac("sha256", "a".repeat(64)).update(raw).digest("hex");
let enabled: INestApplication;
let disabled: INestApplication;
let base: string;
let offBase: string;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
  vi.stubEnv("PRODAMUS_SANDBOX_ENABLED", "true");
  vi.stubEnv("PRODAMUS_SANDBOX_SECRET", "a".repeat(64));
  vi.stubEnv("PRODAMUS_SANDBOX_SYS", "daryadarcy");
  vi.stubEnv("PRODAMUS_SANDBOX_DEMO_SIGN", "false");
  vi.stubEnv("PRODAMUS_SANDBOX_PAYFORM_URL", "https://testpage1.payform.ru");
  vi.stubEnv(
    "PRODAMUS_SANDBOX_ORDER_ID",
    "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
  );
  enabled = await createProdamusSandboxApplication();
  await enabled.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(enabled.getHttpServer().address() as AddressInfo).port}`;
  vi.stubEnv("PRODAMUS_SANDBOX_ENABLED", "false");
  disabled = await createProdamusSandboxApplication();
  await disabled.listen(0, "127.0.0.1");
  offBase = `http://127.0.0.1:${(disabled.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async () => {
  await enabled?.close();
  await disabled?.close();
  vi.unstubAllEnvs();
});
function notify(body = raw, headers = {}, origin = base, route = path) {
  return fetch(origin + route, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", Sign: sign, ...headers },
  });
}

it("verifies a raw notification without a session or access claim", async () => {
  const response = await notify();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    mode: "demo",
    accessGranted: false,
    notificationVerified: true,
    paymentStatus: "success",
  });
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-powered-by")).toBeNull();
  expect(response.headers.get("content-security-policy")).toContain(
    "default-src 'none'",
  );
});
it("keeps disabled composition independent of the enabled instance", async () => {
  const response = await notify(raw, {}, offBase);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("a".repeat(64));
  expect((await notify()).status).toBe(200);
});
it("preserves signed form bytes through standalone composition", async () => {
  const form =
    "currency=rub&customer_email=prodamus-demo%40example.test&demo_mode=1&domain=testpage1.payform.ru&order_id=300155&order_num=dd-demo-83be933e-a277-41f3-801d-45771c12b051&payment_status=success&sum=790.00";
  expect(
    (
      await notify(form, {
        "Content-Type": "application/x-www-form-urlencoded",
      })
    ).status,
  ).toBe(200);
});
it("does not acknowledge a modified notification", async () => {
  expect((await notify(raw.replace("790.00", "1.00"))).status).toBe(400);
});
it("rejects oversized input with a generic response", async () => {
  const response = await notify("PRIVATE_BODY" + "x".repeat(65_536));
  expect(response.status).toBe(413);
  expect(await response.text()).toBe(
    '{"error":"Invalid sandbox notification"}',
  );
});
it.each([
  "/api/prodamus/webhook",
  "/api/prodamus/return",
  "/api/auth/password",
  "/api/trpc/club.createCheckout",
  "/api/launch-config",
  "/health",
  "/api/prodamus/sandbox/webhook/",
  "/API/prodamus/sandbox/webhook",
])("does not expose %s from the isolated listener", async (route) => {
  const response = await notify(raw, {}, base, route);
  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("rejects GET as proof even with a signature", async () => {
  expect((await fetch(base + path, { headers: { Sign: sign } })).status).toBe(
    404,
  );
});
it("preserves browser-origin rejection", async () => {
  expect((await notify(raw, { Origin: "https://evil.test" })).status).toBe(403);
});
it("rejects browser cookies and query additions", async () => {
  expect((await notify(raw, { Cookie: "session=synthetic" })).status).toBe(400);
  expect((await notify(raw, {}, base, path + "?paid=1")).status).toBe(400);
});
