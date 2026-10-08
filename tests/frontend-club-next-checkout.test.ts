import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getClubCheckoutIntent,
  reserveNextClubCheckoutIntent,
} from "../apps/frontend/src/features/club/checkout-intent";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
const selection = { email: " NEW@EXAMPLE.TEST ", plan: "semiannual" as const };
const reply = (json: unknown) =>
  new Response(JSON.stringify({ result: { data: { json } } }));
let values: Map<string, string>;
let storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};
let previousIdempotencyKey: string;
let prior: string;
let held: boolean;

beforeEach(async () => {
  values = new Map();
  storage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => {
      values.set(name, value);
    },
  };
  vi.stubGlobal("window", { isSecureContext: true, localStorage: storage });
  held = false;
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: () => unknown,
      ) => {
        held = true;
        try {
          return await callback();
        } finally {
          held = false;
        }
      },
    },
  });
  previousIdempotencyKey = (
    await getClubCheckoutIntent({ email: "prior@example.test" })
  ).idempotencyKey;
  prior = values.get(storageKey)!;
});
afterEach(() => {
  cancelSessionRequests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const reserve = (signal?: AbortSignal) =>
  reserveNextClubCheckoutIntent(
    createTRPCClient(),
    { previousIdempotencyKey, selection },
    signal,
  );

it.each(["succeeded", "canceled"])(
  "reserves a distinct durable selection only after fresh %s proof inside the exclusive lock",
  async (state) => {
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, _options?: RequestInit) => {
        expect(held).toBe(true);
        expect(values.get(storageKey)).toBe(prior);
        return reply({ state });
      },
    );
    vi.stubGlobal("fetch", fetcher);
    const next = await reserve();
    expect(next.idempotencyKey).not.toBe(previousIdempotencyKey);
    expect(next.input).toEqual({
      email: "new@example.test",
      plan: "semiannual",
    });
    const saved = JSON.parse(values.get(storageKey)!);
    expect(saved.idempotencyKey).toBe(next.idempotencyKey);
    expect(values.get(storageKey)).not.toContain("new@example");
    expect(await getClubCheckoutIntent(selection)).toEqual(next);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe("/api/trpc/club.reconcileCheckout");
    expect(options?.method).toBe("POST");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe(
      previousIdempotencyKey,
    );
    expect(String(options?.body)).not.toContain(previousIdempotencyKey);
    expect(String(options?.body)).not.toContain("example.test");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it.each(["pending", "unknown"])(
  "cannot replace a %s intent or trust elapsed time",
  async (state) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ state })),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-10-08T10:00:00Z"));
    await expect(reserve()).rejects.toMatchObject({ reason: "not-terminal" });
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each([{}, { state: "paid" }, { state: "succeeded", email: "SECRET" }])(
  "cannot replace evidence using malformed server proof (%#)",
  async (result) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(result)),
    );
    await expect(reserve()).rejects.toMatchObject({ reason: "unavailable" });
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each([403, 412, 429, 503])(
  "preserves evidence and HTTP status on %s refusal",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                json: {
                  message: "Запрос не выполнен.",
                  code: -32000,
                  data: { httpStatus: status, code: "FORBIDDEN" },
                },
              },
            }),
            { status, headers: { "Retry-After": "60" } },
          ),
      ),
    );
    await expect(reserve()).rejects.toMatchObject({
      data: { httpStatus: status },
    });
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each(["invalid", "8d427a00-4a92-4508-874c-b265d7e92d1c"])(
  "refuses stale/invalid expected keys before HTTP (%s)",
  async (expected) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      reserveNextClubCheckoutIntent(createTRPCClient(), {
        previousIdempotencyKey: expected,
        selection,
      }),
    ).rejects.toMatchObject({ reason: "stale-intent" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each(["absent", "corrupt"])(
  "%s evidence cannot create a next purchase",
  async (mode) => {
    if (mode === "absent") values.clear();
    else values.set(storageKey, "corrupt");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(reserve()).rejects.toMatchObject({
      reason: mode === "absent" ? "stale-intent" : "unreadable",
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(values.get(storageKey)).toBe(
      mode === "absent" ? undefined : "corrupt",
    );
  },
);

it.each(["removed", "replaced", "fingerprint"])(
  "does not overwrite %s evidence changed while checking the old payment",
  async (change) => {
    let modified: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (change === "removed") values.clear();
        else {
          const saved = JSON.parse(prior);
          if (change === "replaced")
            saved.idempotencyKey = "8d427a00-4a92-4508-874c-b265d7e92d1c";
          else saved.selectionHash = "a".repeat(64);
          modified = JSON.stringify(saved);
          values.set(storageKey, modified!);
        }
        return reply({ state: "canceled" });
      }),
    );
    await expect(reserve()).rejects.toMatchObject({ reason: "stale-intent" });
    expect(values.get(storageKey)).toBe(modified);
  },
);

it.each(["caller", "session"])(
  "%s abort during server proof preserves the old intent",
  async (source) => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const pending = reserve(controller.signal).catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    if (source === "caller") controller.abort();
    else cancelSessionRequests();
    expect(await pending).toMatchObject({ name: "AbortError" });
    expect(values.get(storageKey)).toBe(prior);
  },
);

it("session change during hashing cannot reserve or check under the next identity", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const pending = reserve().catch((error: unknown) => error);
  cancelSessionRequests();
  expect(await pending).toMatchObject({ name: "AbortError" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(values.get(storageKey)).toBe(prior);
});

it("a random UUID collision cannot replay the terminal payment as a new purchase", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply({ state: "canceled" })),
  );
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    previousIdempotencyKey as `${string}-${string}-${string}-${string}-${string}`,
  );
  await expect(reserve()).rejects.toMatchObject({ reason: "unavailable" });
  expect(values.get(storageKey)).toBe(prior);
});

it("lock acquisition expires after five seconds without checking or replacing evidence", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  let waiting: AbortSignal | undefined;
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: { signal: AbortSignal }) => {
        waiting = options.signal;
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(options.signal.reason),
          );
        });
      },
    },
  });
  const outcome = reserve().catch((error: unknown) => error);
  await vi.waitFor(() => expect(waiting).toBeDefined());
  await vi.advanceTimersByTimeAsync(5000);
  expect(await outcome).toMatchObject({ reason: "unavailable" });
  expect(fetcher).not.toHaveBeenCalled();
  expect(values.get(storageKey)).toBe(prior);
  expect(vi.getTimerCount()).toBe(0);
});

it("a denied write cannot erase the prior intent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply({ state: "canceled" })),
  );
  vi.spyOn(storage, "setItem").mockImplementation(() => {
    throw new Error("private storage detail");
  });
  await expect(reserve()).rejects.toMatchObject({ reason: "unavailable" });
  expect(values.get(storageKey)).toBe(prior);
});

it("failed readback never rolls back or dispatches the new durable intent", async () => {
  const fetcher = vi.fn(async () => reply({ state: "canceled" }));
  vi.stubGlobal("fetch", fetcher);
  const get = storage.getItem;
  vi.spyOn(storage, "getItem").mockImplementation((key) => {
    if (values.get(key) !== prior) throw new Error("private readback detail");
    return get(key);
  });
  await expect(reserve()).rejects.toMatchObject({ reason: "unavailable" });
  const saved = JSON.parse(values.get(storageKey)!);
  expect(saved.idempotencyKey).not.toBe(previousIdempotencyKey);
  vi.restoreAllMocks();
  expect((await getClubCheckoutIntent(selection)).idempotencyKey).toBe(
    saved.idempotencyKey,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
