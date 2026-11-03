import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  sendExpoPushBatch,
  type ExpoPushMessage,
} from "../apps/backend/src/push";

const audience = vi.hoisted(() => ({ tokens: [] as string[] }));
vi.mock("../apps/backend/src/db", () => ({
  getServicePushTokens: async () => audience.tokens,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const messages = (count: number): ExpoPushMessage[] =>
  Array.from({ length: count }, (_, i) => ({
    to: `ExponentPushToken[lifecycle-${i}]`,
    sound: "default",
    title: "Fixture",
    body: "Fixture",
  }));
const accepted = (count: number) =>
  Response.json({
    data: Array.from({ length: count }, (_, i) => ({
      status: "ok",
      id: `receipt-${i}`,
    })),
  });

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
