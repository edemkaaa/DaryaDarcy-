import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { LegacyCheckoutJournal } from "../apps/frontend/src/features/club/legacy-checkout-journal";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

let values: Map<string, string>;
let queue: Promise<unknown>;
const signal = () => new AbortController().signal;
const journal = (mode: "legacy" | "prodamus-test" = "legacy") =>
  new LegacyCheckoutJournal(null, mode);
beforeEach(() => {
  values = new Map();
  queue = Promise.resolve();
  vi.stubGlobal("window", {
    isSecureContext: true,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: (_name: string, _options: unknown, callback: () => unknown) => {
        const result = queue.then(callback);
        queue = result.catch(() => undefined);
        return result;
      },
    },
  });
  setPersonalDataOwner(null);
});
afterEach(() => {
  setPersonalDataOwner(null);
  vi.unstubAllGlobals();
});

for (const mode of ["legacy", "prodamus-test"] as const) {
  it(`${mode}: persists uncertainty before HTTP and preserves it through reload`, async () => {
    const send = vi.fn(async () => {
      expect(journal(mode).read()?.state).toBe("unknown");
      throw new TypeError("Lost ACK");
    });
    await expect(
      journal(mode).submit(null, false, signal(), send),
    ).rejects.toThrow();
    const intent = journal(mode).read()!;
    expect(intent.state).toBe("unknown");
    const replay = vi.fn(async () => "another order");
    await expect(
      journal(mode).submit(intent.id, false, signal(), replay),
    ).rejects.toThrow();
    expect(replay).not.toHaveBeenCalled();
    expect(journal(mode).read()).toEqual(intent);
  });
}
it("a simultaneous tab cannot silently create another order, even after a successful first ACK", async () => {
  const send = vi.fn(async () => "url");
  const results = await Promise.allSettled([
    journal().submit(null, false, signal(), send),
    journal().submit(null, false, signal(), send),
  ]);
  expect(results.map((result) => result.status)).toEqual([
    "fulfilled",
    "rejected",
  ]);
  expect(send).toHaveBeenCalledTimes(1);
  expect(journal().read()?.state).toBe("acknowledged");
});
it("an explicitly authorised replacement rotates only the known unknown attempt", async () => {
  await expect(
    journal().submit(null, false, signal(), async () => {
      throw Error();
    }),
  ).rejects.toThrow();
  const first = journal().read()!;
  await journal().submit(
    first.id,
    true,
    signal(),
    async () => "new explicit order",
  );
  expect(journal().read()?.id).not.toBe(first.id);
});
it("replacement consent cannot replace an attempt that changed in another tab", async () => {
  await expect(
    journal().submit(null, false, signal(), async () => {
      throw Error();
    }),
  ).rejects.toThrow();
  const first = journal().read()!;
  await expect(
    journal().submit(first.id, true, signal(), async () => {
      throw Error();
    }),
  ).rejects.toThrow();
  const send = vi.fn(async () => "wrong replacement");
  await expect(
    journal().submit(first.id, true, signal(), send),
  ).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
it.each(["storage-write", "corrupt", "no-locks"])(
  "%s blocks payment creation",
  async (fault) => {
    if (fault === "storage-write")
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw Error("quota");
      });
    if (fault === "corrupt") values.set(journal().storageKey, "broken");
    if (fault === "no-locks") vi.stubGlobal("navigator", {});
    const send = vi.fn(async () => "url");
    await expect(
      journal().submit(null, false, signal(), send),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  },
);
it("a failed acknowledgement write keeps uncertainty despite successful creation", async () => {
  const send = async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw Error("quota");
    });
    return "received url";
  };
  await expect(journal().submit(null, false, signal(), send)).rejects.toThrow();
  expect(journal().read()?.state).toBe("unknown");
});
it("a late response cannot acknowledge the original attempt under another account", async () => {
  await expect(
    journal().submit(null, false, signal(), async () => {
      setPersonalDataOwner(502);
      return "late url";
    }),
  ).rejects.toThrow();
  setPersonalDataOwner(null);
  expect(journal().read()?.state).toBe("unknown");
});
it("TEST and legacy use separate namespaces and never store contacts, URLs or provider proof", async () => {
  await journal().submit(
    null,
    false,
    signal(),
    async () => "https://private-url",
  );
  expect(journal("prodamus-test").read()).toBeNull();
  expect([...values.values()].join()).not.toMatch(
    /https:|email|phone|token|orderId/,
  );
});
it("a decoded tRPC 400 confirms rejection, while a proxy 400 remains uncertain", async () => {
  const decoded = new TRPCClientError("refusal", {
    result: {
      error: { message: "refusal", code: -32600, data: { httpStatus: 400 } },
    },
  });
  await expect(
    journal().submit(null, false, signal(), async () => {
      throw decoded;
    }),
  ).rejects.toThrow();
  expect(journal().read()?.state).toBe("rejected");
  await expect(
    journal("prodamus-test").submit(null, false, signal(), async () => {
      throw new ApiError("proxy", 400);
    }),
  ).rejects.toThrow();
  expect(journal("prodamus-test").read()?.state).toBe("unknown");
});
