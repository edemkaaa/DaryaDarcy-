import { afterEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { User } from "../packages/database/src/schema";

const apps: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("each app checks its own session before parsing an upload body", async () => {
  vi.stubEnv("DATABASE_URL", "");
  for (const [role, expected] of [
    [null, 401],
    ["user", 403],
    ["admin", 400],
  ] as const) {
    const app = await createBackendApplication();
    apps.push(app);
    const sessions = app.get(SessionService);
    vi.spyOn(sessions, "optionalUser").mockImplementation(async (request) => {
      expect(request.body).toBeUndefined();
      return role === null ? null : ({ id: 1, role, blockedAt: null } as User);
    });
    await app.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const response = await fetch(base + "/api/trpc/admin.uploadPublicCover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{" + "x".repeat(300_000),
    });
    // Guest/member denial precedes malformed JSON; only admin reaches parser.
    expect(response.status).toBe(expected);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  }
});

it("an app-owned session failure at upload admission stays unavailable without parsing or leaking details", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const app = await createBackendApplication();
  apps.push(app);
  vi.spyOn(app.get(SessionService), "optionalUser").mockImplementation(
    async (request) => {
      expect(request.body).toBeUndefined();
      throw new Error("PRIVATE_INGRESS_FIXTURE");
    },
  );
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  const response = await fetch(
    `http://127.0.0.1:${port}/api/trpc/admin.uploadPublicCover`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{" + "x".repeat(300_000),
    },
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_INGRESS_FIXTURE");
  expect(response.headers.get("set-cookie")).toBeNull();
});
