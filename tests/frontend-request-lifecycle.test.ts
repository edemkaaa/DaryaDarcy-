import { afterEach, expect, it, vi } from "vitest";
import {
  apiCall,
  getMe,
  registerWithEmail,
} from "../apps/frontend/src/shared/api/auth";
import {
  cancelSessionRequests,
  runApiRequest,
} from "../apps/frontend/src/shared/api/request-lifecycle";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cancelSessionRequests();
});

it("omits credentials for a sessionless payment-result request", async () => {
  const fetcher = vi.fn(async () => new Response("pending"));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    runApiRequest(
      "/api/prodamus/test/result",
      { credentials: "omit" },
      (response) => response.text(),
    ),
  ).resolves.toBe("pending");
  expect(fetcher).toHaveBeenCalledWith(
    "/api/prodamus/test/result",
    expect.objectContaining({ credentials: "omit" }),
  );
});

it("still includes session cookies by default", async () => {
  const fetcher = vi.fn(async () => new Response("member"));
  vi.stubGlobal("fetch", fetcher);
  await runApiRequest("/api/auth/me", {}, (response) => response.text());
  expect(fetcher).toHaveBeenCalledWith(
    "/api/auth/me",
    expect.objectContaining({ credentials: "include" }),
  );
});

it("times out even when the caller supplies a cancellation signal", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const pending = runApiRequest(
    "/api/test",
    { signal: new AbortController().signal },
    (r) => r.text(),
    25,
  );
  const rejected = expect(pending).rejects.toMatchObject({ kind: "timeout" });
  await vi.advanceTimersByTimeAsync(26);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels requests from an old session even if fetch ignores abort", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const pending = runApiRequest("/api/test", {}, (r) => r.text());
  const rejected = expect(pending).rejects.toMatchObject({ kind: "cancelled" });
  cancelSessionRequests();
  await rejected;
});

it("keeps the deadline active while reading a response body", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ text: () => new Promise(() => {}) })),
  );
  const rejected = expect(
    runApiRequest("/api/test", {}, (r) => r.text(), 25),
  ).rejects.toMatchObject({ kind: "timeout" });
  await vi.advanceTimersByTimeAsync(26);
  await rejected;
});

it("does not expose internal messages on server errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "PRIVATE_SQL_PASSWORD" }), {
          status: 500,
        }),
    ),
  );
  await expect(apiCall("/api/test")).rejects.toMatchObject({
    status: 500,
    message: "Сервис временно недоступен. Попробуйте ещё раз.",
  });
});

it.each([null, {}, { user: { id: 1 } }, { user: { id: -1 } }])(
  "rejects malformed session data: %j",
  async (data) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(data))),
    );
    await expect(getMe()).rejects.toMatchObject({ kind: "invalid-response" });
  },
);

it("does not treat an unsuccessful registration body as success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, message: "Rejected" })),
    ),
  );
  await expect(registerWithEmail("member@example.test")).rejects.toMatchObject({
    kind: "invalid-response",
  });
});

it("reads Retry-After without retrying a mutation", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "45" } }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(registerWithEmail("member@example.test")).rejects.toMatchObject({
    status: 429,
    retryAfterSec: 45,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("normalizes real tRPC transport errors without discarding their status", async () => {
  const { createTRPCClient } =
    await import("../apps/frontend/src/shared/api/trpc");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              error: {
                json: {
                  message: "PRIVATE_INTERNAL_DETAILS",
                  code: -32603,
                  data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
                },
              },
            },
          ]),
        ),
    ),
  );
  await expect(
    createTRPCClient().feed.savedPosts.query(),
  ).rejects.toMatchObject({
    message: "Сервис временно недоступен. Попробуйте ещё раз.",
    data: { httpStatus: 500 },
  });
});

it.each(["45", "0", "-1", "1.5", "invalid", "99999999999999999999"])(
  "tRPC preserves only valid Retry-After delay, without provider response metadata (%s)",
  async (header) => {
    const { createTRPCClient } =
      await import("../apps/frontend/src/shared/api/trpc");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                json: {
                  message: "PRIVATE_INTERNAL_DETAILS",
                  code: -32029,
                  data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
                },
              },
            }),
            {
              status: 429,
              headers: { "Retry-After": header, "X-Private": "PRIVATE_HEADER" },
            },
          ),
      ),
    );
    const error = await createTRPCClient()
      .club.reconcileCheckout.mutate(undefined, {
        context: { idempotencyKey: "8d427a00-4a92-4508-874c-b265d7e92d1c" },
      })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({
      message: "Слишком много запросов. Попробуйте позже.",
      data: { httpStatus: 429 },
    });
    expect((error as { meta?: unknown }).meta).toEqual(
      header === "45" ? { retryAfterSec: 45 } : undefined,
    );
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
  },
);

it("preserves cancellation from an already-aborted caller", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    runApiRequest("/api/test", { signal: controller.signal }, (r) => r.text()),
  ).rejects.toMatchObject({ kind: "cancelled" });
  expect(fetcher).not.toHaveBeenCalled();
});

it("does not confirm logout when the response explicitly rejects it", async () => {
  const { logout } = await import("../apps/frontend/src/shared/api/auth");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: false }))),
  );
  await expect(logout()).rejects.toMatchObject({ kind: "invalid-response" });
});
