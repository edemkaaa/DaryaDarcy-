import { afterEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { PasswordService } from "../apps/backend/src/identity/password.service";
import * as shared from "../apps/backend/src/database/shared-limits";
import type { User } from "../packages/database/src/schema";

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function fixture() {
  vi.stubEnv("API_COORDINATION_MODE", "local");
  vi.stubEnv("API_REPLICA_COUNT", "1");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  // The database boundary fails after a valid startup. HTTP, parsers, route
  // admission and cookie writing stay real; no provider or working DB is used.
  vi.stubEnv("API_COORDINATION_MODE", "mysql");
  vi.stubEnv("API_REPLICA_COUNT", "2");
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const sessions = app.get(SessionService),
    passwords = app.get(PasswordService);
  const registration = vi.spyOn(sessions, "register");
  const lookup = vi.spyOn(sessions, "findByEmail");
  const issuance = vi.spyOn(sessions, "issueSession");
  const request = vi.spyOn(passwords, "request");
  const complete = vi.spyOn(passwords, "complete");
  const post = (path: string) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "synthetic@example.invalid",
        password: "synthetic-password",
      }),
    });
  return { sessions, registration, lookup, issuance, request, complete, post };
}
it.each(["register", "login", "password/request", "password/complete"])(
  "fails closed on %s before identity mutations when quota storage fails",
  async (path) => {
    const fx = await fixture();
    vi.spyOn(shared, "checkSharedRateLimit").mockRejectedValue(
      new Error("PRIVATE_QUOTA_ERROR"),
    );
    const response = await fx.post("/api/auth/" + path);
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.status).toBeLessThan(600);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).not.toContain("PRIVATE_QUOTA_ERROR");
    for (const effect of [
      fx.registration,
      fx.lookup,
      fx.issuance,
      fx.request,
      fx.complete,
    ])
      expect(effect).not.toHaveBeenCalled();
  },
);
it("waits for quota admission before looking up or authenticating an account", async () => {
  const fx = await fixture();
  let reject!: (error: Error) => void, entered!: () => void;
  const started = new Promise<void>((done) => {
    entered = done;
  });
  vi.spyOn(shared, "checkSharedRateLimit").mockImplementation(() => {
    entered();
    return new Promise((_, no) => {
      reject = no;
    });
  });
  const pending = fx.post("/api/auth/login");
  await started;
  expect(fx.lookup).not.toHaveBeenCalled();
  reject(new Error("synthetic quota failure"));
  const response = await pending;
  expect(response.status).toBe(500);
  await response.arrayBuffer();
});
it("never issues a cookie when successful-password quota completion fails", async () => {
  const fx = await fixture();
  vi.spyOn(shared, "checkSharedRateLimit").mockResolvedValue({ ok: true });
  vi.spyOn(shared, "beginSharedLogin").mockResolvedValue({
    ok: true,
    succeeded: async () => {
      throw new Error("PRIVATE_SUCCESS_ERROR");
    },
  });
  const actor = {
    id: 123,
    openId: "synthetic-quota-user",
    role: "user",
    email: "synthetic@example.invalid",
  } as User;
  fx.lookup.mockResolvedValue(actor);
  vi.spyOn(fx.sessions, "passwordUser").mockResolvedValue(actor);
  vi.spyOn(fx.sessions, "updateUser").mockResolvedValue(undefined);
  fx.issuance.mockResolvedValue({
    user: actor,
    sessionToken: "must-not-issue",
  } as never);
  const response = await fx.post("/api/auth/login");
  expect(response.status).toBe(500);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(fx.issuance).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("PRIVATE_SUCCESS_ERROR");
});
