import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";

let server: Server;
let base: string;
const navigation = {
  "Sec-Fetch-Site": "cross-site",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
};

// Node fetch overwrites Sec-Fetch-Mode with cors, unlike a document navigation.
function request(
  path: string,
  options: { method?: string; headers: Record<string, string> },
) {
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = httpRequest(base + path, options, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () =>
        resolve({
          status: response.statusCode!,
          headers: response.headers,
          body,
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  const app = express();
  registerHttpSecurity(app);
  // Any request reaching the handler succeeds, so refusals prove the policy
  // blocked it rather than merely missing an Express route.
  app.use((_req, res) => res.json({ reachedHandler: true }));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

describe("email binding document navigation boundary", () => {
  it.each(["/api/auth/email-binding", "/api/auth/email-binding/"])(
    "allows a top-level GET from webmail to %s without CORS permission",
    async (path) => {
      const response = await request(path, { headers: navigation });
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ reachedHandler: true });
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(
        response.headers["access-control-allow-credentials"],
      ).toBeUndefined();
    },
  );

  it.each([
    { method: "POST", path: "/api/auth/email-binding", headers: navigation },
    { method: "HEAD", path: "/api/auth/email-binding", headers: navigation },
    {
      method: "GET",
      path: "/api/auth/email-binding",
      headers: { ...navigation, "Sec-Fetch-Mode": "cors" },
    },
    {
      method: "GET",
      path: "/api/auth/email-binding",
      headers: { ...navigation, "Sec-Fetch-Dest": "iframe" },
    },
    {
      method: "GET",
      path: "/api/auth/email-binding",
      headers: { "Sec-Fetch-Site": "cross-site" },
    },
    {
      method: "GET",
      path: "/api/auth/email-binding/confirm",
      headers: navigation,
    },
    {
      method: "POST",
      path: "/api/auth/email-bindings/confirm",
      headers: navigation,
    },
    {
      method: "GET",
      path: "/api/admin/member-email-bindings",
      headers: navigation,
    },
    {
      method: "GET",
      path: "/api/auth/email-binding-extra",
      headers: navigation,
    },
    {
      method: "GET",
      path: "/api/auth/email-binding",
      headers: { ...navigation, Origin: "https://foreign.example.test" },
    },
  ])(
    "rejects non-authorized navigation $method $path $headers",
    async (options) => {
      const response = await request(options.path, options);
      expect(response.status).toBe(403);
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    },
  );
});
