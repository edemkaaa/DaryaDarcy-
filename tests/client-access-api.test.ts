import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  setSessionToken: vi.fn(),
  getSessionToken: vi.fn(async () => null),
}));
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  /** Направляет клиентские auth/capability запросы на synthetic API origin для наблюдаемого fetch-double. */
  apiUrl: (path: string) => "https://api.example.test" + path,
}));
vi.mock("../apps/frontend/src/domain/session/storage", () => auth);
import {
  apiCall,
  requestPasswordInstructions,
  registerWithEmail,
  loginWithEmail,
  logout,
} from "../apps/frontend/src/shared/api/auth";
import {
  getAppCapabilities,
  requirePrivateUpload,
} from "../apps/frontend/src/shared/api/capabilities";
let fetcher: ReturnType<typeof vi.fn>;
/** Сбрасывает сохранение токена и устанавливает свежий управляемый fetch перед сценарием. */
beforeEach(() => {
  auth.setSessionToken.mockReset();
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
/** Возвращает глобальный fetch и диагностические подмены. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
/** Проверяет принятие только подтверждённого backend logout с cookie-транспортом. */
it("accepts the backend's confirmed logout response", async () => {
  fetcher.mockResolvedValue(new Response(JSON.stringify({ success: true })));
  await expect(logout()).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example.test/api/auth/logout",
    expect.objectContaining({ method: "POST", credentials: "include" }),
  );
});
/** Проверяет отказ неоднозначного или неполного logout-ответа вместо ложного локального успеха. */
it.each([{}, { success: false }, { success: "true" }, { ok: true }, null])(
  "rejects an unconfirmed logout response: %j",
  async (body) => {
    fetcher.mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(logout()).rejects.toThrow();
  },
);
/** Проверяет запрос password-инструкций без выпуска или сохранения клиентской сессии. */
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
/** Проверяет passwordless регистрацию с актуальным согласием без локального sessionToken. */
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
/** Проверяет вход только с публичным профилем и browser cookie без копирования sessionToken в storage. */
it("accepts login with only a public profile and uses the browser cookie transport", async () => {
  const user = {
    id: 4301,
    openId: "cookie-only-login",
    role: "user",
    name: "Fixture",
    email: "cookie-only@example.test",
    phone: null,
    loginMethod: "email",
    gender: null,
    avatarUrl: null,
    lastSignedIn: "2026-10-28T10:00:00.000Z",
  };
  fetcher.mockResolvedValue(new Response(JSON.stringify({ user })));
  await expect(loginWithEmail(user.email, "fixture-password")).resolves.toEqual(
    { user },
  );
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example.test/api/auth/login",
    expect.objectContaining({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    }),
  );
  expect(auth.setSessionToken).not.toHaveBeenCalled();
});
/** Проверяет строгие boolean capabilities без превращения строки true в разрешение. */
it("reads capabilities from the server and does not accept a string as permission", async () => {
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        smsLogin: true,
        penPals: false,
        shopOnlinePayment: false,
        webPush: false,
        privateContentUploads: false,
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  expect((await getAppCapabilities()).smsLogin).toBe(true);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ smsLogin: "true", privateContentUploads: false }),
      {
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  await expect(getAppCapabilities()).rejects.toMatchObject({
    kind: "invalid-response",
  });
});
/** Проверяет доступность приватных upload только по явно объявленному сервером контракту. */
it.each([
  [{ privateContentUploads: false }, false],
  [
    {
      privateContentUploads: true,
      privatePostMediaUploads: true,
      privatePostVideoUploads: true,
    },
    true,
  ],
])(
  "reads explicitly advertised private upload availability: %j",
  async (payload, allowed) => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    expect(await getAppCapabilities()).toMatchObject({
      privateContentUploads: allowed,
      privatePostMediaUploads: allowed,
      privatePostVideoUploads: allowed,
    });
  },
);
/** Проверяет malformed и неизвестные capabilities без fallback к legacy публичной загрузке. */
it.each([
  { payload: {} },
  { payload: null },
  { payload: [] },
  {
    payload: {
      privateContentUploads: "true",
      privatePostMediaUploads: 1,
      privatePostVideoUploads: {},
    },
  },
])(
  "rejects unknown or malformed availability instead of choosing the legacy contract: $payload",
  async ({ payload }) => {
    fetcher.mockResolvedValueOnce(Response.json(payload));
    await expect(getAppCapabilities()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);
/** Проверяет повторное чтение текущей upload capability вместо доверия прежнему разрешению. */
it.each([
  "privateContentUploads",
  "privatePostMediaUploads",
  "privatePostVideoUploads",
] as const)(
  "rechecks %s instead of accepting an earlier enabled response",
  async (name) => {
    fetcher.mockResolvedValueOnce(
      Response.json({
        privateContentUploads: true,
        privatePostMediaUploads: true,
        privatePostVideoUploads: true,
      }),
    );
    await expect(requirePrivateUpload(name)).resolves.toBeUndefined();
    fetcher.mockResolvedValueOnce(
      Response.json({ privateContentUploads: false }),
    );
    await expect(requirePrivateUpload(name)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  },
);
/** Проверяет обязательную photo capability для автоматически созданного приватного video-постера. */
it("requires photo availability for automatically generated private video posters", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({
      privatePostVideoUploads: true,
      privateContentUploads: false,
    }),
  );
  await expect(
    requirePrivateUpload("privatePostVideoUploads"),
  ).rejects.toMatchObject({ status: 503 });
});
/** Проверяет отсутствие даже capability-запроса после отмены редакторской операции. */
it("does not dispatch a capability check from an already cancelled editor", async () => {
  const operation = new AbortController();
  operation.abort();
  await expect(
    requirePrivateUpload("privateContentUploads", operation.signal),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
/** Проверяет отказ загрузки после инфраструктурной ошибки проверки capability. */
it("does not allow upload after an infrastructure failure", async () => {
  fetcher.mockResolvedValueOnce(
    Response.json({ error: "Unavailable" }, { status: 503 }),
  );
  await expect(
    requirePrivateUpload("privateContentUploads"),
  ).rejects.toMatchObject({ status: 503 });
});
/** Проверяет отсутствие cookie, заголовков и тела отказавшего запроса в клиентских логах. */
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
