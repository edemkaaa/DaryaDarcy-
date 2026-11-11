import { afterEach, expect, it, vi } from "vitest";
import { getUntypedClient } from "@trpc/client";
import superjson from "superjson";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { createAppQueryClient } from "../apps/frontend/src/shared/api/query-client";
import { subscribeSessionChecks } from "../apps/frontend/src/shared/api/session-events";
import {
  cancelSessionRequests,
  fetchApiResponse,
} from "../apps/frontend/src/shared/api/request-lifecycle";
import {
  getHttpStatus,
  isTemporaryRequestError,
  shouldRetryQuery,
} from "../apps/frontend/src/shared/api/errors";
import { apiCall } from "../apps/frontend/src/shared/api/auth";
import { resendAccessEmail } from "../apps/frontend/src/shared/api/access-email";
import { parseRetryAfter } from "../apps/frontend/src/shared/api/retry-after";
import { readProdamusReturnResult } from "../apps/frontend/src/features/club/prodamus-return-api";

// После каждого случая отменяются сессионные запросы и возвращаются настоящие таймеры, чтобы зависшее тело одного теста не влияло на следующий.
afterEach(() => {
  cancelSessionRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rejected = async (promise: Promise<unknown>): Promise<unknown> => {
  // Получает отклонение Promise как значение и проверяет, что запрос действительно завершился ошибкой.

  const result = await promise.then(
    () => ({ failed: false as const }),
    (error: unknown) => ({ failed: true as const, error }),
  );
  expect(result.failed).toBe(true);
  return result.failed ? result.error : undefined;
};
const rpcError = (status: number) => /* Строит tRPC-отказ с приватным маркером для проверки безопасного отображения. */ ({
  error: {
    json: {
      message: "PRIVATE_SERVER_DETAIL",
      code: -32603,
      data: { httpStatus: status, code: "INTERNAL_SERVER_ERROR" },
    },
  },
});

it.each(
  [401, 403, 413, 429, 502, 503].flatMap((status) =>
    ["batch", "single"].map((transport) => ({ status, transport })),
  ),
)(
  "preserves HTML HTTP $status through the real $transport tRPC link",
  async ({ status, transport }) => {
    // Сценарий: Одиночный и пакетный tRPC сохраняют HTTP-код HTML-отказа, Retry-After и скрывают приватные детали.

    const fetcher = vi.fn(
      async () =>
        new Response("<html>PRIVATE_PROXY_DETAIL</html>", {
          status,
          headers: {
            "Content-Type": "text/html",
            "Retry-After": "45",
            "X-Private": "PRIVATE_HEADER",
          },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const client = createTRPCClient();
    const error = await rejected(
      transport === "batch"
        ? client.club.subscription.query()
        : client.club.reconcileCheckout.mutate(undefined, {
            context: { idempotencyKey: "8d427a00-4a92-4508-874c-b265d7e92d1c" },
          }),
    );
    expect(getHttpStatus(error)).toBe(status);
    expect(isTemporaryRequestError(error)).toBe(status >= 500);
    expect(shouldRetryQuery(0, error)).toBe(status >= 500);
    expect(error).toMatchObject({ meta: { retryAfterSec: 45 } });
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
    expect(String(error)).not.toContain("PRIVATE");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it.each(["<html>PRIVATE</html>", "", "{", "null", "{}"])(
  "classifies an invalid HTTP 200 as invalid-response (%s)",
  async (body) => {
    // Сценарий: Неверная оболочка HTTP 200 классифицируется как invalid-response и не запускает повтор.

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    const error = await rejected(createTRPCClient().feed.tags.query());
    expect(error).toMatchObject({ cause: { kind: "invalid-response" } });
    expect(isTemporaryRequestError(error)).toBe(false);
    expect(shouldRetryQuery(0, error)).toBe(false);
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
  },
);

it("preserves a normal batched profile acknowledgement and SuperJSON dates", async () => {
  // Сценарий: Успешный batch сохраняет подтверждение обновления и даты SuperJSON.

  const date = new Date("2026-10-30T12:00:00.000Z");
  const fetcher = vi.fn(async () =>
    Response.json([
      {
        result: {
          data: superjson.serialize({
            success: true,
            profileRevision: 2,
            date,
          }),
        },
      },
    ]),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    createTRPCClient().profile.update.mutate({
      name: "Member",
      expectedRevision: 1,
    }),
  ).resolves.toEqual({ success: true, profileRevision: 2, date });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([409, 412])(
  "preserves structured tRPC conflict data for HTTP %s",
  async (status) => {
    // Сценарий: Конфликт 409/412 сохраняет структурированные данные текущей ревизии.

    const data = {
      httpStatus: status,
      code: "CONFLICT",
      revision: "current-revision",
    };
    vi.stubGlobal("fetch", async () =>
      Response.json(
        [
          {
            error: {
              json: { message: "Сверьте изменения", code: -32009, data },
            },
          },
        ],
        { status },
      ),
    );
    await expect(
      createTRPCClient().profile.update.mutate({
        name: "Member",
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ message: "Сверьте изменения", data });
  },
);

it("keeps success and denial separate in the same HTTP 207 batch", async () => {
  // Сценарий: В batch 207 успешный элемент и запрещённый элемент остаются независимыми.

  const fetcher = vi.fn(async () =>
    Response.json([{ result: { data: { json: [] } } }, rpcError(403)], {
      status: 207,
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const [tags, subscription] = await Promise.allSettled([
    client.feed.tags.query(),
    client.club.subscription.query(),
  ]);
  expect(tags).toEqual({ status: "fulfilled", value: [] });
  expect(subscription.status).toBe("rejected");
  if (subscription.status === "rejected")
    expect(getHttpStatus(subscription.reason)).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([401, 403])(
  "an HTML %s triggers the existing global session check once",
  async (status) => {
    // Сценарий: HTML 401/403 вызывает одну общую проверку сессии.

    const verify = vi.fn();
    const unsubscribe = subscribeSessionChecks(verify);
    const cache = createAppQueryClient();
    const fetcher = vi.fn(async () => new Response("PRIVATE_HTML", { status }));
    vi.stubGlobal("fetch", fetcher);
    try {
      await rejected(
        cache.fetchQuery({
          queryKey: ["protected-http-probe"],
          queryFn: () => /* Читает защищённую подписку через QueryClient, чтобы проверить общую реакцию на 401/403. */ createTRPCClient().club.subscription.query(),
        }),
      );
      expect(verify).toHaveBeenCalledExactlyOnceWith(status);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      cache.clear();
    }
  },
);

it("does not retry a mutation after an HTML 503", async () => {
  // Сценарий: Мутация после HTML 503 не повторяется автоматически.

  const cache = createAppQueryClient();
  const fetcher = vi.fn(
    async () => new Response("PRIVATE_HTML", { status: 503 }),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    const mutation = cache.getMutationCache().build(cache, {
      mutationFn: () =>
        /* Запускает мутацию профиля через MutationCache, проверяя отсутствие автоматического повтора после 503. */ createTRPCClient().profile.update.mutate({
          name: "Member",
          expectedRevision: 1,
        }),
    });
    expect(getHttpStatus(await rejected(mutation.execute(undefined)))).toBe(
      503,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    cache.clear();
  }
});

it.each(["html", "json"])(
  "accepts HTTP-date Retry-After from a %s tRPC refusal",
  async (format) => {
    // Сценарий: Retry-After в формате HTTP-date читается из HTML и JSON отказа.

    const now = new Date("2026-10-30T12:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    const header = new Date(now.getTime() + 120_000).toUTCString();
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          format === "html" ? "PRIVATE_HTML" : JSON.stringify([rpcError(429)]),
          { status: 429, headers: { "Retry-After": header } },
        ),
    );
    try {
      const error = await rejected(
        createTRPCClient().club.subscription.query(),
      );
      expect(error).toMatchObject({ meta: { retryAfterSec: 120 } });
      expect(getHttpStatus(error)).toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  },
);

it("retains HTTP status when an error body itself fails to download", async () => {
  // Сценарий: Сбой скачивания ошибочного тела не теряет уже известный HTTP-статус.

  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            // Обрывает чтение тела после получения ошибочного HTTP-статуса.

            controller.error(new Error("PRIVATE_BODY_DETAIL"));
          },
        }),
        { status: 503 },
      ),
  );
  const error = await rejected(createTRPCClient().club.subscription.query());
  expect(getHttpStatus(error)).toBe(503);
  expect(JSON.stringify(error)).not.toContain("PRIVATE");
});

it("keeps a network interruption of an HTTP 200 body temporary", async () => {
  // Сценарий: Обрыв тела HTTP 200 остаётся временной сетевой ошибкой.

  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            // Обрывает тело HTTP 200 как сетевой сбой вместо неверного формата данных.

            controller.error(new TypeError("PRIVATE_NETWORK_DETAIL"));
          },
        }),
      ),
  );
  const error = await rejected(createTRPCClient().club.subscription.query());
  expect(error).toMatchObject({ cause: { kind: "network" } });
  expect(isTemporaryRequestError(error)).toBe(true);
  expect(shouldRetryQuery(0, error)).toBe(true);
  expect(JSON.stringify(error)).not.toContain("PRIVATE");
});

it("still times out a hung tRPC response body and clears its timer", async () => {
  // Сценарий: Зависшее тело tRPC завершается таймаутом без оставшегося таймера.

  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    async () => new Response(new ReadableStream({ start() {
      // Удерживает тело открытым до срабатывания таймаута транспорта.
} })),
  );
  const result = rejected(fetchApiResponse("/api/trpc/test"));
  await vi.advanceTimersByTimeAsync(15_001);
  expect(await result).toMatchObject({ kind: "timeout" });
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels a tRPC response body when its session changes", async () => {
  // Сценарий: Смена сессии отменяет чтение тела прежнего запроса.

  vi.stubGlobal(
    "fetch",
    async () => new Response(new ReadableStream({ start() {
      // Удерживает тело открытым до отмены запросов при смене сессии.
} })),
  );
  const result = rejected(fetchApiResponse("/api/trpc/test"));
  cancelSessionRequests();
  expect(await result).toMatchObject({ kind: "cancelled" });
});

it("keeps private upload size guidance for an HTML 413", async () => {
  // Сценарий: HTML 413 сохраняет полезное пояснение о размере приватной загрузки.

  vi.stubGlobal(
    "fetch",
    async () => new Response("PRIVATE_HTML", { status: 413 }),
  );
  const client = getUntypedClient(createTRPCClient());
  const error = await rejected(
    client.mutation("admin.uploadPrivateContentFile", {}),
  );
  expect(getHttpStatus(error)).toBe(413);
  expect(String(error)).toContain("ограничения размера");
});

it.each(["1.5", "0", "-1", "2099-01-01", "invalid", "999999999999999999999"])(
  "does not accept a shorthand or overflowing REST Retry-After (%s)",
  async (header) => {
    // Сценарий: Дробные, отрицательные, краткие и переполняющие значения Retry-After не принимаются.

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("", { status: 429, headers: { "Retry-After": header } }),
    );
    expect(await rejected(apiCall("/api/test"))).toMatchObject({
      retryAfterSec: undefined,
    });
  },
);

it.each([
  ["45", 45],
  [" 45 ", 45],
  ["2099", 2099],
  ["Fri, 30 Oct 2026 12:02:00 GMT", 120],
  ["Fri, 30 Oct 2026 11:59:59 GMT", undefined],
  ["Fri, 30 Oct 2026 12:00:00 GMT", undefined],
  ["not a date", undefined],
  ["9007199254740991", undefined],
  [null, undefined],
  ["", undefined],
] as const)(
  "validates Retry-After %s against a fixed clock",
  (header, expected) => {
    // Сценарий: Формат и срок Retry-After проверяются относительно фиксированного времени.

    expect(parseRetryAfter(header, Date.parse("2026-10-30T12:00:00Z"))).toBe(
      expected,
    );
  },
);

it.each(["json", "html"])(
  "keeps a valid REST HTTP-date delay for %s errors",
  async (format) => {
    // Сценарий: REST использует корректную дату из заголовка, не доверяя неверному числу в JSON.

    const now = Date.parse("2026-10-30T12:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          format === "json"
            ? JSON.stringify({ retryAfterSec: 1e21 })
            : "PRIVATE_HTML",
          {
            status: 429,
            headers: { "Retry-After": new Date(now + 120_000).toUTCString() },
          },
        ),
    );
    expect(await rejected(apiCall("/api/test"))).toMatchObject({
      status: 429,
      retryAfterSec: 120,
    });
  },
);

it.each([45, 61])(
  "parses an HTTP-date while retaining the TEST result's existing 60-second bound (%s)",
  async (seconds) => {
    // Сценарий: Возврат TEST-оплаты сохраняет своё ограничение задержки в 60 секунд.

    const now = Date.parse("2026-10-30T12:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response("PRIVATE_HTML", {
          status: 429,
          headers: {
            "Retry-After": new Date(now + seconds * 1000).toUTCString(),
          },
        }),
    );
    const token =
      "club-test-101-00000000-0000-4000-8000-000000000001.1792000000." +
      "a".repeat(64);
    expect(
      await rejected(
        readProdamusReturnResult(token, new AbortController().signal),
      ),
    ).toMatchObject({
      status: 429,
      retryAfterSec: seconds <= 60 ? seconds : undefined,
    });
  },
);

it("preserves a valid delay for an access-email refusal without sending another request", async () => {
  // Сценарий: Отказ отправки письма сохраняет задержку без скрытого повторного запроса.

  const fetcher = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "45" } }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await rejected(
      resendAccessEmail(
        42,
        new AbortController().signal,
        "11111111-1111-4111-8111-111111111111",
      ),
    ),
  ).toMatchObject({ status: 429, retryAfterSec: 45 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
