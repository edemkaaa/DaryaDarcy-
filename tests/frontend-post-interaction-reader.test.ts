/** Общий reader пакетирует cache misses лайков/сохранений и распределяет результат только живым потребителям. */
import { expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createPostInteractionReader } from "../apps/frontend/src/domain/post/post-interaction-reader";
import type { PostInteractions } from "../apps/frontend/src/domain/post/post-interaction-data";

const empty: PostInteractions = { likedIds: [], savedIds: [] };
/** Ручной promise-barrier удерживает batch response для проверки отмены без гонки таймеров. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** Перекрывающиеся экраны повторно используют свежие ID; новый batch содержит только cache misses. */
it("batches per-post cache misses and reuses fresh marks across overlapping screens", async () => {
  const client = new QueryClient();
  const load = vi.fn(async (ids: number[]) => ({
    likedIds: ids.filter((id) => id % 2 === 0),
    savedIds: [],
  }));
  const reader = createPostInteractionReader(load);
  /** Один postId читается через настоящий QueryClient со staleTime30сек и отдельным query signal. */
  const read = (id: number) =>
    client.fetchQuery({
      queryKey: ["marks", id],
      staleTime: 30_000,
      queryFn: ({ signal }) => reader.read(id, signal),
    });
  try {
    const first = await Promise.all(
      Array.from({ length: 12 }, (_, i) => read(i + 1)),
    );
    expect(first[1].likedIds).toEqual([2]);
    expect(first[0].likedIds).toEqual([]);
    await Promise.all(Array.from({ length: 24 }, (_, i) => read(i + 1)));
    await Promise.all(Array.from({ length: 12 }, (_, i) => read(i + 7)));
    expect(load.mock.calls.map(([ids]) => ids)).toEqual([
      Array.from({ length: 12 }, (_, i) => i + 1),
      Array.from({ length: 12 }, (_, i) => i + 13),
    ]);
  } finally {
    reader.cancel();
    client.clear();
  }
});

/** 121ID разбиваются50/50/21; каждый caller получает только собственные marks. */
it("never exceeds 50 IDs and distributes only each post's marks", async () => {
  const load = vi.fn(async (ids: number[]) => ({
    likedIds: ids,
    savedIds: ids,
  }));
  const reader = createPostInteractionReader(load);
  const result = await Promise.all(
    Array.from({ length: 121 }, (_, i) =>
      reader.read(i + 1, new AbortController().signal),
    ),
  );
  expect(load.mock.calls.map(([ids]) => ids.length)).toEqual([50, 50, 21]);
  expect(
    result.every(
      (item, i) =>
        item.likedIds[0] === i + 1 &&
        item.likedIds.length === 1 &&
        item.savedIds[0] === i + 1,
    ),
  ).toBe(true);
});

/** Retry нескольких QueryClient consumers объединяется в один повтор чтения, не12запросов. */
it("coalesces automatic retries after a transient batch failure", async () => {
  const client = new QueryClient();
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("temporary"))
    .mockResolvedValue(empty);
  const reader = createPostInteractionReader(load);
  try {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        client.fetchQuery({
          queryKey: ["marks", i + 1],
          retry: 1,
          retryDelay: 5,
          queryFn: ({ signal }) => reader.read(i + 1, signal),
        }),
      ),
    );
    expect(load.mock.calls.map(([ids]) => ids)).toEqual([
      Array.from({ length: 12 }, (_, i) => i + 1),
      Array.from({ length: 12 }, (_, i) => i + 1),
    ]);
  } finally {
    reader.cancel();
    client.clear();
  }
});

/** Отмена до flush не отправляет HTTP или пустой batch. */
it("drops cancelled work before dispatch without sending an empty batch", async () => {
  const load = vi.fn(async () => empty);
  const reader = createPostInteractionReader(load);
  const abort = new AbortController();
  const result = reader.read(1, abort.signal);
  const check = expect(result).rejects.toMatchObject({ name: "AbortError" });
  abort.abort();
  await check;
  expect(load).not.toHaveBeenCalled();
});

/** Один abort не убивает transport остальных и не принимает поздний result отменённому caller. */
it("cancelling one post neither cancels the other posts nor delivers a late mark to it", async () => {
  const gate = deferred<typeof empty>();
  let transport!: AbortSignal;
  const reader = createPostInteractionReader(async (_ids, signal) => {
    transport = signal;
    return gate.promise;
  });
  const first = new AbortController();
  const second = new AbortController();
  const a = reader.read(1, first.signal);
  const b = reader.read(2, second.signal);
  await vi.waitFor(() => expect(transport).toBeDefined(), { interval: 1 });
  const check = expect(a).rejects.toMatchObject({ name: "AbortError" });
  first.abort();
  await check;
  expect(transport.aborted).toBe(false);
  gate.resolve({ likedIds: [1, 2], savedIds: [] });
  expect((await b).likedIds).toEqual([2]);
});

/** Reader.cancel отменяет общий транспорт, но последующий новый scope снова может читать. */
it("aborts the transport after the last consumer leaves and can restart after effect cleanup", async () => {
  const gate = deferred<typeof empty>();
  const signals: AbortSignal[] = [];
  const reader = createPostInteractionReader(async (_ids, signal) => {
    signals.push(signal);
    return signals.length === 1 ? gate.promise : empty;
  });
  const a = reader.read(1, new AbortController().signal);
  const b = reader.read(2, new AbortController().signal);
  const check = Promise.allSettled([a, b]);
  await vi.waitFor(() => expect(signals).toHaveLength(1), { interval: 1 });
  reader.cancel();
  expect(signals[0].aborted).toBe(true);
  expect((await check).every((item) => item.status === "rejected")).toBe(true);
  gate.resolve(empty);
  expect(await reader.read(3, new AbortController().signal)).toMatchObject(
    empty,
  );
});

/** Повреждённый/чужой marks DTO отвергается всеми участниками batch. */
it.each([
  null,
  { likedIds: [99], savedIds: [] },
  { likedIds: [], savedIds: null },
])("rejects invalid batch responses for every member: %j", async (response) => {
  const reader = createPostInteractionReader(async () => response);
  const results = await Promise.allSettled([
    reader.read(1, new AbortController().signal),
    reader.read(2, new AbortController().signal),
  ]);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
});

/** Только успешное новое чтение повышает readVersion; ошибка не выдаёт новое свидетельство. */
it("propagates failures and issues a new receipt only for a successful explicit read", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(empty)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(empty);
  const reader = createPostInteractionReader(load);
  const first = await reader.read(1, new AbortController().signal);
  await expect(reader.read(1, new AbortController().signal)).rejects.toThrow(
    "offline",
  );
  const next = await reader.read(1, new AbortController().signal);
  expect(next.readVersion).toBeGreaterThan(first.readVersion);
});
