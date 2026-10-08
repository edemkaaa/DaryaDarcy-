import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  getClubCheckoutIntent,
  readSavedClubCheckoutIntent,
} from "../apps/frontend/src/features/club/checkout-intent";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
const selection = { email: "buyer@example.test" };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let values: Map<string, string>;
let storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

beforeEach(() => {
  values = new Map();
  storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal("window", { isSecureContext: true, localStorage: storage });
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("a return without saved evidence cannot reserve or write a purchase", () => {
  expect(readSavedClubCheckoutIntent()).toBeNull();
  expect(values.size).toBe(0);
});

it("reads only the saved key after reload without needing the buyer's email, locks or key generation", async () => {
  const intent = await getClubCheckoutIntent(selection);
  const before = values.get(storageKey);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("crypto", undefined);
  expect(readSavedClubCheckoutIntent()).toEqual({
    idempotencyKey: intent.idempotencyKey,
  });
  expect(values.get(storageKey)).toBe(before);
});

it.each(["", "null", "{", "x".repeat(1025)])(
  "read-only return preserves malformed evidence (%#)",
  (prior) => {
    values.set(storageKey, prior);
    expect(() => readSavedClubCheckoutIntent()).toThrow("Сохранённую заявку");
    expect(values.get(storageKey)).toBe(prior);
  },
);

it("read-only return refuses extra fields without exposing browser details", () => {
  const prior = JSON.stringify({
    version: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    selectionHash: "a".repeat(64),
    state: "succeeded",
  });
  values.set(storageKey, prior);
  expect(() => readSavedClubCheckoutIntent()).toThrow("Сохранённую заявку");
  expect(values.get(storageKey)).toBe(prior);
  storage.getItem = () => {
    throw new Error("SECRET storage failure");
  };
  expect(() => readSavedClubCheckoutIntent()).toThrow("Браузер не может");
  expect(() => readSavedClubCheckoutIntent()).not.toThrow("SECRET");
});

it.each(["server", "insecure"])(
  "read-only return refuses an unavailable browser (%s)",
  (mode) => {
    vi.stubGlobal(
      "window",
      mode === "server"
        ? undefined
        : {
            isSecureContext: false,
            localStorage: storage,
          },
    );
    expect(() => readSavedClubCheckoutIntent()).toThrow("Браузер не может");
    expect(values.size).toBe(0);
  },
);

it("persists before returning a UUID and canonical input, never the email or payment URL", async () => {
  const intent = await getClubCheckoutIntent({ email: " Buyer@Example.Test " });
  expect(intent.idempotencyKey).toMatch(uuid);
  expect(intent.input).toEqual({
    email: "buyer@example.test",
    plan: "monthly",
  });
  const record = JSON.parse(values.get(storageKey)!);
  expect(record).toEqual({
    version: 1,
    idempotencyKey: intent.idempotencyKey,
    selectionHash: expect.stringMatching(/^[0-9a-f]{64}$/),
  });
  expect(values.get(storageKey)).not.toContain("buyer");
  expect(values.size).toBe(1);
});

it("reuses the persisted identity across independent calls, normalization and arbitrary elapsed time", async () => {
  const first = await getClubCheckoutIntent(selection);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-10-08T10:00:00Z"));
  const second = await getClubCheckoutIntent({
    email: " BUYER@EXAMPLE.TEST ",
    plan: "monthly",
  });
  expect(second).toEqual(first);
});

it("preserves a written key when readback throws, allowing a safe later retry", async () => {
  const normalRead = storage.getItem;
  let reads = 0;
  storage.getItem = (key) => {
    if (++reads === 2) throw new Error("Private readback failure");
    return normalRead(key);
  };
  await expect(getClubCheckoutIntent(selection)).rejects.toMatchObject({
    reason: "unavailable",
  });
  const saved = JSON.parse(values.get(storageKey)!);
  storage.getItem = normalRead;
  expect((await getClubCheckoutIntent(selection)).idempotencyKey).toBe(
    saved.idempotencyKey,
  );
});

it("reserves the requested semiannual purchase rather than silently using monthly", async () => {
  const intent = await getClubCheckoutIntent({
    ...selection,
    plan: "semiannual",
  });
  expect(intent.input.plan).toBe("semiannual");
  expect(
    await getClubCheckoutIntent({ ...selection, plan: "semiannual" }),
  ).toEqual(intent);
});

it.each([
  { email: "other@example.test" },
  { ...selection, plan: "semiannual" as const },
])(
  "refuses a changed selection without overwriting an unresolved purchase: %j",
  async (changed) => {
    await getClubCheckoutIntent(selection);
    const prior = values.get(storageKey);
    await expect(getClubCheckoutIntent(changed)).rejects.toMatchObject({
      reason: "selection-conflict",
    });
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each(["", "no-address", "x@", `${"x".repeat(250)}@example.test`])(
  "rejects invalid email before reserving an intent: %s",
  async (email) => {
    await expect(getClubCheckoutIntent({ email })).rejects.toMatchObject({
      reason: "invalid-selection",
    });
    expect(values.size).toBe(0);
  },
);

it.each([
  "",
  "{",
  "null",
  "[]",
  "x".repeat(1025),
  JSON.stringify({
    version: 2,
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    selectionHash: "a".repeat(64),
  }),
  JSON.stringify({
    version: 1,
    idempotencyKey: "not-a-uuid",
    selectionHash: "a".repeat(64),
  }),
  JSON.stringify({
    version: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    selectionHash: "invalid",
  }),
  JSON.stringify({
    version: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    selectionHash: "a".repeat(64),
    email: "private@example.test",
  }),
])(
  "does not erase or replace malformed persisted evidence (%#)",
  async (prior) => {
    values.set(storageKey, prior);
    await expect(getClubCheckoutIntent(selection)).rejects.toMatchObject({
      reason: "unreadable",
    });
    expect(() => readSavedClubCheckoutIntent()).toThrow("Сохранённую заявку");
    expect(values.get(storageKey)).toBe(prior);
  },
);

it.each(["read", "write", "readback", "storage-access"])(
  "fails closed on %s failure; never falls back to an in-memory UUID",
  async (mode) => {
    const failure = () => {
      throw new Error("SECRET browser details");
    };
    if (mode === "read") storage.getItem = failure;
    if (mode === "write") storage.setItem = failure;
    if (mode === "readback") storage.setItem = () => {};
    if (mode === "storage-access")
      Object.defineProperty(window, "localStorage", { get: failure });
    await expect(getClubCheckoutIntent(selection)).rejects.toMatchObject({
      reason: "unavailable",
    });
    await expect(getClubCheckoutIntent(selection)).rejects.not.toThrow(
      "SECRET",
    );
    expect(values.size).toBe(0);
  },
);

it.each(["insecure", "server", "locks", "crypto", "hash", "uuid"])(
  "refuses missing browser support (%s) before saving or returning a key",
  async (mode) => {
    if (mode === "insecure")
      vi.stubGlobal("window", {
        isSecureContext: false,
        localStorage: storage,
      });
    if (mode === "server") vi.stubGlobal("window", undefined);
    if (mode === "locks") vi.stubGlobal("navigator", {});
    if (mode === "crypto") vi.stubGlobal("crypto", undefined);
    if (mode === "hash") vi.stubGlobal("crypto", { randomUUID: () => "bad" });
    if (mode === "uuid") vi.stubGlobal("crypto", { subtle: crypto.subtle });
    await expect(getClubCheckoutIntent(selection)).rejects.toMatchObject({
      reason: "unavailable",
    });
    expect(values.size).toBe(0);
  },
);

it("limits waiting for another tab's lock and does not issue an unlocked intent", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    },
  });
  const waiting = getClubCheckoutIntent(selection).catch(
    (error: unknown) => error,
  );
  // Fingerprinting uses the real asynchronous Web Crypto implementation.
  await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
  await vi.advanceTimersByTimeAsync(5000);
  expect(await waiting).toMatchObject({ reason: "unavailable" });
  expect(values.size).toBe(0);
});
