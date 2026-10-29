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
import type { Request, Response } from "express";
import type { User } from "../packages/database/src/schema";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { createContext } from "../apps/backend/src/_core/context";
import * as db from "../apps/backend/src/db";

// Real JWT, SDK, Nest and loopback HTTP; faults only at the SQL boundary.
// No database or provider connection, and no production outage is simulated.
const member: User = {
  id: 301,
  openId: "session-availability-fixture",
  name: "Fixture member",
  email: "availability@example.test",
  phone: null, contactPhone: null,
  passwordHash: "PRIVATE_PASSWORD_HASH_FIXTURE",
  sessionVersion: 4, profileRevision: 0,
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
  vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
  vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "true");
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
const exchange = (token = cookie.slice(COOKIE_NAME.length + 1)) =>
  fetch(`${base}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: "{}",
  });
const legacyContext = (session = cookie) =>
  createContext({
    req: { headers: session ? { cookie: session } : {} } as Request,
    res: {} as Response,
    info: {} as Parameters<typeof createContext>[0]["info"],
  });
const upload = (path: string) =>
  fetch(base + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cookie.slice(COOKIE_NAME.length + 1)}`,
      "Content-Type": "video/mp4",
      "Idempotency-Key": "00000000-0000-4000-8000-000000000301",
    },
    body: "x",
  });

it.each([
  "/api/trpc/admin.uploadPhoto",
  "/api/admin/private-video-uploads?filename=fixture.mp4",
].flatMap(path => ["lookup", "activity", "untyped-denial"].map(boundary => ({ path, boundary }))))(
  "keeps an ingress $boundary failure at $path distinct from invalid authentication",
  async ({ path, boundary }) => {
    const fault = boundary === "untyped-denial"
      ? { statusCode: 403 }
      : new Error("PRIVATE_UPLOAD_SESSION_SENTINEL");
    if (boundary === "activity")
      vi.mocked(db.recordAuthenticatedActivity).mockRejectedValueOnce(fault);
    else vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(fault);
    const response = await upload(path);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).not.toMatch(/PRIVATE_UPLOAD_SESSION_SENTINEL|stack|passwordHash/);
  },
);
it.each([
  "/api/admin/private-video-uploads?filename=fixture.mp4",
].flatMap(path => ["lookup", "activity"].map(boundary => ({ path, boundary }))))(
  "keeps a second $boundary check failure at $path distinct from invalid authentication",
  async ({ path, boundary }) => {
    const administrator = { ...member, role: "admin" as const };
    vi.mocked(db.getUserByOpenId).mockResolvedValue(administrator);
    const fault = new Error("PRIVATE_SECOND_SESSION_SENTINEL");
    if (boundary === "lookup") {
      vi.mocked(db.getUserByOpenId)
        .mockResolvedValueOnce(administrator)
        .mockRejectedValueOnce(fault);
    } else {
      vi.mocked(db.recordAuthenticatedActivity)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(fault);
    }
    const response = await upload(path);
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).not.toMatch(/PRIVATE_SECOND_SESSION_SENTINEL|stack|passwordHash/);
  },
);
it.each([
  "/api/admin/private-video-uploads?filename=fixture.mp4",
].flatMap(path => ["blocked", "revoked", "role"].map(change => ({ path, change }))))(
  "still rejects an account changed by $change after body admission at $path",
  async ({ path, change }) => {
    vi.mocked(db.getUserByOpenId)
      .mockResolvedValueOnce({ ...member, role: "admin" })
      .mockResolvedValueOnce({
        ...member,
        role: change === "role" ? "user" : "admin",
        blockedAt: change === "blocked" ? new Date() : null,
        sessionVersion: change === "revoked" ? 5 : 4,
      });
    const response = await upload(path);
    expect(response.status).toBe(change === "role" ? 403 : 401);
    expect(response.headers.get("set-cookie")).toBeNull();
  },
);

it.each(["lookup", "activity"])(
  "does not reject a valid Bearer token as invalid on a temporary %s failure",
  async (boundary) => {
    const fault = new Error("PRIVATE_SESSION_EXCHANGE_SENTINEL");
    if (boundary === "lookup")
      vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(fault);
    else vi.mocked(db.recordAuthenticatedActivity).mockRejectedValueOnce(fault);
    const failed = await exchange();
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(await failed.json()).toEqual({
      error: "Проверка сессии временно недоступна",
    });

    const recovered = await exchange();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({
      success: true,
      user: { id: 301 },
    });
    expect(recovered.headers.get("set-cookie")).toContain(`${COOKIE_NAME}=`);
  },
);
it("keeps an invalid Bearer token unauthorized without setting a cookie", async () => {
  const response = await exchange("invalid.jwt");
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "Invalid token" });
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(db.getUserByOpenId).not.toHaveBeenCalled();
});
it.each(["lookup", "activity", "untyped-denial"])(
  "does not turn a legacy tRPC %s failure into a guest and recovers with the same cookie",
  async (boundary) => {
    const fault = boundary === "untyped-denial"
      ? { statusCode: 403 }
      : new Error("PRIVATE_LEGACY_SESSION_SENTINEL");
    if (boundary === "activity")
      vi.mocked(db.recordAuthenticatedActivity).mockRejectedValueOnce(fault);
    else vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(fault);
    await expect(legacyContext()).rejects.toMatchObject({ status: 503 });
    expect((await legacyContext()).user?.id).toBe(301);
  },
);
it.each(["", `${COOKIE_NAME}=invalid.jwt`])(
  "preserves a confirmed legacy guest for %s",
  async (session) => {
    expect((await legacyContext(session)).user).toBeNull();
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
  },
);

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
it.each(["lookup", "activity", "untyped-denial"])("does not return a successful null tRPC session on a %s failure", async (boundary) => {
  const fault = boundary === "untyped-denial"
    ? { statusCode: 403 }
    : new Error("PRIVATE_SESSION_SENTINEL");
  if (boundary === "activity")
    vi.mocked(db.recordAuthenticatedActivity).mockRejectedValueOnce(fault);
  else vi.mocked(db.getUserByOpenId).mockRejectedValueOnce(fault);
  const response = await fetch(`${base}/api/trpc/auth.me`, {
    headers: { cookie },
  });
  // tRPC's existing error formatter maps a context exception to a safe 500.
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
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
