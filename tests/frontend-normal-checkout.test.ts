import { afterEach, beforeEach, expect, it, vi } from "vitest";
import superjson from "superjson";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import {
  NormalCheckoutJournal,
  checkNormalCheckout,
  createNormalCheckout,
  parseNormalCheckoutStatus,
  parseNormalCheckoutResult,
} from "../apps/frontend/src/features/club/normal-checkout";

let values: Map<string, string>;
let response: unknown;
const expiration = new Date("2040-11-01T10:00:00Z");
const slot = "darcy:user:101:normal-checkout:v1";
const signal = () => new AbortController().signal;
const fetcher = vi.fn(
  async (_url: RequestInfo | URL, _options?: RequestInit) => {
    const serialized = { result: { data: superjson.serialize(response) } };
    return new Response(
      JSON.stringify(
        new URL(String(_url), "https://app.example.test").searchParams.has(
          "batch",
        )
          ? [serialized]
          : serialized,
      ),
    );
  },
);
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => values.set(name, value),
      removeItem: (name: string) => values.delete(name),
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: async (_name: string, _options: unknown, work: () => unknown) =>
        work(),
    },
  });
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockClear();
  setPersonalDataOwner(101);
  response = {
    state: "pending",
    orderId: "order-one",
    url: "https://payments.example.test/normal",
  };
});
afterEach(() => {
  cancelSessionRequests();
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});

