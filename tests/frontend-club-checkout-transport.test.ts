import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import {
  createClubTestCheckout,
  createNextClubTestCheckout,
  reconcileClubTestCheckout,
} from "../apps/frontend/src/features/club/test-checkout";
import { getClubCheckoutIntent } from "../apps/frontend/src/features/club/checkout-intent";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";

const firstKey = "8d427a00-4a92-4508-874c-b265d7e92d1c";
const secondKey = "8d427a00-4a92-4508-874c-b265d7e92d1d";
const input = { email: "buyer@example.test", plan: "monthly" as const };
const output = {
  url: "https://yoomoney.ru/checkout/payments/test",
  user: null,
};
const result = { result: { data: { json: output } } };
const subscription = {
  result: {
    data: {
      json: {
        subscribed: false,
        expiresAt: null,
        cancelAtPeriodEnd: false,
        isOwner: false,
        monthlyPrice: "790",
      },
    },
  },
};
const requestUrl = (url: RequestInfo | URL) =>
  new URL(String(url), "https://caller.example.test");
const response = (url: RequestInfo | URL) =>
  new Response(
    JSON.stringify(
      requestUrl(url).searchParams.has("batch")
        ? requestUrl(url)
            .pathname.split(",")
            .map((path) =>
              path.endsWith("club.subscription") ? subscription : result,
            )
        : result,
    ),
  );
let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
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
});
afterEach(() => {
  cancelSessionRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("sends an intent header on an individual tRPC mutation, never in URL or input", async () => {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await createTRPCClient().club.createCheckout.mutate(input, {
      context: { idempotencyKey: firstKey },
    }),
  ).toEqual(output);
  const [url, options] = fetcher.mock.calls[0];
  expect(requestUrl(url).searchParams.has("batch")).toBe(false);
  expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(firstKey);
  expect(JSON.parse(String(options?.body))).toEqual({ json: input });
  expect(String(url)).not.toContain(firstKey);
  expect(options?.body).not.toContain(firstKey);
  expect(options?.credentials).toBe("include");
  expect(options?.cache).toBe("no-store");
});

it("does not merge distinct keyed mutations into a shared batch/header", async () => {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  await Promise.all(
    [firstKey, secondKey].map((idempotencyKey) =>
      client.club.createCheckout.mutate(input, { context: { idempotencyKey } }),
    ),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    fetcher.mock.calls.map(([, options]) =>
      new Headers(options?.headers).get("Idempotency-Key"),
    ),
  ).toEqual([firstKey, secondKey]);
});

it.each([null, "invalid", `${firstKey}\r\nAuthorization: private`, [firstKey]])(
  "rejects malformed operation keys before HTTP (%#)",
  async (idempotencyKey) => {
    const fetcher = vi.fn(async (url: RequestInfo | URL) => response(url));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      createTRPCClient().club.createCheckout.mutate(input, {
        context: { idempotencyKey },
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  },
);

it("does not permit an intent header on a read operation", async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) => response(url));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    createTRPCClient().club.subscription.query(undefined, {
      context: { idempotencyKey: firstKey },
    }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves legacy batching without context and does not leak a keyed mutation's header into a concurrent query", async () => {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  await Promise.all([
    client.club.createCheckout.mutate(input, {
      context: { idempotencyKey: firstKey },
    }),
    client.club.subscription.query(),
  ]);
  const query = fetcher.mock.calls.find(([url]) =>
    requestUrl(url).pathname.endsWith("club.subscription"),
  )!;
  expect(requestUrl(query[0]).searchParams.get("batch")).toBe("1");
  expect(new Headers(query[1]?.headers).has("Idempotency-Key")).toBe(false);
  await client.club.createCheckout.mutate(input);
  const legacy = fetcher.mock.calls.at(-1)!;
  expect(requestUrl(legacy[0]).searchParams.get("batch")).toBe("1");
  expect(new Headers(legacy[1]?.headers).has("Idempotency-Key")).toBe(false);
});

it("the club orchestrator sends the saved canonical intent and reuses it after a transport failure", async () => {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  fetcher.mockRejectedValueOnce(new TypeError("Private network details"));
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  await expect(
    createClubTestCheckout(client, { email: " BUYER@EXAMPLE.TEST " }),
  ).rejects.toThrow("Не удалось связаться");
  expect(values.size).toBe(1);
  expect(await createClubTestCheckout(client, input)).toEqual(output);
  const [first, second] = fetcher.mock.calls;
  const key = new Headers(first[1]?.headers).get("Idempotency-Key");
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.parse([...values.values()][0]).idempotencyKey).toBe(key);
  expect(new Headers(second[1]?.headers).get("Idempotency-Key")).toBe(key);
  expect(first[1]?.body).toBe(second[1]?.body);
  expect(JSON.parse(String(second[1]?.body))).toEqual({ json: input });
});

