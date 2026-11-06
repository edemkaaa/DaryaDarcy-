import { afterEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { AppRouter } from "../apps/backend/src/routers";
import type { User } from "../packages/database/src/schema";

const apps: INestApplication[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function member(id: number): User {
  return {
    id,
    openId: `auth-composition-${id}`,
    name: null,
    email: null,
    phone: null,
    contactPhone: null,
    passwordHash: null,
    sessionVersion: 2,
    profileRevision: 0,
    loginMethod: "email",
    gender: null,
    avatarUrl: null,
    role: "user",
    blockedAt: null,
    blockedReason: null,
    accountDeletionRequestedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

async function application(actor: User, unavailable = false) {
  vi.stubEnv("DATABASE_URL", "");
  const app = await createBackendApplication();
  apps.push(app);
  const sessions = app.get(SessionService);
  // Authentication/storage are the boundaries. Keep HTTP security, tRPC,
  // auth router, public response formatting and cookie handling real.
  vi.spyOn(sessions, "optionalUser").mockResolvedValue(actor);
  vi.spyOn(sessions, "revokeSessions").mockImplementation(async (current) => {
    if (current !== actor) throw new Error("Wrong application's actor");
    if (unavailable)
      throw new ServiceUnavailableException("PRIVATE_AUTH_FIXTURE");
  });
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const received: { status: number; cookie: string | null; body: string }[] =
    [];
  const client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: base + "/api/trpc",
        transformer: superjson,
        fetch: async (url, options) => {
          const response = await fetch(url, options);
          received.push({
            status: response.status,
            cookie: response.headers.get("set-cookie"),
            body: await response.clone().text(),
          });
          return response;
        },
      }),
    ],
  });
  return { client, received };
}

it("tRPC logout uses the same app-owned session boundary as its verified actor", async () => {
  const first = await application(member(11));
  const second = await application(member(12));

  // Configure both apps before either request, exposing accidental shared state.
  for (const { client, received } of [first, second]) {
    await expect(client.auth.logout.mutate()).resolves.toEqual({
      success: true,
    });
    expect(received[0].status).toBe(200);
    expect(received[0].cookie).toContain("app_session_id=;");
    expect(received[0].cookie).toContain("HttpOnly");
  }
});

it("a refusal from one app does not clear its cookie or prevent logout in the other", async () => {
  const failing = await application(member(21), true);
  const working = await application(member(22));

  await expect(failing.client.auth.logout.mutate()).rejects.toMatchObject({
    data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 },
  });
  expect(failing.received[0].cookie).toBeNull();
  expect(failing.received[0].body).not.toContain("PRIVATE_AUTH_FIXTURE");
  await expect(working.client.auth.logout.mutate()).resolves.toEqual({
    success: true,
  });
  expect(working.received[0].status).toBe(200);
});