it("persists a lowercase UUID and the account's plan before POST, without the TEST header or email", async () => {
  const journal = new NormalCheckoutJournal(101);
  const intent = await journal.prepare(signal(), "+79991234567");
  expect(JSON.parse(values.get(slot)!)).toEqual(intent);
  expect(intent.idempotencyKey).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const result = await createNormalCheckout(
    createTRPCClient(),
    journal,
    intent,
    signal(),
  );
  expect(result.result).toEqual(response);
  const [url, options] = fetcher.mock.calls[0];
  expect(new URL(String(url), "https://app.example.test").pathname).toBe(
    "/api/trpc/club.createNormalCheckout",
  );
  expect(options?.method).toBe("POST");
  expect(new Headers(options?.headers).has("Idempotency-Key")).toBe(false);
  expect(JSON.parse(String(options?.body))).toEqual({
    0: { json: { idempotencyKey: intent.idempotencyKey, plan: "monthly", contactPhone: "+79991234567" } },
  });
  expect([...values.values()].join()).not.toMatch(
    /https|email|signature|expiresAt/,
  );
});
it("reload keeps the key and selected plan instead of reserving a new purchase", async () => {
  const first = await new NormalCheckoutJournal(101).prepare(signal(), "+79991234567");
  const encoded = { ...first, plan: "semiannual" };
  values.set(slot, JSON.stringify(encoded));
  const restored = await new NormalCheckoutJournal(101).prepare(signal(), "+79991234567");
  expect(restored).toEqual(encoded);
  await createNormalCheckout(
    createTRPCClient(),
    new NormalCheckoutJournal(101),
    restored,
    signal(),
  );
  expect(String(fetcher.mock.calls[0][1]?.body)).toContain(
    '"plan":"semiannual"',
  );
});
it("checks only the saved key with GET and accepts a Date through SuperJSON", async () => {
  const journal = new NormalCheckoutJournal(101);
  const intent = await journal.prepare(signal(), "+79991234567");
  response = {
    state: "succeeded",
    orderId: "order-one",
    expiresAt: expiration,
  };
  const reply = await checkNormalCheckout(
    createTRPCClient(),
    journal,
    intent,
    signal(),
  );
  expect(reply.result).toEqual(response);
  expect(
    new URL(String(fetcher.mock.calls[0][0]), "https://app.example.test")
      .pathname,
  ).toBe("/api/trpc/club.normalCheckoutStatus");
  expect(fetcher.mock.calls[0][1]?.method).not.toBe("POST");
  expect(values.get(slot)).not.toContain("expiresAt");
});
it.each(["notRecorded", "pending"] as const)(
  "%s cannot rotate the saved purchase",
  async (state) => {
    const journal = new NormalCheckoutJournal(101);
    const intent = await journal.prepare(signal(), "+79991234567");
    const before = values.get(slot);
    response =
      state === "notRecorded" ? { state } : { state, orderId: "order-one" };
    await expect(
      journal.next(createTRPCClient(), intent, signal(), "+79991234567"),
    ).rejects.toThrow("ещё не завершена");
    expect(values.get(slot)).toBe(before);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it.each(["succeeded", "failed"] as const)(
  "a deliberate next purchase verifies fresh %s before creating its distinct key",
  async (state) => {
    const journal = new NormalCheckoutJournal(101);
    const first = await journal.prepare(signal(), "+79991234567");
    response =
      state === "succeeded"
        ? { state, orderId: "order-one", expiresAt: expiration }
        : { state, orderId: "order-one" };
    const next = await journal.next(createTRPCClient(), first, signal(), "+79991234567");
    expect(next.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(next).not.toHaveProperty("orderId");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.method).not.toBe("POST");
  },
);
it("an order mismatch never turns another purchase into this intent's successful result", async () => {
  const journal = new NormalCheckoutJournal(101);
  const first = await journal.prepare(signal(), "+79991234567");
  await createNormalCheckout(createTRPCClient(), journal, first, signal());
  response = {
    state: "succeeded",
    orderId: "different-order",
    expiresAt: expiration,
  };
  await expect(
    checkNormalCheckout(createTRPCClient(), journal, first, signal()),
  ).rejects.toThrow("Некорректный ответ");
  await expect(
    journal.next(createTRPCClient(), first, signal(), "+79991234567"),
  ).rejects.toThrow("Некорректный ответ");
  expect(journal.read()?.idempotencyKey).toBe(first.idempotencyKey);
});
it("a change of account prevents dispatch of the previous account's intent", async () => {
  const journal = new NormalCheckoutJournal(101);
  const intent = await journal.prepare(signal(), "+79991234567");
  setPersonalDataOwner(102);
  await expect(
    createNormalCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  expect(new NormalCheckoutJournal(102).read()).toBeNull();
});
it("a late response cannot bind an order to a replaced browser intent", async () => {
  const journal = new NormalCheckoutJournal(101);
  const intent = await journal.prepare(signal(), "+79991234567");
  fetcher.mockImplementationOnce(async () => {
    values.set(
      slot,
      JSON.stringify({
        ...intent,
        idempotencyKey: "00000000-0000-4000-8000-000000000001",
      }),
    );
    return new Response(
      JSON.stringify([{ result: { data: superjson.serialize(response) } }]),
    );
  });
  await expect(
    createNormalCheckout(createTRPCClient(), journal, intent, signal()),
  ).rejects.toThrow("изменилась");
  expect(JSON.parse(values.get(slot)!)).not.toHaveProperty("orderId");
});
it("corrupt evidence is never overwritten by a temporary key", async () => {
  values.set(slot, "corrupt");
  await expect(
    new NormalCheckoutJournal(101).prepare(signal(), "+79991234567"),
  ).rejects.toThrow();
  expect(values.get(slot)).toBe("corrupt");
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  null,
  {},
  { state: "paid" },
  { state: "succeeded", orderId: "x", expiresAt: "2040-11-01T10:00:00Z" },
  { state: "succeeded", orderId: "x", expiresAt: new Date(NaN) },
  { state: "pending", orderId: "x", url: "https://payments.example.test" },
])("malformed status cannot confirm payment (%#)", (value) => {
  expect(() => parseNormalCheckoutStatus(value)).toThrow();
});
it.each([
  null,
  {},
  { state: "pending", orderId: "x", url: "javascript:alert(1)" },
  { state: "pending", orderId: "x", url: "http://payments.example.test" },
  { state: "pending", orderId: "", url: "https://payments.example.test" },
])("malformed create reply never opens a payment URL (%#)", (value) => {
  expect(() => parseNormalCheckoutResult(value)).toThrow();
});

it("freezes the unverified contact through a lost response and rejects a changed contact", async () => {
  const journal = new NormalCheckoutJournal(101);
  const intent = await journal.prepare(signal(), "8 (999) 123-45-67");
  expect(intent.contactPhone).toBe("+79991234567");
  await expect(journal.prepare(signal(), "+447700900123")).resolves.toEqual(intent);
  values.set(slot, JSON.stringify({ ...intent, contactPhone: "+447700900123" }));
  expect(() => journal.requireCurrent(intent, signal())).toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