it("storage refusal prevents the orchestrator from making any request", async () => {
  vi.stubGlobal("window", {
    isSecureContext: true,
    get localStorage() {
      throw new Error("Private storage denial");
    },
  });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    createClubTestCheckout(createTRPCClient(), input),
  ).rejects.toMatchObject({ reason: "unavailable" });
  expect(fetcher).not.toHaveBeenCalled();
});

it("an already canceled purchase cannot reserve evidence or dispatch", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => response(url));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    createClubTestCheckout(createTRPCClient(), input, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(values.size).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});

it("caller cancellation while waiting for a writer lock prevents late reservation and dispatch", async () => {
  const controller = new AbortController();
  let release: (() => void) | undefined;
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: () => unknown,
      ) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return callback();
      },
    },
  });
  const fetcher = vi.fn(async (url: RequestInfo | URL) => response(url));
  vi.stubGlobal("fetch", fetcher);
  const pending = createClubTestCheckout(
    createTRPCClient(),
    input,
    controller.signal,
  ).catch((error: unknown) => error);
  await vi.waitFor(() => expect(release).toBeTypeOf("function"));
  controller.abort();
  release!();
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(values.size).toBe(0);
  expect(fetcher).not.toHaveBeenCalled();
});

it("caller cancellation aborts purchase transport but retains the same key for explicit retry", async () => {
  const controller = new AbortController();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  fetcher.mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const pending = createClubTestCheckout(
    client,
    input,
    controller.signal,
  ).catch((error: unknown) => error);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  controller.abort();
  expect(await pending).toMatchObject({ cause: { kind: "cancelled" } });
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(await createClubTestCheckout(client, input)).toEqual(output);
  expect(
    new Headers(fetcher.mock.calls[1][1]?.headers).get("Idempotency-Key"),
  ).toBe(new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"));
});

it.each(["first", "next"] as const)(
  "%s purchase refuses a late URL after browser evidence was replaced",
  async (kind) => {
    const prior = await getClubCheckoutIntent(input);
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (requestUrl(url).pathname.endsWith("club.reconcileCheckout"))
        return new Response(
          JSON.stringify({ result: { data: { json: { state: "canceled" } } } }),
        );
      const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
      values.set(
        storageKey,
        JSON.stringify({
          ...JSON.parse(values.get(storageKey)!),
          idempotencyKey: secondKey,
        }),
      );
      return response(url);
    });
    vi.stubGlobal("fetch", fetcher);
    const client = createTRPCClient();
    const pending =
      kind === "next"
        ? createNextClubTestCheckout(client, {
            previousIdempotencyKey: prior.idempotencyKey,
            selection: input,
          })
        : createClubTestCheckout(client, input);
    await expect(pending).rejects.toThrow("Сохранённая заявка изменилась");
    expect(JSON.parse([...values.values()][0]).idempotencyKey).toBe(secondKey);
    expect(fetcher).toHaveBeenCalledTimes(kind === "next" ? 2 : 1);
  },
);

it("a real request-lifecycle timeout retains the durable identity for an explicit retry", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  fetcher.mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const pending = createClubTestCheckout(client, input).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await pending).toMatchObject({ cause: { kind: "timeout" } });
  expect(fetcher).toHaveBeenCalledTimes(1); // No implicit mutation retry.
  vi.useRealTimers();
  expect(await createClubTestCheckout(client, input)).toEqual(output);
  const [first, second] = fetcher.mock.calls;
  expect(new Headers(second[1]?.headers).get("Idempotency-Key")).toBe(
    new Headers(first[1]?.headers).get("Idempotency-Key"),
  );
  expect(second[1]?.body).toBe(first[1]?.body);
});

it("session cancellation aborts a dispatched request without replacing its intent", async () => {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, _options?: RequestInit) => response(url),
  );
  fetcher.mockImplementationOnce(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const pending = createClubTestCheckout(client, input).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  cancelSessionRequests();
  expect(await pending).toMatchObject({ cause: { kind: "cancelled" } });
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(await createClubTestCheckout(client, input)).toEqual(output);
  expect(
    new Headers(fetcher.mock.calls[1][1]?.headers).get("Idempotency-Key"),
  ).toBe(new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"));
});

