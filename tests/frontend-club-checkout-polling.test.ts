/** Проверяем ограниченный TEST polling на fake clock: только сохранённый intent, последовательные чтения, конечный бюджет и остановка при отмене или отказе. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getClubCheckoutIntent } from "../apps/frontend/src/features/club/checkout-intent";
import { pollClubTestCheckout } from "../apps/frontend/src/features/club/checkout-polling";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
/** Формирует минимальный tRPC envelope состояния, не подтверждая настоящий платёж. */
const reply = (state: string) =>
  new Response(
    JSON.stringify({
      result: { data: { json: { state } } },
    }),
  );
let values: Map<string, string>;
let key: string;
let controller: AbortController;

/** Создаём собственный durable TEST intent и AbortController до перехода на виртуальное время. */
beforeEach(async () => {
  values = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => {
        values.set(name, value);
      },
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: () => unknown,
      ) => callback(),
    },
  });
  key = (await getClubCheckoutIntent({ email: "buyer@example.test" }))
    .idempotencyKey;
  controller = new AbortController();
  vi.useFakeTimers();
});
/** Отменяем session-scoped работу, возвращаем clock и браузерные globals. */
afterEach(() => {
  cancelSessionRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Терминальный/unknown ответ завершает кампанию после одной проверки, не меняя доказательства checkout. */
it.each(["unknown", "succeeded", "canceled"] as const)(
  "stops after a verified %s without creating, erasing or rotating evidence",
  async (state) => {
    const prior = values.get(storageKey);
    const fetcher = vi.fn(async () => reply(state));
    vi.stubGlobal("fetch", fetcher);
    const onResult = vi.fn();
    expect(
      await pollClubTestCheckout(createTRPCClient(), {
        signal: controller.signal,
        onResult,
      }),
    ).toEqual({ idempotencyKey: key, state });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledOnce();
    expect(values.get(storageKey)).toBe(prior);
    expect(vi.getTimerCount()).toBe(0);
  },
);

/** Интервалы считаются после завершения предыдущего чтения; максимум шесть проверок с тем же Idempotency-Key. */
it("checks immediately, then never faster than five seconds, with six checks maximum", async () => {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) => reply("pending"),
  );
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  const pending = pollClubTestCheckout(createTRPCClient(), {
    signal: controller.signal,
    onResult,
  }).catch((error: unknown) => error);
  // waitFor advances fake time itself; drain work without moving the clock
  // so the 4999/5000 boundary is measured from the completed first check.
  await vi.advanceTimersByTimeAsync(0);
  expect(onResult).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4999);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(await pending).toEqual({ idempotencyKey: key, state: "pending" });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(onResult).toHaveBeenCalledTimes(6);
  expect(vi.getTimerCount()).toBe(0);
  for (const [url, options] of fetcher.mock.calls) {
    expect(String(url)).toContain("/club.reconcileCheckout");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(key);
  }
});

/** Общий deadline отменяет зависшую последнюю проверку, сохраняя только ранее подтверждённое pending. */
it("stops a slow final check at the total thirty-second budget, retaining last pending state", async () => {
  const prior = values.get(storageKey);
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) => reply("pending"),
  );
  fetcher.mockImplementationOnce(async () => reply("pending"));
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  const pending = pollClubTestCheckout(createTRPCClient(), {
    signal: controller.signal,
    onResult,
  });
  await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(20_000);
  expect(onResult).toHaveBeenCalledTimes(5);
  fetcher.mockImplementationOnce(() => new Promise<Response>(() => {}));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(await pending).toEqual({ idempotencyKey: key, state: "pending" });
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(fetcher.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
  expect(values.get(storageKey)).toBe(prior);
  expect(vi.getTimerCount()).toBe(0);
});

