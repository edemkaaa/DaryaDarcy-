/** Bounded push transport проверяется fake-clock и управляемыми fetch-streams, без Expo-сети. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  sendExpoPushBatch,
  type ExpoPushMessage,
} from "../apps/backend/src/push";

const audience = vi.hoisted(() => ({ tokens: [] as string[] }));
vi.mock("../apps/backend/src/db", () => ({
  getServicePushTokens: async () => audience.tokens,
}));

/** Включаем fake timers и перехватываем безопасные warning для каждого сценария. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
/** Возвращаем таймеры/fetch/console. */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Формируем синтетические Expo-сообщения с уникальными токенами, чтобы видеть границу пакетов 100+5. */
const messages = (count: number): ExpoPushMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    to: `ExponentPushToken[lifecycle-${i}]`,
    sound: "default",
    title: "Fixture",
    body: "Fixture",
  }));
/** Создаём правдоподобный provider ACK нужного числа элементов. */
const accepted = (count: number) =>
  Response.json({
    data: Array.from({ length: count }, (_, i) => ({
      status: "ok",
      id: `receipt-${i}`,
    })),
  });

/** Зависшие headers/body первого пакета обрываются по deadline; второй пакет из пяти всё равно отправляется, без повторной отправки первых 100. */
it.each(["headers", "body"] as const)(
  "abandons stalled %s after the deadline, without retrying or losing the next batch",
  async (stage) => {
    const input = messages(105);
    audience.tokens = input.map((message) => message.to);
    const batches: number[] = [];
    let finishHeaders: ((response: Response) => void) | undefined;
    let body: ReadableStreamDefaultController<Uint8Array> | undefined;
    let timedOut = false;
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      const count = (JSON.parse(String(options.body)) as unknown[]).length;
      batches.push(count);
      if (batches.length > 1) return accepted(count);
      const abort = () => {
        timedOut = true;
        body?.error(options.signal?.reason);
      };
      if (stage === "body") {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              body = controller;
              controller.enqueue(new TextEncoder().encode('{"data":['));
              options.signal?.addEventListener("abort", abort, { once: true });
            },
          }),
        );
      }
      return new Promise<Response>((resolve, reject) => {
        finishHeaders = resolve;
        options.signal?.addEventListener(
          "abort",
          () => {
            abort();
            reject(options.signal?.reason);
          },
          { once: true },
        );
      });
    });
    let result: number | undefined;
    const pending = sendExpoPushBatch("service", input).then((value) => {
      result = value;
    });
    try {
      await vi.advanceTimersByTimeAsync(10_000);
      expect(timedOut).toBe(true);
      expect(result).toBe(5);
      expect(batches).toEqual([100, 5]);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      // Also release the old implementation after RED; no hanging test resource.
      finishHeaders?.(accepted(100));
      if (body && !timedOut) body.error(new Error("fixture cleanup"));
      await pending;
    }
  },
);

/** Неуспешный HTTP-body отменяется до следующего пакета, освобождая stream и timer. */
it("cancels a rejected response body before continuing and releases the deadline", async () => {
  const input = messages(105);
  audience.tokens = input.map((message) => message.to);
  let cancelled = false;
  let requests = 0;
  vi.stubGlobal("fetch", async () => {
    if (++requests > 1) {
      expect(cancelled).toBe(true);
      return accepted(5);
    }
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
      { status: 503 },
    );
  });

  expect(await sendExpoPushBatch("service", input)).toBe(5);
  expect(cancelled).toBe(true);
  expect(requests).toBe(2);
  expect(vi.getTimerCount()).toBe(0);
});
