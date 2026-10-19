import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { User } from "../packages/database/src/schema";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import * as db from "../apps/backend/src/db";

// Real JWT, SDK, Nest and loopback HTTP; faults only at the SQL boundary.
// No database or provider connection, and no production outage is simulated.
const member: User = {
  id: 301,
  openId: "session-availability-fixture",
  name: "Fixture member",
  email: "availability@example.test",
  phone: null,
  passwordHash: "PRIVATE_PASSWORD_HASH_FIXTURE",
  sessionVersion: 4,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  role: "user",
  blockedAt: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastSignedIn: new Date("2026-01-01T00:00:00Z"),
};
let application: INestApplication, base: string, cookie: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("JWT_SECRET", "session-availability-test-only-signing-key");
  vi.stubEnv("PUBLIC_APP_URL", "https://session.example.test");
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
  cookie = `${COOKIE_NAME}=${await sdk.createSessionToken(member.openId, { sessionVersion: 4 })}`;
});
beforeEach(() => {
  vi.spyOn(db, "getUserByOpenId").mockResolvedValue({ ...member });
  vi.spyOn(db, "recordAuthenticatedActivity").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await application?.close();
  vi.unstubAllEnvs();
});
const me = (session = cookie) =>
  fetch(`${base}/api/auth/me`, { headers: session ? { cookie: session } : {} });

it.each(["lookup", "activity"])(
  "returns retryable 503, not a confirmed guest, on a temporary %s failure and recovers with the same cookie",
  async (boundary) => {
    const fault = new Error(
      "SQL PRIVATE_SESSION_SENTINEL availability@example.test",
    );
    if (boundary === "lookup")
      vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(fault);
    else vi.mocked(db.recordAuthenticatedActivity).mockRejectedValueOnce(fault);
    const failed = await me();
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(await failed.json()).toEqual({
      error: "Проверка сессии временно недоступна",
    });
    const recovered = await me();
    expect(recovered.status).toBe(200);
    const body = await recovered.json();
    expect(body.user).toMatchObject({ id: 301, role: "user" });
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(recovered.headers.get("set-cookie")).toBeNull();
  },
);
it("does not mistake an untyped upstream 403 for a confirmed invalid session", async () => {
  vi.mocked(db.getUserByOpenId).mockRejectedValueOnce({ statusCode: 403 });
  const response = await me();
  expect(response.status).toBe(503);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("does not report a missing database as a missing user for a valid JWT", async () => {
  vi.mocked(db.getUserByOpenId).mockRestore();
  const response = await me();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Проверка сессии временно недоступна",
  });
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("does not return a successful null tRPC session on the same lookup failure", async () => {
  vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(
    new Error("PRIVATE_SESSION_SENTINEL"),
  );
  const response = await fetch(`${base}/api/trpc/auth.me`, {
    headers: { cookie },
  });
  // tRPC's existing error formatter maps a context exception to a safe 500.
  expect(response.status).toBe(500);
  expect(response.headers.get("set-cookie")).toBeNull();
  const error = await response.text();
  expect(error).not.toMatch(/PRIVATE_SESSION_SENTINEL|stack|passwordHash/);
  expect(JSON.parse(error).error.json.data.code).toBe("INTERNAL_SERVER_ERROR");
  const recovered = await fetch(`${base}/api/trpc/auth.me`, {
    headers: { cookie },
  });
  expect(recovered.status).toBe(200);
  expect((await recovered.json()).result.data.json.id).toBe(301);
});
it.each(["missing", "malformed", "expired"])(
  "preserves confirmed guest 200/null for a %s session without consulting SQL",
  async (kind) => {
    const session =
      kind === "missing"
        ? ""
        : `${COOKIE_NAME}=${
            kind === "expired"
              ? await sdk.createSessionToken(member.openId, {
                  expiresInMs: -10000,
                })
              : "invalid.jwt"
          }`;
    const response = await me(session);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  },
);
it.each(["deleted", "blocked", "revoked"])(
  "preserves confirmed guest 200/null for a %s account session",
  async (kind) => {
    vi.mocked(db.getUserByOpenId).mockResolvedValueOnce(
      kind === "deleted"
        ? undefined
        : {
            ...member,
            ...(kind === "blocked"
              ? { blockedAt: new Date() }
              : { sessionVersion: 5 }),
          },
    );
    const response = await me();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
    expect(db.recordAuthenticatedActivity).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  },
);
