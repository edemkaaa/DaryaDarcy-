import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AdminActionJournal,
  adminActionStorageKey,
} from "../apps/frontend/src/domain/session/admin-action-journal";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import {
  adminActionApi,
  parseAdminActionStatus,
  type AdminActionApi,
  type AdminActionRequest,
} from "../apps/frontend/src/shared/api/admin-actions";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
import type { AdminActionOutcome } from "../packages/shared/src/admin-action";
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "../apps/frontend/src/shared/api/contract";

let values: Map<string, string>;
let receipts: Map<string, AdminActionOutcome>;
let api: AdminActionApi;
let effects: number;
const signal = () => new AbortController().signal;
const outcome = (r: AdminActionRequest): AdminActionOutcome =>
  r.kind === "grantClub"
    ? {
        state: "succeeded",
        kind: r.kind,
        userId: r.userId,
        expiresAt: "2040-12-01T00:00:00.000Z",
      }
    : { state: "succeeded", kind: r.kind, userId: r.userId, queued: true };
beforeEach(() => {
  values = new Map();
  receipts = new Map();
  effects = 0;
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  let queue = Promise.resolve();
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _key: string,
        options: { signal: AbortSignal },
        callback: () => Promise<unknown>,
      ) => {
        const prior = queue;
        let release!: () => void;
        queue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await prior;
        try {
          options.signal.throwIfAborted();
          return await callback();
        } finally {
          release();
        }
      },
    },
  });
  setPersonalDataOwner(101);
  api = {
    status: vi.fn(
      async (r) =>
        receipts.get(r.idempotencyKey) ?? { state: "notFound" as const },
    ),
    write: vi.fn(async (r) => {
      // Verify durable identity/parameters BEFORE the server accepts anything.
      expect(JSON.parse(values.get(adminActionStorageKey(101))!)).toMatchObject(
        { ...r, ownerId: 101, attempted: true },
      );
      if (!receipts.has(r.idempotencyKey)) {
        effects++;
        receipts.set(r.idempotencyKey, outcome(r));
      }
      return receipts.get(r.idempotencyKey)!;
    }),
  };
});
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

for (const kind of ["grantClub", "resendAccessEmail"] as const) {
  it(`${kind}: lost committed response recovers after reload by reading only`, async () => {
    const write = api.write;
    api.write = vi.fn(async (r, s) => {
      await write(r, s);
      throw new TypeError("lost ACK");
    });
    await expect(
      new AdminActionJournal(101, api).start(
        kind,
        201,
        null,
        undefined,
        signal(),
      ),
    ).rejects.toThrow("lost ACK");
    const saved = new AdminActionJournal(101, api).read()!;
    expect(saved.outcome).toBeUndefined();
    const restored = await new AdminActionJournal(101, api).check(
      null,
      signal(),
    );
    expect(restored?.idempotencyKey).toBe(saved.idempotencyKey);
    expect(restored?.outcome).toEqual(outcome(saved));
    expect(effects).toBe(1);
    expect(api.write).toHaveBeenCalledTimes(1);
    await new AdminActionJournal(101, api).replay(restored!, signal());
    expect(api.write).toHaveBeenCalledTimes(1);
  });
  it(`${kind}: notFound retains original key and parameters for explicit replay`, async () => {
    const write = api.write;
    api.write = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("not received"))
      .mockImplementation(write);
    const journal = new AdminActionJournal(101, api);
    await expect(
      journal.start(kind, 201, null, undefined, signal()),
    ).rejects.toThrow();
    const saved = journal.read()!;
    expect((await journal.check(saved, signal()))?.outcome).toBeUndefined();
    // Another target is blocked while the saved intent is unresolved.
    expect(
      (await journal.start(kind, 999, saved, undefined, signal()))?.userId,
    ).toBe(201);
    expect(api.write).toHaveBeenCalledTimes(1);
    const result = await new AdminActionJournal(101, api).replay(
      saved,
      signal(),
    );
    expect(result?.idempotencyKey).toBe(saved.idempotencyKey);
    expect(api.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: 201,
        kind,
        idempotencyKey: saved.idempotencyKey,
      }),
      expect.anything(),
    );
    expect(effects).toBe(1);
  });
  it(`${kind}: two tabs share one intent; only an acknowledged new action gets another key`, async () => {
    const a = new AdminActionJournal(101, api),
      b = new AdminActionJournal(101, api);
    const [first, second] = await Promise.all([
      a.start(kind, 201, null, undefined, signal()),
      b.start(kind, 201, null, undefined, signal()),
    ]);
    expect(first?.idempotencyKey).toBe(second?.idempotencyKey);
    expect(effects).toBe(1);
    const third = await b.start(
      kind,
      202,
      second,
      second?.idempotencyKey,
      signal(),
    );
    expect(third?.idempotencyKey).not.toBe(first?.idempotencyKey);
    expect(effects).toBe(2);
  });
}

for (const fault of [
  "write",
  "read",
  "corrupt",
  "locks",
  "insecure",
  "verify",
] as const) {
  it(`fails closed on ${fault} storage/coordination failure`, async () => {
    if (fault === "write")
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw Error("quota");
      });
    if (fault === "read")
      vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
        throw Error("denied");
      });
    if (fault === "corrupt")
      values.set(adminActionStorageKey(101), "{bad json");
    if (fault === "locks") vi.stubGlobal("navigator", {});
    if (fault === "insecure") Object.assign(window, { isSecureContext: false });
    if (fault === "verify")
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {});
    await expect(
      new AdminActionJournal(101, api).start(
        "grantClub",
        201,
        null,
        undefined,
        signal(),
      ),
    ).rejects.toThrow();
    expect(api.write).not.toHaveBeenCalled();
  });
}

