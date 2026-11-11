import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  createClubCheckoutResultController,
  type ClubCheckoutResultState,
} from "../apps/frontend/src/features/club/checkout-result-controller";
import { getClubCheckoutIntent } from "../apps/frontend/src/features/club/checkout-intent";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
/** Формирует минимальный ответ tRPC с заданным серверным состоянием оплаты. */
const response = (state: unknown) =>
  new Response(JSON.stringify({ result: { data: { json: { state } } } }));
let values: Map<string, string>;
let key: string;
let prior: string;
let changes: ClubCheckoutResultState[];

/** Создаёт независимый журнал intent и управляемые browser API перед каждой проверкой результата. */
beforeEach(async () => {
  values = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      /** Читает значение из изолированного localStorage сценария. */
      getItem: (key: string) => values.get(key) ?? null,
      /** Записывает значение в изолированный localStorage сценария. */
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      /** Исполняет callback синтетической блокировки; межвкладочная конкуренция проверяется отдельным нативным набором. */
      request: async (
        _key: string,
        _options: unknown,
        callback: () => unknown,
      ) => callback(),
    },
  });
  key = (await getClubCheckoutIntent({ email: "buyer@example.test" }))
    .idempotencyKey;
  prior = values.get(storageKey)!;
  changes = [];
});
/** Останавливает запросы сессии и возвращает глобальные объекты и таймеры после сценария. */
afterEach(() => {
  cancelSessionRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
/** Создаёт настоящий контроллер проверки оплаты и собирает его состояния для утверждений. */
const create = () =>
  createClubCheckoutResultController(createTRPCClient(), (state) =>
    changes.push(state),
  );

/** При отсутствии сохранённого свидетельства не создаёт intent и не отправляет HTTP-запрос. */
it("missing evidence reports absence without HTTP or creating an intent", async () => {
  values.clear();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const controller = create();
  await controller.check();
  expect(changes).toEqual([
    { phase: "checking" },
    { phase: "result", result: null, checking: false },
  ]);
  expect(fetcher).not.toHaveBeenCalled();
  expect(values.size).toBe(0);
  controller.dispose();
});

/** Показывает только подтверждённое сервером состояние, связанное с сохранённым ключом операции. */
it.each(["succeeded", "canceled", "unknown"])(
  "publishes only server-checked %s tied to saved evidence",
  async (state) => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        response(state),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = create();
    await controller.check();
    expect(changes).toEqual([
      { phase: "checking" },
      {
        phase: "result",
        result: { idempotencyKey: key, state },
        checking: false,
      },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe(
      "/api/trpc/club.reconcileCheckout",
    );
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"),
    ).toBe(key);
    expect(values.get(storageKey)).toBe(prior);
    controller.dispose();
  },
);

/** Не допускает параллельных явных проверок одной незавершённой кампании. */
it("duplicate explicit checks cannot overlap an outstanding campaign", async () => {
  let release!: (value: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const controller = create();
  const first = controller.check();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await controller.check();
  expect(fetcher).toHaveBeenCalledTimes(1);
  release(response("canceled"));
  await first;
  expect(changes.at(-1)).toEqual({
    phase: "result",
    result: { idempotencyKey: key, state: "canceled" },
    checking: false,
  });
  controller.dispose();
});

/** Учитывает точный Retry-After ответа 429 без автоматического повтора по истечении задержки. */
it("429 Retry-After blocks explicit checks until the exact deadline without automatic retries", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          error: {
            json: {
              message: "Private provider detail",
              code: -32029,
              data: { httpStatus: 429, code: "TOO_MANY_REQUESTS" },
            },
          },
        }),
        { status: 429, headers: { "Retry-After": "45" } },
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const controller = create();
  await controller.check();
  expect(changes.at(-1)).toMatchObject({ phase: "error", retryAt: 145_000 });
  expect(JSON.stringify(changes)).not.toContain("Private provider detail");
  await vi.advanceTimersByTimeAsync(44_999);
  await controller.check();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockImplementation(async () => response("canceled"));
  await controller.check();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(values.get(storageKey)).toBe(prior);
  controller.dispose();
});

/** Останавливает текущую проверку при отмене, смене сессии или disposal и игнорирует поздний ответ. */
it.each(["cancel", "session", "dispose"])(
  "%s stops outstanding checks without a late result/error",
  async (mode) => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const controller = create();
    const pending = controller.check();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    if (mode === "session") cancelSessionRequests();
    else if (mode === "cancel") controller.cancel();
    else controller.dispose();
    await pending;
    expect(changes).toEqual(
      mode === "dispose"
        ? [{ phase: "checking" }]
        : [{ phase: "checking" }, { phase: "paused" }],
    );
    expect(values.get(storageKey)).toBe(prior);
    if (mode === "dispose") {
      await controller.check();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    controller.dispose();
  },
);

/** Отмена ожидания polling сохраняет свидетельство и не возобновляет запросы самостоятельно. */
it("canceling the polling wait keeps evidence and does not resume automatically", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => response("pending"));
  vi.stubGlobal("fetch", fetcher);
  const controller = create();
  const pending = controller.check();
  await vi.waitFor(() =>
    expect(changes.at(-1)).toMatchObject({ phase: "result" }),
  );
  controller.cancel();
  await pending;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(changes.at(-1)).toEqual({ phase: "paused" });
  expect(vi.getTimerCount()).toBe(0);
  expect(values.get(storageKey)).toBe(prior);
  controller.dispose();
});

/** Не принимает неизвестное серверное значение за доказательство завершённой оплаты и не отражает его в ошибке. */
it("an unrecognized server result becomes a generic error, not terminal proof", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response("PRIVATE")),
  );
  const controller = create();
  await controller.check();
  expect(changes.at(-1)).toMatchObject({ phase: "error", retryAt: 0 });
  expect(JSON.stringify(changes)).not.toContain("PRIVATE");
  expect(values.get(storageKey)).toBe(prior);
  controller.dispose();
});

/** Завершает ограниченную кампанию всё ещё ожидающим состоянием, освобождая флаг запроса и таймеры. */
it("a finite pending campaign ends as still pending, with checking released and no further request", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => response("pending"));
  vi.stubGlobal("fetch", fetcher);
  const controller = create();
  const pending = controller.check();
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(30_000);
  await pending;
  expect(changes.at(-1)).toEqual({
    phase: "result",
    result: { idempotencyKey: key, state: "pending" },
    checking: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(6);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(vi.getTimerCount()).toBe(0);
  expect(values.get(storageKey)).toBe(prior);
  controller.dispose();
});
