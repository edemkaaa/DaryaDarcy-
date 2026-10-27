import { afterEach, expect, it, vi } from "vitest";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";

afterEach(() => {
  cancelSessionRequests();
  vi.unstubAllGlobals();
});
const groups = Array.from({ length: 20 }, (_, i) =>
  Array.from({ length: 50 }, (_, j) => 100000 + i * 50 + j),
);

it("sends a full two-month calendar alone without rejecting it at the ordinary batch limit", async () => {
  const days = Array.from({ length: 62 }, (_, i) => ({
    from: new Date(Date.UTC(2026, 9, i + 1)).toISOString(),
    to: new Date(Date.UTC(2026, 9, i + 2)).toISOString(),
  }));
  const fetcher = vi.fn(async (raw: RequestInfo | URL) => {
    const url = new URL(String(raw), "https://app.test");
    if (url.pathname.endsWith("admin.postCalendar"))
      return Response.json([
        { result: { data: { json: { days: [], upcoming: [] } } } },
      ]);
    return response(raw);
  });
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const [calendar, interactions] = await Promise.all([
    client.admin.postCalendar.query({ days }),
    client.feed.interactionsForPosts.query({ postIds: [10] }),
  ]);
  expect(calendar).toEqual({ days: [], upcoming: [] });
  expect(interactions.likedIds).toEqual([10]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const request = fetcher.mock.calls
    .map(([raw]) => new URL(String(raw), "https://app.test"))
    .find((url) => url.pathname.endsWith("admin.postCalendar"))!;
  expect(request.pathname).not.toContain(",");
  expect(request.href.length).toBeLessThanOrEqual(8192);
  expect(JSON.parse(request.searchParams.get("input")!)).toEqual({
    0: { json: { days } },
  });
});
function response(raw: RequestInfo | URL) {
  const url = new URL(String(raw), "https://app.test");
  const inputs = JSON.parse(url.searchParams.get("input")!);
  return Response.json(
    Object.values(inputs).map((value) => ({
      result: {
        data: {
          json: {
            likedIds: (value as { json: { postIds: number[] } }).json.postIds,
            savedIds: [],
          },
        },
      },
    })),
  );
}

it("splits real client GET batches at 2048 bytes without losing, duplicating or misrouting replies", async () => {
  const fetcher = vi.fn(async (raw: RequestInfo | URL) => response(raw));
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const results = await Promise.all(
    groups.map((postIds) =>
      client.feed.interactionsForPosts.query({ postIds }),
    ),
  );
  expect(results.map((result) => result.likedIds)).toEqual(groups);
  expect(fetcher.mock.calls.length).toBeGreaterThan(1);
  const sent: number[][] = [];
  for (const [raw] of fetcher.mock.calls) {
    expect(Buffer.byteLength(String(raw))).toBeLessThanOrEqual(2048);
    const url = new URL(String(raw), "https://app.test");
    const inputs = JSON.parse(url.searchParams.get("input")!);
    sent.push(
      ...Object.values(inputs).map(
        (value) => (value as { json: { postIds: number[] } }).json.postIds,
      ),
    );
  }
  expect(sent).toEqual(groups);
});

it("cancels all split packets from the old session even when fetch ignores abort", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetcher = vi.fn(async (raw: RequestInfo | URL) => {
    await gate;
    return response(raw);
  });
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const pending = Promise.allSettled(
    groups.map((postIds) =>
      client.feed.interactionsForPosts.query({ postIds }),
    ),
  );
  await vi.waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
  cancelSessionRequests();
  release();
  expect((await pending).every((result) => result.status === "rejected")).toBe(
    true,
  );
  await expect(
    client.feed.interactionsForPosts.query({ postIds: [999999] }),
  ).resolves.toEqual({ likedIds: [999999], savedIds: [] });
});

it("cancelling one operation does not misroute or cancel neighbouring replies", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetcher = vi.fn(async (raw: RequestInfo | URL) => {
    await gate;
    return response(raw);
  });
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  const client = createTRPCClient();
  const pending = Promise.allSettled(
    groups.map((postIds, index) =>
      client.feed.interactionsForPosts.query(
        { postIds },
        index === 0 ? { signal: controller.signal } : undefined,
      ),
    ),
  );
  await vi.waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(1));
  controller.abort();
  release();
  const results = await pending;
  expect(results[0].status).toBe("rejected");
  for (let i = 1; i < results.length; i++)
    expect(results[i]).toEqual({
      status: "fulfilled",
      value: { likedIds: groups[i], savedIds: [] },
    });
});
