import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";

let app: INestApplication;
let base: string;
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
    ],
  });
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
it.each([
  ["GET", "/api/launch-config"],
  ["POST", "/api/prodamus/webhook"],
  ["POST", "/api/trpc/profile.update"],
  ["POST", "/api/trpc/club.createCheckout,profile.update"],
  ["POST", "/api/auth/register"],
  ["GET", "/api/trpc/club.createCheckout"],
])(
  "restricted runtime refuses %s %s before unrelated application handlers",
  async (method, path) => {
    const response = await fetch(base + path, { method });
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  },
);
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
