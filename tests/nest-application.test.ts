import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createHmac } from "node:crypto";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";

let application: INestApplication;
let base: string;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("ENABLE_SMS_LOGIN", "false");
  vi.stubEnv("ENABLE_PEN_PALS", "false");
  vi.stubEnv("PRODAMUS_SECRET", "nest-webhook-fixture-secret");
  application = await createBackendApplication();
  expect(application.getHttpServer().listening).toBe(false);
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});

const post = (
  path: string,
  body: string,
  headers: Record<string, string> = {},
) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

it("fails safely without a database for public launch configuration", async () => {
  const response = await fetch(base + "/api/launch-config");
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Запрос недоступен" });
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it.each([
  "https://evil.example",
  "null",
  "https://club.example.test.evil.example",
])(
  "rejects foreign origin %s before a real mutation handler",
  async (origin) => {
    const response = await post("/api/auth/logout", "{}", { Origin: origin });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  },
);
it("preserves credentialed preflight and security response headers", async () => {
  const response = await fetch(base + "/api/health", {
    method: "OPTIONS",
    headers: {
      Origin: "https://club.example.test",
      "Access-Control-Request-Method": "GET",
    },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("access-control-allow-origin")).toBe(
    "https://club.example.test",
  );
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("content-security-policy")).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers.get("x-powered-by")).toBeNull();
});
it("rejects cookie-bearing cross-site simple requests", async () => {
  const response = await post("/api/auth/logout", "a=b", {
    Cookie: "app_session=invalid",
    "Content-Type": "application/x-www-form-urlencoded",
  });
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("preserves native logout and its cookie clearing contract", async () => {
  const response = await post("/api/auth/logout", "{}");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  const cleared = response.headers.get("set-cookie")!;
  expect(cleared).toContain("app_session_id=;");
  expect(cleared).toContain("HttpOnly");
  expect(new Date(cleared.match(/Expires=([^;]+)/)![1]).getTime()).toBeLessThan(
    Date.now(),
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([
  ["/api/auth/login", 17_000],
  ["/api/admin/launch-settings", 270_000],
])("preserves the configured request limit at %s", async (path, size) => {
  const response = await post(path, JSON.stringify({ text: "x".repeat(size) }));
  expect(response.status).toBe(413);
});
it("keeps malformed JSON out of handlers and out of error responses", async () => {
  const response = await post("/api/auth/login", "{SECRET_INVALID_BODY}");
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Некорректный запрос" });
});
it.each([
  "/api/admin/upload-video",
  "/api/trpc/admin.uploadMedia",
  "/api/trpc/profile.uploadAvatar,auth.me",
])(
  "authenticates anonymous uploads at %s before allocating the oversized body",
  async (path) => {
    const response = await post(
      path,
      JSON.stringify({ payload: "x".repeat(300_000) }),
    );
    expect(response.status).toBe(401);
  },
);
it("keeps tRPC public queries, types and protected-role checks reachable", async () => {
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: base + "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
  expect(await client.auth.me.query()).toBeNull();
  await expect(
    client.admin.createPost.mutate({
      text: "Must not save",
      photos: [],
      tags: [],
    }),
  ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED", httpStatus: 401 } });
});
it.each(["POST", "GET"])(
  "preserves PHP-shaped provider payload and HMAC verification for %s",
  async (method) => {
    // Hand-derived canonical payload, independent of the production signing helper.
    const sign = createHmac("sha256", "nest-webhook-fixture-secret")
      .update(
        '{"payment_status":"pending","subscription":{"id":"7","profile_id":"23"}}',
      )
      .digest("hex");
    const body =
      "payment_status=pending&subscription[id]=7&subscription[profile_id]=23";
    const response = await fetch(
      base + "/api/prodamus/webhook" + (method === "GET" ? "?" + body : ""),
      {
        method,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Sign: sign,
          Origin: "https://payform.example.test",
        },
        ...(method === "POST" ? { body } : {}),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ignored");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const rejected = await post("/api/prodamus/webhook", body, {
      Sign: "wrong",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).toBe("signature incorrect");
  },
);
it("does not grant a session on the provider browser return", async () => {
  const response = await fetch(
    base + "/api/prodamus/return?order=club-fixture&paid=1",
    { redirect: "manual" },
  );
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    // Existing provider-return policy falls back to this canonical host.
    "https://daryadarcy.com/club?paid=1",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
});
it.each(["/api/auth/sms/send", "/api/auth/sms/verify"])(
  "preserves disabled-feature policy at %s",
  async (path) => {
    const response = await post(path, "{}");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "FEATURE_DISABLED" });
  },
);
it("returns 404 for an unknown route and releases its listener on close", async () => {
  expect((await fetch(base + "/api/not-a-route")).status).toBe(404);
  const other = await createBackendApplication();
  try {
    await other.listen(0, "127.0.0.1");
    const url = `http://127.0.0.1:${(other.getHttpServer().address() as AddressInfo).port}/api/health`;
    expect((await fetch(url)).status).toBe(200);
    await other.close();
    await expect(fetch(url)).rejects.toThrow();
  } finally {
    await other.close();
  }
});

afterAll(async () => {
  await application?.close();
  vi.unstubAllEnvs();
});

it("serves the existing health and capability contracts through the real application", async () => {
  const health = await fetch(`${base}/api/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({
    ok: true,
    timestamp: expect.any(Number),
  });
  const capabilities = await fetch(`${base}/api/capabilities`);
  expect(capabilities.status).toBe(200);
  expect(capabilities.headers.get("cache-control")).toBe("no-store");
  expect(await capabilities.json()).toEqual({
    smsLogin: false,
    penPals: false,
    shopOnlinePayment: false,
    webPush: false,
  });
});
