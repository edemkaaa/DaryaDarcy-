/** Admin owner-notify проходит настоящий loopback tRPC; только фиксированный внешний provider fetch синтетический. */
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
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { notifyOwner } from "../apps/backend/src/_core/notification";
import type { AppRouter } from "../apps/backend/src/routers";
import type { User } from "../packages/database/src/schema";

const realFetch = globalThis.fetch;
const provider = "https://forge.example.test/";
const payload = { title: "Fixture", content: "Fixture content" };
let app: INestApplication;
let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
/** Поднимаем локальный app и типизированный HTTP-client. */
beforeAll(async () => {
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  const { port } = app.getHttpServer().address() as AddressInfo;
  client = createTRPCProxyClient<AppRouter>({
    links: [
      httpLink({
        url: `http://127.0.0.1:${port}/api/trpc`,
        transformer: superjson,
      }),
    ],
  });
});
/** Задаём synthetic provider/key и admin сессию, перехватываем безопасные warnings. */
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("BUILT_IN_FORGE_API_URL", provider);
  vi.stubEnv("BUILT_IN_FORGE_API_KEY", "SYNTHETIC_PRIVATE_KEY");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(app.get(SessionService), "optionalUser").mockResolvedValue({
    id: 42,
    role: "admin",
    blockedAt: null,
  } as User);
});
/** Возвращаем clocks, spies, fetch и env. */
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
/** Закрываем приложение. */
afterAll(async () => {
  await app.close();
});

/** Локальный API использует настоящий fetch; только fixture provider перехватывается, остальные origin запрещены. */
function transport(send: (init: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", (url: string | URL, init: RequestInit) => {
    if (String(url).startsWith(provider)) return send(init);
    if (String(url).startsWith("http://127.0.0.1:"))
      return realFetch(url, init);
    throw new Error("Unapproved external request");
  });
}

/** HTTP503/network отказ дают success:false без provider body/key в логах. */
it.each(["rejected", "network"] as const)(
  "native admin notify contains %s failure without logging provider data",
  async (failure) => {
    transport(async () => {
      if (failure === "network") throw new Error("PRIVATE_PROVIDER_ERROR");
      return new Response("PRIVATE_PROVIDER_ERROR", { status: 503 });
    });

    expect(await client.system.notifyOwner.mutate(payload)).toEqual({
      success: false,
    });
    expect(console.warn).toHaveBeenCalled();
    expect(
      vi.mocked(console.warn).mock.calls.flat().map(String).join(" "),
    ).not.toMatch(/PRIVATE_PROVIDER_ERROR|SYNTHETIC_PRIVATE_KEY/);
  },
);

/** Даже успешный ответ не читается ради диагностики; stream отменяется для освобождения соединения. */
it.each([200, 503])(
  "native admin notify releases the unread HTTP %s body",
  async (status) => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { status },
    );
    // A forbidden diagnostic read must fail promptly even against the old code;
    // the real unread stream still proves cancellation, without a hanging fixture.
    const read = vi
      .spyOn(response, "text")
      .mockResolvedValue("PRIVATE_PROVIDER_BODY");
    transport(async () => response);
    expect(await client.system.notifyOwner.mutate(payload)).toEqual({
      success: status === 200,
    });
    expect(read).not.toHaveBeenCalled();
    expect(cancelled).toBe(true);
  },
);

/** Гость/user не достигают provider и получают401/403. */
it.each([null, "user"] as const)(
  "%s cannot trigger an owner notification",
  async (role) => {
    vi.mocked(app.get(SessionService).optionalUser).mockResolvedValue(
      role ? ({ id: 42, role } as User) : null,
    );
    let submitted = false;
    transport(async () => {
      submitted = true;
      return new Response();
    });
    await expect(
      client.system.notifyOwner.mutate(payload),
    ).rejects.toMatchObject({
      data: { code: role ? "FORBIDDEN" : "UNAUTHORIZED" },
    });
    expect(submitted).toBe(false);
  },
);

/** Десятисекундный deadline отменяет единственный запрос и освобождает timer без повторной отправки. */
it("bounds a stalled provider request without retrying it", async () => {
  vi.useFakeTimers();
  let finish: ((value: Response) => void) | undefined;
  let aborted = false;
  let attempts = 0;
  transport(async (init) => {
    attempts++;
    return new Promise<Response>((resolve, reject) => {
      finish = resolve;
      init.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(init.signal?.reason);
        },
        { once: true },
      );
    });
  });
  let result: boolean | undefined;
  const pending = notifyOwner(payload).then((value) => {
    result = value;
  });
  try {
    await vi.advanceTimersByTimeAsync(10_000);
    expect(aborted).toBe(true);
    expect(result).toBe(false);
    expect(attempts).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    finish?.(new Response());
    await pending;
  }
});
