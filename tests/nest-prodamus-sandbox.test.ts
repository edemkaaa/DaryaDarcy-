import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import * as db from "../apps/backend/src/db";
import * as access from "../apps/backend/src/identity/access";

const secret = "a".repeat(64);
const liveKey = "b".repeat(64);
const raw =
  '{"currency":"rub","customer_email":"prodamus-demo@example.test","demo_mode":"1","domain":"testpage1.payform.ru","order_id":"300155","order_num":"dd-demo-83be933e-a277-41f3-801d-45771c12b051","payment_status":"success","sum":"790.00"}';
const signature = createHmac("sha256", secret).update(raw).digest("hex");
let enabled: INestApplication;
let disabled: INestApplication;
let enabledBase: string;
let disabledBase: string;
let settlement: ReturnType<typeof vi.spyOn>;
let mail: ReturnType<typeof vi.spyOn>;
const path = "/api/prodamus/sandbox/webhook";
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("PRODAMUS_SECRET", liveKey);
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
  vi.stubEnv("PRODAMUS_SANDBOX_ENABLED", "true");
  vi.stubEnv("PRODAMUS_SANDBOX_SECRET", secret);
  vi.stubEnv(
    "PRODAMUS_SANDBOX_ORDER_ID",
    "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
  );
  vi.stubEnv("PRODAMUS_SANDBOX_PAYFORM_URL", "https://testpage1.payform.ru");
  vi.stubEnv("PRODAMUS_SANDBOX_SYS", "daryadarcy");
  vi.stubEnv("PRODAMUS_SANDBOX_DEMO_SIGN", "false");
  // Tripwires at external effects, not mocks of the protocol being tested.
  settlement = vi.spyOn(db, "settleClubPayment");
  mail = vi.spyOn(access, "queueAccessEmail");
  enabled = await createBackendApplication();
  await enabled.listen(0, "127.0.0.1");
  enabledBase = `http://127.0.0.1:${(enabled.getHttpServer().address() as AddressInfo).port}`;
  vi.stubEnv("PRODAMUS_SANDBOX_ENABLED", "false");
  disabled = await createBackendApplication();
  await disabled.listen(0, "127.0.0.1");
  disabledBase = `http://127.0.0.1:${(disabled.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async () => {
  await enabled?.close();
  await disabled?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function notify(base = enabledBase, body = raw, extraHeaders = {}) {
  return fetch(base + path, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      Sign: signature,
      ...extraHeaders,
    },
  });
}
it("keeps the diagnostic opt-in isolated per application instance", async () => {
  const off = await notify(disabledBase);
  expect(off.status).toBe(503);
  expect(await off.text()).not.toContain(secret);
  const on = await notify();
  expect(on.status).toBe(200);
  expect(await on.json()).toEqual({
    mode: "demo",
    accessGranted: false,
    notificationVerified: true,
    paymentStatus: "success",
  });
  expect(on.headers.get("cache-control")).toBe("no-store");
  expect(on.headers.get("set-cookie")).toBeNull();
});
it("accepts PHP form bytes without the generic form parser changing nested/signature data", async () => {
  const form =
    "currency=rub&customer_email=prodamus-demo%40example.test&demo_mode=1&domain=testpage1.payform.ru&order_id=300155&order_num=dd-demo-83be933e-a277-41f3-801d-45771c12b051&payment_status=success&sum=790.00";
  const response = await notify(enabledBase, form, {
    "Content-Type": "application/x-www-form-urlencoded",
  });
  expect(response.status).toBe(200);
  expect((await response.json()).accessGranted).toBe(false);
});
it("acknowledges replay only as a stateless diagnostic", async () => {
  for (let i = 0; i < 2; i++) {
    const response = await notify();
    expect(response.status).toBe(200);
    expect((await response.json()).accessGranted).toBe(false);
  }
});
it("rejects a payload changed after signing", async () => {
  const response = await notify(enabledBase, raw.replace('"790.00"', '"1.00"'));
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain("order_num");
});
it("does not fall back to the live merchant's configured secret", async () => {
  const response = await notify(enabledBase, raw, {
    Sign: createHmac("sha256", liveKey).update(raw).digest("hex"),
  });
  expect(response.status).toBe(400);
});
it("refuses browser session cookies at the diagnostic receiver", async () => {
  const response = await notify(enabledBase, raw, {
    Cookie: "session=synthetic",
  });
  expect(response.status).toBe(400);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("rejects query additions instead of silently excluding them from the diagnostic proof", async () => {
  const response = await fetch(enabledBase + path + "?demo_mode=0", {
    method: "POST",
    body: raw,
    headers: { "Content-Type": "application/json", Sign: signature },
  });
  expect(response.status).toBe(400);
});
it.each(["text/plain", "application/octet-stream"])(
  "does not parse unsupported content type %s",
  async (contentType) => {
    const response = await notify(enabledBase, raw, {
      "Content-Type": contentType,
    });
    expect(response.status).toBe(415);
  },
);
it("rejects oversized bytes without echoing body or stack", async () => {
  const response = await notify(
    enabledBase,
    "PRIVATE_SANDBOX_BODY" + "x".repeat(65_536),
  );
  expect(response.status).toBe(413);
  const text = await response.text();
  expect(text).not.toContain("PRIVATE_SANDBOX_BODY");
  expect(text).not.toContain("Error:");
});
it("does not relax browser origin security for the new diagnostic", async () => {
  const response = await notify(enabledBase, raw, {
    Origin: "https://evil.test",
  });
  expect(response.status).toBe(403);
});
it("never accepts GET/browser navigation as a signed payment", async () => {
  const response = await fetch(
    enabledBase + path + "?paid=1&" + new URLSearchParams(JSON.parse(raw)),
    { headers: { Sign: signature } },
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("still rejects an ordinary-key demo at the production webhook", async () => {
  const response = await fetch(enabledBase + "/api/prodamus/webhook", {
    method: "POST",
    body: raw,
    headers: {
      "Content-Type": "application/json",
      Sign: createHmac("sha256", liveKey).update(raw).digest("hex"),
    },
  });
  expect(response.status).toBe(400);
});
it("has not dispatched settlement or queued mail across diagnostic acceptance and rejection", () => {
  expect(settlement).not.toHaveBeenCalled();
  expect(mail).not.toHaveBeenCalled();
});
