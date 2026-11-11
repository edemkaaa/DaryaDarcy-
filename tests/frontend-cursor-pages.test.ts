/** Ограниченный infinite cache хранит восемь payload-страниц и курсоры посещённого пути, не смешивая наблюдателей. */
import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  appendCursorPage,
  type CursorChain,
  cancelInactiveCursorQuery,
  boundCursorChain,
  prependCursorPage,
  refreshCursorChain,
} from "../apps/frontend/src/shared/api/cursor-pages";
const head: {
  items: { id: number; text?: string }[];
  nextCursor: string | null;
} = { items: [{ id: 1, text: "old" }], nextCursor: "next" };
const chain: CursorChain<typeof head> = {
  pages: [head, { items: [{ id: 2 }], nextCursor: null }],
  pageParams: [null, "next"],
};
/** Проверяем отмену общей query и строгую связность cursor-chain. */
describe("bounded cursor chains", () => {
  /** Отписка одного QueryObserver не отменяет запрос второго активного экрана. */
  it("does not cancel a shared head still observed by another screen", async () => {
    const client = new QueryClient();
    const key = ["shared-cursor-test"];
    let release!: (value: number) => void,
      aborted = false;
    const held = new Promise<number>((resolve) => {
      release = resolve;
    });
    const options = {
      queryKey: key,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return held;
      },
    };
    const first = new QueryObserver(client, options),
      second = new QueryObserver(client, options);
    const one = first.subscribe(() => {}),
      two = second.subscribe(() => {});
    one();
    cancelInactiveCursorQuery(client, key);
    await Promise.resolve();
    expect(aborted).toBe(false);
    release(7);
    await client.fetchQuery(options);
    expect(client.getQueryData(key)).toBe(7);
    two();
    client.clear();
  });
  /** Повтор nextCursor и повторная уже загруженная граница отвергаются. */
  it("does not accept a repeated boundary, preventing automatic loops", () => {
    expect(() =>
      appendCursorPage({ pages: [head], pageParams: [null] }, "next", {
        items: [{ id: 2 }],
        nextCursor: "next",
      }),
    ).toThrow();
    expect(() =>
      appendCursorPage(chain, "next", { items: [], nextCursor: null }),
    ).toThrow();
  });
});

/** Проходим 240 страниц вперёд и назад, проверяя лимит payload, сохранение opaque cursors и удаление старого текста. */
it("keeps eight payload pages while opaque cursors allow returning through a long visited list", async () => {
  /** Синтетический reader преобразует opaque cursor в отдельную страницу с узнаваемым payload. */
  const read = async (cursor: string | null) => {
    const index = cursor === null ? 0 : Number(cursor.slice("opaque:".length));
    return {
      items: [{ id: index + 1, text: `PAYLOAD_${index}` }],
      nextCursor: `opaque:${index + 1}`,
    };
  };
  let window = await refreshCursorChain(
    undefined,
    read,
    new Set(),
    "background",
  );
  for (let index = 1; index < 240; index++) {
    const cursor = window.pages.at(-1)!.nextCursor!;
    window = boundCursorChain(
      appendCursorPage(window, cursor, await read(cursor)),
      8,
      "next",
    );
    expect(window.pages.length).toBeLessThanOrEqual(8);
  }
  expect(
    window.pages.flatMap((page) => page.items.map((row) => row.id)),
  ).toEqual([233, 234, 235, 236, 237, 238, 239, 240]);
  expect(JSON.stringify(window)).not.toContain('"text":"PAYLOAD_0"');
  expect(window.head?.items).toEqual([{ id: 1 }]);
  for (let index = 231; index >= 0; index--) {
    const cursor = window.previousCursors!.at(-1)!;
    window = boundCursorChain(
      prependCursorPage(window, await read(cursor)),
      8,
      "previous",
    );
    expect(
      window.pages.flatMap((page) => page.items.map((row) => row.id)),
    ).toEqual(Array.from({ length: 8 }, (_, i) => index + i + 1));
  }
  expect(window.pageParams[0]).toBeNull();
  expect(window.previousCursors).toEqual([]);
  const cursor = window.pages.at(-1)!.nextCursor!;
  window = boundCursorChain(
    appendCursorPage(window, cursor, await read(cursor)),
    8,
    "next",
  );
  expect(window.pages[0].items[0].id).toBe(2);
});

/** Несвязная предыдущая страница и цикл в отброшенный cursor не меняют исходную цепочку. */
it("rejects a changed previous boundary and a loop into a discarded opaque page", () => {
  const window = {
    pages: [{ items: [{ id: 3 }], nextCursor: "third" }],
    pageParams: ["second"],
    previousCursors: [null, "first"],
  };
  expect(() =>
    prependCursorPage(window, { items: [{ id: 2 }], nextCursor: "changed" }),
  ).toThrow("Курсор");
  expect(() =>
    appendCursorPage(window, "third", {
      items: [{ id: 4 }],
      nextCursor: "first",
    }),
  ).toThrow("Курсор");
  expect(window.pages[0].items).toEqual([{ id: 3 }]);
});
