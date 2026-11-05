import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { User } from "../packages/database/src/schema";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import * as capabilities from "../apps/backend/src/launch/capabilities";
import * as db from "../apps/backend/src/db";

// Real HTTP/router/validation/limiter; only session lookup and SQL write are
// doubled. The shipped capability remains false; enabled-path tests replace
// only that policy boundary, never add a production enable switch.
describe("push registration admission", () => {
  let app: INestApplication;
  let base: string;
  let actor: User | null;
  let writes: unknown[][];
  let clock = Date.now();
  const token = "ExponentPushToken[synthetic-device_1]";
  const input = { token, platform: "ios" };
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    clock += 16 * 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    actor = null;
    writes = [];
    vi.spyOn(app.get(SessionService), "optionalUser").mockImplementation(
      async () => actor,
    );
    vi.spyOn(db, "registerPushToken").mockImplementation(async (...args) => {
      writes.push(args);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });
  function enabled() {
    vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
  }
  function request(body: unknown = input, forwarded = "198.51.100.70") {
    return fetch(`${base}/api/trpc/notifications.registerToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": forwarded,
      },
      body: JSON.stringify({ json: body }),
    });
  }
  it.each([null, { id: 98601, role: "user" }, { id: 98602, role: "admin" }])(
    "refuses a valid token while disabled, including staff (%j)",
    async (user) => {
      actor = user as User | null;
      expect((await request()).status).toBe(403);
      expect(writes).toEqual([]);
    },
  );
  it("also refuses direct service registration while disabled", async () => {
    await expect(
      app.get(NotificationsService).registerToken(input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toEqual([]);
  });
  it("does not spend the future enabled quota on disabled attempts", async () => {
    for (let i = 0; i < 35; i++) expect((await request()).status).toBe(403);
    enabled();
    expect((await request()).status).toBe(200);
    expect(writes).toHaveLength(1);
  });
  it.each([
    { token: "" },
    { token: "   " },
    { token: "arbitrary-device" },
    { token: "https://example.test/push" },
    { token: "ExpoPushToken[]" },
    { token: "ExpoPushToken[with spaces]" },
    { token: "ExpoPushToken[bad]\n" },
    { token: `ExpoPushToken[${"a".repeat(243)}]` },
    { token, platform: "windows" },
    { token, platform: "a".repeat(17) },
    { token, platform: " ios " },
    { token: 123 },
  ])(
    "rejects malformed/oversized input before persistence (%j)",
    async (body) => {
      enabled();
      expect((await request(body)).status).toBe(400);
      expect(writes).toEqual([]);
    },
  );
  it.each(["ExpoPushToken", "ExponentPushToken"])(
    "accepts bounded %s without accepting client ownership",
    async (prefix) => {
      enabled();
      const sessionActor = { id: 98601, openId: "push-test-user", sessionVersion: 3 };
      actor = sessionActor as User;
      const value = `${prefix}[synthetic-device_2]`;
      expect(
        (await request({ token: value, platform: "android", userId: 98602 }))
          .status,
      ).toBe(200);
      expect(writes).toEqual([[value, sessionActor, "android"]]);
    },
  );
  it.each(["ExpoPushToken", "ExponentPushToken"])(
    "accepts exactly 256 characters for %s and refuses 257",
    async (prefix) => {
      enabled();
      const value = `${prefix}[${"a".repeat(254 - prefix.length)}]`;
      expect(value).toHaveLength(256);
      expect((await request({ token: value })).status).toBe(200);
      expect((await request({ token: value.replace("]", "a]") })).status).toBe(
        400,
      );
      expect(writes).toHaveLength(1);
    },
  );
  it("retains optional platform and anonymous registration only behind the capability", async () => {
    enabled();
    expect((await request({ token })).status).toBe(200);
    expect(writes).toEqual([[token, undefined, undefined]]);
  });
  it.each([
    "12345678-90ab-cdef-1234-567890abcdef",
    "ExpoPushToken[opaque+/value=]",
  ])("preserves supported legacy/opaque Expo token %s", async (value) => {
    enabled();
    expect((await request({ token: value })).status).toBe(200);
    expect(writes).toEqual([[value, undefined, undefined]]);
  });
  it("caps requests per resolved IP, including malformed attempts and spoofed leftmost forwarding", async () => {
    enabled();
    for (let i = 0; i < 30; i++)
      expect(
        (
          await request(
            { token: "invalid" },
            `203.0.113.${i + 1}, 198.51.100.70`,
          )
        ).status,
      ).toBe(400);
    const blocked = await request();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect(writes).toEqual([]);
    const error = await blocked.text();
    expect(error).not.toContain(token);
    expect(error).not.toContain("stack");
    expect((await request(input, "198.51.100.71")).status).toBe(200);
    clock += 899_001;
    const stillBlocked = await request();
    expect(stillBlocked.status).toBe(429);
    expect(stillBlocked.headers.get("retry-after")).toBe("1");
    clock += 999;
    expect((await request()).status).toBe(200);
  });
  it("caps an account across IP changes without charging another account", async () => {
    enabled();
    actor = { id: 98601 } as User;
    for (let i = 0; i < 10; i++)
      expect((await request(input, `198.51.100.${i + 1}`)).status).toBe(200);
    const blocked = await request(input, "198.51.100.40");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("900");
    expect(writes).toHaveLength(10);
    actor = { id: 98602 } as User;
    expect((await request(input, "198.51.100.41")).status).toBe(200);
  });
  it("counts every batch member before any asynchronous write", async () => {
    enabled();
    const results: Array<{
      error?: { json: { data: { code: string } } };
    }> = [];
    // Exercise forty admissions without violating the shared twenty-item
    // pre-parser gate; the per-IP quota must span both allowed HTTP batches.
    for (let batch = 0; batch < 2; batch++) {
      const body = Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [String(i), { json: input }]),
      );
      const response = await fetch(
        `${base}/api/trpc/${Array(20).fill("notifications.registerToken").join(",")}?batch=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "198.51.100.70",
          },
          body: JSON.stringify(body),
        },
      );
      expect(response.status).toBe(batch === 0 ? 200 : 207);
      const page = await response.json();
      expect(page).toHaveLength(20);
      results.push(...page);
    }
    expect(results).toHaveLength(40);
    expect(
      results.filter(
        (row) => row.error?.json.data.code === "TOO_MANY_REQUESTS",
      ),
    ).toHaveLength(10);
    expect(writes).toHaveLength(30);
  });
  it("refuses blocked actors before registering a device", async () => {
    enabled();
    actor = { id: 98601, blockedAt: new Date(0) } as User;
    expect((await request()).status).toBe(403);
    expect(writes).toEqual([]);
  });
});