/** Abort пользователя и смена сессии прекращают интервалы без последующих HTTP-вызовов. */
it.each(["caller", "session"])(
  "stops between checks on %s cancellation",
  async (source) => {
    const fetcher = vi.fn(async () => reply("pending"));
    vi.stubGlobal("fetch", fetcher);
    const onResult = vi.fn();
    const pending = pollClubTestCheckout(createTRPCClient(), {
      signal: controller.signal,
      onResult,
    }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    if (source === "caller") controller.abort();
    else cancelSessionRequests();
    expect(await pending).toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);

/** 429 не вызывает автоматическую повторную кампанию, создание оплаты или очистку intent. */
it("stops on a quota refusal without automatic retry, new checkout or evidence changes", async () => {
  const prior = values.get(storageKey);
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          error: {
            json: {
              message: "Повторите проверку позже.",
              code: -32029,
              data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
            },
          },
        }),
        { status: 429, headers: { "Retry-After": "60" } },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  await expect(
    pollClubTestCheckout(createTRPCClient(), {
      signal: controller.signal,
      onResult,
    }),
  ).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onResult).not.toHaveBeenCalled();
  expect(values.get(storageKey)).toBe(prior);
  expect(vi.getTimerCount()).toBe(0);
});

/** Подмена durable ключа другой вкладкой останавливает старую кампанию до следующего запроса. */
it("never switches to another tab's intent between checks", async () => {
  const fetcher = vi.fn(async () => reply("pending"));
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  const pending = pollClubTestCheckout(createTRPCClient(), {
    signal: controller.signal,
    onResult,
  }).catch((error: unknown) => error);
  await vi.waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  const replacement = JSON.stringify({
    ...JSON.parse(values.get(storageKey)!),
    idempotencyKey: "8d427a00-4a92-4508-874c-b265d7e92d1c",
  });
  values.set(storageKey, replacement);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBeInstanceOf(Error);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(values.get(storageKey)).toBe(replacement);
  expect(vi.getTimerCount()).toBe(0);
});

/** Без сохранённого intent polling возвращает null, не создаёт таймер или сетевую операцию. */
it("absent saved evidence does not start a check or create a purchase", async () => {
  values.clear();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  expect(
    await pollClubTestCheckout(createTRPCClient(), {
      signal: controller.signal,
      onResult,
    }),
  ).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  expect(values.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

/** Зависшее первое чтение не перекрывается вторым; после pending и последующего success таймеры сняты. */
it("stops at the first success after pending and never starts an overlapping check", async () => {
  let release: (response: Response) => void = () => {};
  const fetcher = vi.fn(async () => reply("succeeded"));
  fetcher.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  const pending = pollClubTestCheckout(createTRPCClient(), {
    signal: controller.signal,
    onResult,
  });
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(8000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onResult).not.toHaveBeenCalled();
  release(reply("pending"));
  await vi.advanceTimersByTimeAsync(0);
  expect(onResult).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4999);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toEqual({ idempotencyKey: key, state: "succeeded" });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(onResult.mock.calls.map(([result]) => result.state)).toEqual([
    "pending",
    "succeeded",
  ]);
  expect(vi.getTimerCount()).toBe(0);
});

/** До первого достоверного ответа timeout остаётся ошибкой, а не придуманным состоянием оплаты. */
it("a first-check timeout is an error, not a fabricated pending/terminal result", async () => {
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  const pending = pollClubTestCheckout(createTRPCClient(), {
    signal: controller.signal,
    onResult,
  }).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await pending).toMatchObject({ cause: { kind: "timeout" } });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(onResult).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

/** Уже отменённый signal проверяется до browser/storage и callbacks, даже при отсутствии window. */
it("an already aborted campaign cannot read storage, invoke callbacks or send HTTP", async () => {
  controller.abort();
  vi.stubGlobal("window", undefined);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const onResult = vi.fn();
  await expect(
    pollClubTestCheckout(createTRPCClient(), {
      signal: controller.signal,
      onResult,
    }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(onResult).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
