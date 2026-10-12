import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import axios from "axios";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Real SDK and installed Axios, with synthetic credentials and owned loopback
// HTTP only. This checks compatibility, not an external OAuth acceptance run.
describe("legacy OAuth HTTP dependency compatibility", () => {
  let server: Server;
  let sdk: typeof import("../apps/backend/src/_core/sdk").sdk;
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  let refuse = false;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        requests.push({
          path: req.url!,
          method: req.method!,
          body: JSON.parse(body),
        });
        res.setHeader("Content-Type", "application/json");
        if (refuse) {
          res.writeHead(502).end('{"error":"fixture upstream unavailable"}');
        } else if (req.url?.endsWith("/ExchangeToken")) {
          res.end(
            JSON.stringify({
              accessToken: "fixture-access",
              tokenType: "Bearer",
              expiresIn: 60,
              scope: "profile",
              idToken: "fixture-id",
            }),
          );
        } else {
          res.end(
            JSON.stringify({
              openId: "fixture-oauth-user",
              projectId: "fixture-app",
              name: "Fixture",
              email: null,
              platforms: ["REGISTERED_PLATFORM_EMAIL"],
            }),
          );
        }
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    vi.stubEnv(
      "OAUTH_SERVER_URL",
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    );
    vi.stubEnv("VITE_APP_ID", "fixture-app");
    // Never inherit a workstation proxy for this owned wire.
    for (const name of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "ALL_PROXY",
      "http_proxy",
      "https_proxy",
      "all_proxy",
    ])
      vi.stubEnv(name, "");
    vi.stubEnv("NO_PROXY", "*");
    vi.stubEnv("no_proxy", "*");
    ({ sdk } = await import("../apps/backend/src/_core/sdk"));
  });

  afterAll(async () => {
    server?.closeAllConnections();
    if (server)
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    vi.unstubAllEnvs();
  });

  it("preserves the three JSON POST contracts and normalized login method", async () => {
    const token = await sdk.exchangeCodeForToken(
      "fixture-code",
      btoa("https://callback.example.invalid/auth"),
    );
    expect(token).toEqual({
      accessToken: "fixture-access",
      tokenType: "Bearer",
      expiresIn: 60,
      scope: "profile",
      idToken: "fixture-id",
    });
    for (const user of [
      await sdk.getUserInfo(token.accessToken),
      await sdk.getUserInfoWithJwt("fixture-jwt"),
    ]) {
      expect(user).toMatchObject({
        openId: "fixture-oauth-user",
        projectId: "fixture-app",
        email: null,
        platform: "email",
        loginMethod: "email",
      });
    }
    expect(requests).toEqual([
      {
        path: "/webdev.v1.WebDevAuthPublicService/ExchangeToken",
        method: "POST",
        body: {
          clientId: "fixture-app",
          grantType: "authorization_code",
          code: "fixture-code",
          redirectUri: "https://callback.example.invalid/auth",
        },
      },
      {
        path: "/webdev.v1.WebDevAuthPublicService/GetUserInfo",
        method: "POST",
        body: { accessToken: "fixture-access" },
      },
      {
        path: "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt",
        method: "POST",
        body: { jwtToken: "fixture-jwt", projectId: "fixture-app" },
      },
    ]);
  });

  it("rejects an upstream HTTP failure instead of returning a user", async () => {
    refuse = true;
    try {
      await expect(sdk.getUserInfo("fixture-access")).rejects.toMatchObject({
        response: { status: 502 },
      });
    } finally {
      refuse = false;
    }
  });
});

it("enforces the explicit fetch response limit on a bounded data URI", async () => {
  // GHSA-777c-7fjr-54vf characterization: default SDK uses HTTP, not fetch.
  // Downgrading Axios silently accepts 64 bytes despite this 16-byte limit.
  await expect(
    axios.get(
      `data:text/plain;base64,${Buffer.from("x".repeat(64)).toString("base64")}`,
      {
        adapter: "fetch",
        maxContentLength: 16,
        timeout: 1000,
      },
    ),
  ).rejects.toMatchObject({ code: "ERR_BAD_RESPONSE" });
});