it("does not replace an intent that disappeared while this tab retained it", async () => {
  const journal = new AdminActionJournal(101, api);
  const first = await journal.start(
    "grantClub",
    201,
    null,
    undefined,
    signal(),
  );
  values.delete(adminActionStorageKey(101));
  await expect(
    journal.start("grantClub", 201, first, first?.idempotencyKey, signal()),
  ).rejects.toThrow("потеряно");
  expect(effects).toBe(1);
});

it("does not apply a late reply to another account; the original actor can recover later", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = api.write;
  api.write = vi.fn(async (r, s) => {
    const result = await write(r, s);
    await held;
    return result;
  });
  const journal = new AdminActionJournal(101, api);
  const request = journal.start("grantClub", 201, null, undefined, signal());
  await vi.waitFor(() => expect(effects).toBe(1));
  setPersonalDataOwner(102);
  release();
  await expect(request).rejects.toThrow();
  expect(new AdminActionJournal(102, api).read()).toBeNull();
  setPersonalDataOwner(101);
  expect((await journal.check(null, signal()))?.outcome?.state).toBe(
    "succeeded",
  );
});

it("ignores a reply after cancellation without discarding the saved key", async () => {
  const controller = new AbortController();
  api.write = vi.fn(async (r) => {
    controller.abort();
    return outcome(r);
  });
  const journal = new AdminActionJournal(101, api);
  await expect(
    journal.start("grantClub", 201, null, undefined, controller.signal),
  ).rejects.toThrow();
  expect(journal.read()?.outcome).toBeUndefined();
  expect(journal.read()?.attempted).toBe(true);
});

it("persists rate limit across reload, permits status and forbids early email replay", async () => {
  vi.useFakeTimers();
  const write = api.write;
  api.write = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("limit", 429, 2))
    .mockImplementation(write);
  const journal = new AdminActionJournal(101, api);
  await expect(
    journal.start("resendAccessEmail", 201, null, undefined, signal()),
  ).rejects.toThrow("limit");
  const saved = journal.read()!;
  expect(saved.retryAt).toBe(Date.now() + 2000);
  await journal.check(saved, signal());
  await expect(
    new AdminActionJournal(101, api).replay(saved, signal()),
  ).rejects.toThrow("задержку");
  expect(api.write).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(2001);
  await journal.replay(saved, signal());
  expect(api.write).toHaveBeenCalledTimes(2);
  expect(effects).toBe(1);
});

it("a conflict is resolved by its durable refusal, never by an automatic new key", async () => {
  api.write = vi.fn(async (r) => {
    receipts.set(r.idempotencyKey, {
      state: "rejected",
      kind: r.kind,
      userId: r.userId,
      code: "CONFLICT",
    });
    throw new ApiError("conflict", 409);
  });
  const result = await new AdminActionJournal(101, api).start(
    "grantClub",
    201,
    null,
    undefined,
    signal(),
  );
  expect(result?.outcome?.state).toBe("rejected");
  expect(api.write).toHaveBeenCalledTimes(1);
});

it.each([
  {},
  { state: "pending" },
  { state: "succeeded", kind: "resendAccessEmail", userId: 202, queued: true },
  { state: "succeeded", kind: "grantClub", userId: 201, expiresAt: "bad" },
])("rejects mismatched/malformed status %j", (value) => {
  expect(() =>
    parseAdminActionStatus(value, {
      kind: "resendAccessEmail",
      userId: 201,
      idempotencyKey: crypto.randomUUID(),
    }),
  ).toThrow();
});

it("API adapter sends the saved UUID via both transports and validates the actual receipt", async () => {
  const request = {
    kind: "grantClub" as const,
    userId: 201,
    idempotencyKey: crypto.randomUUID(),
  };
  const mutate = vi
    .fn()
    .mockResolvedValue({ ok: true, expiresAt: "2040-12-01T00:00:00.000Z" });
  const query = vi.fn().mockResolvedValue({ state: "notFound" });
  const client = {
    admin: { grantClub: { mutate }, actionStatus: { query } },
  } as unknown as TRPCClient<AppRouter>;
  const adapter = adminActionApi(client);
  const s = signal();
  expect(await adapter.write(request, s)).toEqual(outcome(request));
  expect(mutate).toHaveBeenCalledWith(
    { userId: 201, idempotencyKey: request.idempotencyKey },
    { signal: s },
  );
  await adapter.status(request, s);
  expect(query).toHaveBeenCalledWith(
    { idempotencyKey: request.idempotencyKey },
    { signal: s },
  );
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ queued: true }), { status: 202 }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(
    await adapter.write({ ...request, kind: "resendAccessEmail" }, s),
  ).toMatchObject({ queued: true });
  const init = fetch.mock.calls[0][1] as RequestInit;
  expect(JSON.parse(init.body as string)).toEqual({
    userId: 201,
    idempotencyKey: request.idempotencyKey,
  });
  fetch.mockResolvedValue(
    new Response(JSON.stringify({ queued: true }), { status: 200 }),
  );
  await expect(
    adapter.write({ ...request, kind: "resendAccessEmail" }, s),
  ).rejects.toThrow();
});
