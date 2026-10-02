import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import express, { type Request } from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { getSessionCookieOptions } from "../apps/backend/src/_core/cookies";
import {
  registerOAuthRoutes,
  issueSession,
} from "../apps/backend/src/_core/oauth";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";
import { sdk } from "../apps/backend/src/_core/sdk";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { COOKIE_NAME } from "../packages/shared/src/const";

let server: Server;
let base: string;
const user = {
  openId: "cookie-fixture",
  name: "Member",
  sessionVersion: 0,
  blockedAt: null,
};
beforeAll(async () => {
  const app = express();
  registerHttpSecurity(app);
  registerOAuthRoutes(app);
  app.post("/fixture/session", async (req, res) =>
    res.json(
      await issueSession(req, res, user as Parameters<typeof issueSession>[2]),
    ),
  );
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function request(
  hostname: string,
  protocol = "https",
  forwarded?: string,
): Request {
  return {
    hostname,
    protocol,
    headers: forwarded ? { "x-forwarded-proto": forwarded } : {},
  } as Request;
}
function postFromSubdomain(
  path: string,
): Promise<{ status: number; cookies: string[] }> {
  // Node fetch rewrites Host in this runtime; use the actual HTTP client for this fixture.
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      `${base}${path}`,
      { method: "POST", headers: { Host: "api.example.test" } },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({
            status: res.statusCode!,
            cookies: res.headers["set-cookie"] ?? [],
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}
it.each([
  "api.example.test",
  "api.example.co.uk",
  "3000-fixture.manuspre.computer",
])("keeps newly issued cookies host-only on %s", (hostname) => {
  expect(getSessionCookieOptions(request(hostname))).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  expect(getSessionCookieOptions(request(hostname)).domain).toBeUndefined();
});
it("does not trust a raw forwarded-proto header outside Express proxy policy", () => {
  vi.stubEnv("NODE_ENV", "development");
  expect(
    getSessionCookieOptions(request("api.example.test", "http", "https"))
      .secure,
  ).toBe(false);
});
it("never emits an insecure session cookie in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(
    getSessionCookieOptions(request("api.example.test", "http")).secure,
  ).toBe(true);
});
it("expires legacy parent-domain cookies before issuing a host-only cookie", async () => {
  vi.spyOn(sdk, "createSessionToken").mockResolvedValue(
    "LOCAL_SESSION_FIXTURE",
  );
  const response = await postFromSubdomain("/fixture/session");
  expect(response.status).toBe(200);
  const cookies = response.cookies;
  expect(cookies).toHaveLength(2);
  expect(cookies[0]).toContain(`Domain=.example.test`);
  expect(cookies[0]).toContain("Expires=Thu, 01 Jan 1970");
  expect(cookies[0]).not.toContain("LOCAL_SESSION_FIXTURE");
  expect(cookies[1]).toContain(`${COOKIE_NAME}=LOCAL_SESSION_FIXTURE`);
  expect(cookies[1]).not.toContain("Domain=");
  expect(cookies[1]).toContain("HttpOnly");
});
it("both REST and tRPC logout clear current and legacy cookie scopes", async () => {
  const response = await postFromSubdomain("/api/auth/logout");
  const cookies = response.cookies;
  expect(cookies).toHaveLength(2);
  expect(
    cookies.every(
      (value) =>
        value.includes("Expires=Thu, 01 Jan 1970") &&
        !value.includes("Max-Age="),
    ),
  ).toBe(true);
  const clearCookie = vi.fn();
  await appRouter
    .createCaller({
      user: null,
      req: request("api.example.test"),
      res: { clearCookie },
    } as unknown as TrpcContext)
    .auth.logout();
  expect(clearCookie).toHaveBeenCalledTimes(2);
  expect(
    clearCookie.mock.calls.every(([, options]) => !("maxAge" in options)),
  ).toBe(true);
});
it("does not cache auth responses or credential-bearing API responses", async () => {
  vi.spyOn(sdk, "authenticateRequest").mockRejectedValue(
    new Error("Fixture anonymous"),
  );
  const me = await fetch(`${base}/api/auth/me`);
  expect(me.headers.get("cache-control")).toBe("no-store");
  const privateResponse = await fetch(`${base}/api/fixture`, {
    headers: { Authorization: "Bearer LOCAL_SESSION_FIXTURE" },
  });
  expect(privateResponse.headers.get("cache-control")).toBe("no-store");
});
