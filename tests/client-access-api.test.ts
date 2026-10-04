import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  setSessionToken: vi.fn(),
  getSessionToken: vi.fn(async () => null),
}));
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  apiUrl: (path: string) => "https://api.example.test" + path,
}));
vi.mock("../apps/frontend/src/domain/session/storage", () => auth);
import {
  apiCall,
  requestPasswordInstructions,
  registerWithEmail,
} from "../apps/frontend/src/shared/api/auth";
import { getAppCapabilities } from "../apps/frontend/src/shared/api/capabilities";
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  auth.setSessionToken.mockReset();
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("requests instructions without issuing or saving a login session", async () => {
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        message: "Если аккаунт доступен, мы отправим письмо с инструкцией.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    ),
  );
  const result = await requestPasswordInstructions("member@example.test");
  expect(result.ok).toBe(true);
  expect(result.message).toContain("Если аккаунт доступен");
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example.test/api/auth/password/request",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "member@example.test" }),
    }),
  );
  expect(auth.setSessionToken).not.toHaveBeenCalled();
});
it("starts registration without a password or a client session", async () => {
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        message: "Подтвердите почту по инструкции в письме.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    ),
  );
  await registerWithEmail("new@example.test", "Member", "2026-09-1");
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body).toEqual({
    email: "new@example.test",
    name: "Member",
    consentVersion: "2026-09-1",
  });
  expect(auth.setSessionToken).not.toHaveBeenCalled();
});
it("reads capabilities from the server and does not accept a string as permission", async () => {
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        smsLogin: true,
        penPals: false,
        shopOnlinePayment: false,
        webPush: false,
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  expect((await getAppCapabilities()).smsLogin).toBe(true);
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ smsLogin: "true" }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  expect((await getAppCapabilities()).smsLogin).toBe(false);
});
it("does not log session cookies, response headers or failed request bodies", async () => {
  const logs = vi.spyOn(console, "log").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  fetcher.mockResolvedValueOnce(
    new Response("{}", {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "app_session=PRIVATE_TEST_SESSION",
        "X-Test-Private": "PRIVATE_TEST_HEADER",
      },
    }),
  );
  await apiCall("/api/test");
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "PRIVATE_TEST_BODY" }), {
      status: 400,
    }),
  );
  await expect(apiCall("/api/test")).rejects.toThrow();
  expect(
    [...logs.mock.calls, ...errors.mock.calls].flat().join(" "),
  ).not.toMatch(/PRIVATE_TEST_/);
});