it("a session change during intent preparation prevents late dispatch under the next identity", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const pending = createClubTestCheckout(createTRPCClient(), input).catch(
    (error: unknown) => error,
  );
  cancelSessionRequests();
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});

it("a return with no saved intent cannot dispatch any check or create request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(await reconcileClubTestCheckout(createTRPCClient())).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  expect(values.size).toBe(0);
});

it.each(["unknown", "pending", "succeeded", "canceled"] as const)(
  "checks only saved evidence by POST/header and retains it after %s",
  async (state) => {
    const saved = await getClubCheckoutIntent(input);
    const prior = [...values.values()][0];
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Response(JSON.stringify({ result: { data: { json: { state } } } })),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await reconcileClubTestCheckout(createTRPCClient())).toEqual({
      idempotencyKey: saved.idempotencyKey,
      state,
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(requestUrl(url).pathname).toBe("/api/trpc/club.reconcileCheckout");
    expect(requestUrl(url).search).toBe("");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(
      saved.idempotencyKey,
    );
    expect(JSON.parse(String(options?.body))).toEqual({
      json: null,
      meta: { values: ["undefined"] },
    });
    expect(String(url)).not.toContain(saved.idempotencyKey);
    expect(options?.body).not.toContain(input.email);
    expect(options?.body).not.toContain(saved.idempotencyKey);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([...values.values()][0]).toBe(prior);
  },
);

it.each([null, {}, { state: "paid" }, { state: "succeeded", email: "SECRET" }])(
  "rejects malformed return replies without accepting payment proof (%#)",
  async (reply) => {
    await getClubCheckoutIntent(input);
    const prior = [...values.values()][0];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              result: { data: { json: reply } },
            }),
          ),
      ),
    );
    await expect(reconcileClubTestCheckout(createTRPCClient())).rejects.toThrow(
      "Не удалось проверить результат оплаты",
    );
    expect([...values.values()][0]).toBe(prior);
  },
);

it("corrupt return evidence prevents HTTP and is never replaced", async () => {
  values.set("daryadarcy:club-checkout:yookassa-test:v1", "corrupt");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(reconcileClubTestCheckout(createTRPCClient())).rejects.toThrow(
    "Сохранённую заявку",
  );
  expect(fetcher).not.toHaveBeenCalled();
  expect([...values.values()][0]).toBe("corrupt");
});

it.each(["session", "caller"])(
  "cancels an outstanding return on %s abort without rotating or retrying",
  async (source) => {
    await getClubCheckoutIntent(input);
    const prior = [...values.values()][0];
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) =>
        new Promise<Response>(() => {}),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const pending = reconcileClubTestCheckout(
      createTRPCClient(),
      controller.signal,
    ).catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    if (source === "session") cancelSessionRequests();
    else controller.abort();
    expect(await pending).toMatchObject({ cause: { kind: "cancelled" } });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect([...values.values()][0]).toBe(prior);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it("an already canceled return cannot read storage or dispatch", async () => {
  const controller = new AbortController();
  controller.abort();
  vi.stubGlobal("window", {
    isSecureContext: true,
    get localStorage() {
      throw new Error("SECRET");
    },
  });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    reconcileClubTestCheckout(createTRPCClient(), controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(["replaced", "removed", "corrupt"])(
  "does not apply a late success to %s browser evidence",
  async (change) => {
    await getClubCheckoutIntent(input);
    const fetcher = vi.fn(async () => {
      const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
      if (change === "removed") values.delete(storageKey);
      if (change === "corrupt") values.set(storageKey, "corrupt");
      if (change === "replaced")
        values.set(
          storageKey,
          JSON.stringify({
            ...JSON.parse(values.get(storageKey)!),
            idempotencyKey: secondKey,
          }),
        );
      return new Response(
        JSON.stringify({ result: { data: { json: { state: "succeeded" } } } }),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      reconcileClubTestCheckout(createTRPCClient()),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    if (change === "removed") expect(values.size).toBe(0);
    if (change === "corrupt") expect([...values.values()][0]).toBe("corrupt");
    if (change === "replaced")
      expect(JSON.parse([...values.values()][0]).idempotencyKey).toBe(
        secondKey,
      );
  },
);

it("a timed-out return leaves the same evidence for an explicit check, never a create/retry", async () => {
  await getClubCheckoutIntent(input);
  const prior = [...values.values()][0];
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const pending = reconcileClubTestCheckout(createTRPCClient()).catch(
    (error: unknown) => error,
  );
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(15_000);
  expect(await pending).toMatchObject({ cause: { kind: "timeout" } });
  expect([...values.values()][0]).toBe(prior);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
