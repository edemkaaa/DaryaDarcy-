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
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";

// Native HTTP/cookies/JWT. Only persistence-facing service calls are isolated:
// no external mail, payments or operator database can be reached by this suite.
let app: INestApplication, sessions: SessionService, base: string;
const member = {
  id: 4301,
  openId: "public-auth-fixture",
  name: "Fixture",
  email: "auth@example.test",
  role: "user",
  sessionVersion: 0,
  blockedAt: null,
  phone: null,
  passwordHash: null,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date("2026-10-28T10:00:00Z"),
  updatedAt: new Date("2026-10-28T10:00:00Z"),
  lastSignedIn: new Date("2026-10-28T10:00:00Z"),
} satisfies User;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("JWT_SECRET", "public-auth-fixture-only-signing-key");
  vi.stubEnv("ADMIN_TOTP_SECRET", "");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  sessions = app.get(SessionService);
});
beforeEach(() => {
  vi.spyOn(sessions, "register").mockResolvedValue("created");
  vi.spyOn(sessions, "findByEmail").mockResolvedValue(undefined);
  vi.spyOn(sessions, "passwordUser").mockResolvedValue(null);
  vi.spyOn(sessions, "updateUser").mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
const post = (path: string, body: object, ip = "198.51.100.11") =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(body),
  });

it("returns the same accepted registration response for new, pending and existing accounts", async () => {
  const bodies: unknown[] = [];
  for (const outcome of ["created", "pending", "duplicate"] as const) {
    vi.mocked(sessions.register).mockResolvedValueOnce(outcome);
    const response = await post("/api/auth/register", {
      email: "public-registration@example.test",
      consentVersion: EMAIL_REGISTER_CONSENT_VERSION,
    });
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    bodies.push(await response.json());
  }
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[0]).toEqual(bodies[2]);
  expect(bodies[0]).toEqual({ ok: true, message: expect.any(String) });
});

it("keeps infrastructure registration failure distinct from accepted processing", async () => {
  vi.mocked(sessions.register).mockResolvedValueOnce("unavailable");
  const response = await post("/api/auth/register", {
    email: "unavailable@example.test",
    consentVersion: EMAIL_REGISTER_CONSENT_VERSION,
  });
  expect(response.status).toBe(503);
  expect(await response.json()).not.toHaveProperty("ok", true);
});

it("issues the session only in an HttpOnly cookie and returns just the public profile", async () => {
  vi.mocked(sessions.findByEmail).mockResolvedValueOnce(member);
  vi.mocked(sessions.passwordUser).mockResolvedValueOnce(member);
  const response = await post("/api/auth/login", {
    email: member.email,
    password: "fixture-password",
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Object.keys(data)).toEqual(["user"]);
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${COOKIE_NAME}=`))!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).not.toContain("Domain=");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const token = decodeURIComponent(
    cookie.split(";")[0].slice(COOKIE_NAME.length + 1),
  );
  expect(await sdk.verifySession(token)).toMatchObject({
    openId: member.openId,
    sessionVersion: 0,
  });
});

it("throttles one normalized account across different IPs before checking another password", async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await post(
      "/api/auth/login",
      {
        email:
          attempt % 2 ? "  ROTATED@example.test  " : "rotated@example.test",
        password: "wrong",
      },
      `198.51.100.${50 + attempt}`,
    );
    expect(response.status).toBe(401);
  }
  const denied = await post(
    "/api/auth/login",
    { email: "rotated@example.test", password: "wrong" },
    "198.51.100.99",
  );
  expect(denied.status).toBe(429);
  expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(await denied.json()).toMatchObject({
    retryAfterSec: expect.any(Number),
  });
  expect(denied.headers.get("set-cookie")).toBeNull();
  expect(sessions.passwordUser).toHaveBeenCalledTimes(5);
  expect(
    (
      await post(
        "/api/auth/login",
        { email: "other@example.test", password: "wrong" },
        "198.51.100.99",
      )
    ).status,
  ).toBe(401);
});

it("retains the IP quota when an attacker rotates accounts", async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    expect(
      (
        await post(
          "/api/auth/login",
          {
            email: `spray-${attempt}@example.test`,
            password: "wrong",
          },
          "198.51.100.100",
        )
      ).status,
    ).toBe(401);
  }
  const denied = await post(
    "/api/auth/login",
    { email: "spray-next@example.test", password: "wrong" },
    "198.51.100.100",
  );
  expect(denied.status).toBe(429);
  expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(sessions.passwordUser).toHaveBeenCalledTimes(20);
});

it("reserves quota before concurrent password checks complete", async () => {
  let release!: () => void,
    arrived!: () => void,
    count = 0;
  const allAdmitted = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(sessions.passwordUser).mockImplementation(async () => {
    if (++count === 5) arrived();
    await held;
    return null;
  });
  const pending = Array.from({ length: 5 }, (_, i) =>
    post(
      "/api/auth/login",
      {
        email: "parallel@example.test",
        password: "wrong",
      },
      `203.0.113.${i + 1}`,
    ),
  );
  try {
    await allAdmitted;
    expect(
      (
        await post(
          "/api/auth/login",
          { email: "parallel@example.test", password: "wrong" },
          "203.0.113.6",
        )
      ).status,
    ).toBe(429);
    expect(count).toBe(5);
  } finally {
    release();
    for (const response of await Promise.all(pending))
      expect(response.status).toBe(401);
  }
});

it("does not penalize completed successful sign-ins", async () => {
  vi.mocked(sessions.findByEmail).mockResolvedValue(member);
  vi.mocked(sessions.passwordUser).mockResolvedValue(member);
  for (let i = 0; i < 7; i++) {
    const response = await post(
      "/api/auth/login",
      { email: "successful@example.test", password: "correct" },
      "203.0.113.70",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("sessionToken");
  }
});
