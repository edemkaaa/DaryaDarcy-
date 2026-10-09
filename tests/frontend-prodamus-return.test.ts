import { afterEach, expect, it, vi } from "vitest";
import {
  readProdamusReturnToken,
  readProdamusReturnResult,
  pollProdamusReturnResult,
} from "../apps/frontend/src/features/club/prodamus-return-api";

const token =
  "club-test-101-00000000-0000-4000-8000-000000000001.1792000000." +
  "a".repeat(64);
const pending = { state: "pending", nextAction: null, emailStatus: null };
const succeeded = {
  state: "succeeded",
  nextAction: "setup",
  emailStatus: "pending",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("extracts the order reference only from its dedicated return fragment", () => {
  expect(readProdamusReturnToken(`#paymentReturn=${token}`)).toBe(token);
});
it.each([
  "",
  "#paid=1",
  `?paymentReturn=${token}`,
  `#token=${token}`,
  `#paymentReturn=${token}&paid=1`,
  `#paymentReturn=${token}&paymentReturn=${token}`,
  `#paymentReturn=${token}\n`,
  `#paymentReturn=${token.replace("club-test-", "shop-")}`,
  `#paymentReturn=${token.replace("4000", "5000")}`,
])(
  "does not interpret an unrelated or malformed hint as a reference (%s)",
  (hash) => {
    expect(readProdamusReturnToken(hash)).toBeNull();
  },
);

it("reads the exact result endpoint without cookies, redirects or caching", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(pending)));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    readProdamusReturnResult(token, new AbortController().signal),
  ).resolves.toEqual(pending);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    "/api/prodamus/test/result",
    expect.objectContaining({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
});
it.each([
  pending,
  { state: "unknown", nextAction: null, emailStatus: null },
  succeeded,
  { ...succeeded, nextAction: "login", emailStatus: "sent" },
  { ...succeeded, emailStatus: "unavailable" },
])(
  "preserves the server's explicit result without inventing sent mail (%j)",
  async (value) => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(value)));
    await expect(
      readProdamusReturnResult(token, new AbortController().signal),
    ).resolves.toEqual(value);
  },
);
it.each([
  null,
  {},
  { state: "succeeded" },
  { ...succeeded, user: { id: 101 } },
  { ...succeeded, nextAction: "authenticate" },
  { ...succeeded, emailStatus: "delivered" },
  { ...pending, nextAction: "setup", emailStatus: "sent" },
  { state: "paid", nextAction: null, emailStatus: null },
])("rejects malformed or identity-bearing results (%j)", async (value) => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify(value)));
  await expect(
    readProdamusReturnResult(token, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "invalid-response" });
});
it("does not expose a server error body or retry a refused request", async () => {
  const fetcher = vi.fn(
    async () => new Response("PRIVATE_DETAIL", { status: 503 }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    readProdamusReturnResult(token, new AbortController().signal),
  ).rejects.toMatchObject({
    status: 503,
    message: "Сервис временно недоступен. Попробуйте ещё раз.",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("refuses an invalid reference before any request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    readProdamusReturnResult("paid=1", new AbortController().signal),
  ).rejects.toMatchObject({ kind: "invalid-response" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("bounds reading a hung response body", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    json: () => new Promise(() => {}),
  }));
  const rejected = expect(
    readProdamusReturnResult(token, new AbortController().signal),
  ).rejects.toMatchObject({ kind: "timeout" });
  await vi.advanceTimersByTimeAsync(15_001);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels without accepting a late payment response", async () => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  const controller = new AbortController();
  const rejected = expect(
    readProdamusReturnResult(token, controller.signal),
  ).rejects.toMatchObject({ kind: "cancelled" });
  controller.abort();
  await rejected;
});

it("stops after a verified order rather than requesting another payment", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(succeeded)));
  vi.stubGlobal("fetch", fetcher);
  await expect(
    pollProdamusReturnResult(token, new AbortController().signal),
  ).resolves.toEqual(succeeded);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("stops pending polling within six serial reads", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => new Response(JSON.stringify(pending)));
  vi.stubGlobal("fetch", fetcher);
  const result = pollProdamusReturnResult(token, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(30_001);
  await expect(result).resolves.toEqual(pending);
  expect(fetcher).toHaveBeenCalledTimes(6);
  expect(vi.getTimerCount()).toBe(0);
});
it("does not poll errors, including rate limiting", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response("PRIVATE", {
        status: 429,
        headers: { "Retry-After": "45" },
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    pollProdamusReturnResult(token, new AbortController().signal),
  ).rejects.toMatchObject({ status: 429, retryAfterSec: 45 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
