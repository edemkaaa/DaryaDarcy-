import { expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  cursorQueryKey,
  refreshCursorChain,
  type CursorChain,
  type CursorPage,
} from "../apps/frontend/src/shared/api/cursor-pages";

it.each([{}, { category: "life" }, { category: "life", tag: "spring" }])(
  "starts a fresh chronological chain for %j without clearing personal or unrelated data",
  async (filters) => {
    const client = new QueryClient();
    const base = [
      ["club", "listByCategory"],
      { input: { limit: 12, ...filters }, type: "query" },
    ];
    const oldKey = cursorQueryKey(base, "101");
    const key = cursorQueryKey(base, "101", "club-publication-date-v1");
    const old: CursorChain<CursorPage> = {
      pages: [
        { items: [{ id: 900 }], nextCursor: "12" },
        { items: [{ id: 800 }], nextCursor: "24" },
      ],
      pageParams: [null, "12"],
    };
    const unrelated = [
      [
        ["club", "commentsPage"],
        { input: { postId: 900 }, type: "query" },
        { ownerScope: "101:true" },
      ],
      [
        ["feed", "savedPostsPage"],
        { input: { limit: 12 }, type: "query" },
        { ownerScope: "101" },
      ],
      [["feed", "listPaginated"], { type: "query" }],
      [["admin", "postsPage"], { type: "query" }],
    ];
    try {
      client.setQueryData(oldKey, old);
      for (const other of unrelated)
        client.setQueryData(other, { retained: true });
      const retained = unrelated.map((other) => client.getQueryData(other));
      const reads: (string | null)[] = [];
      const current = await client.fetchQuery({
        queryKey: key,
        queryFn: () =>
          refreshCursorChain(
            client.getQueryData<CursorChain<CursorPage>>(key),
            async (cursor) => {
              reads.push(cursor);
              return { items: [{ id: 1 }], nextCursor: "12" };
            },
            new Set(),
            "background",
          ),
      });
      expect(reads).toEqual([null]);
      expect(current.pageParams).toEqual([null]);
      expect(current.pages.flatMap((page) => page.items)).toEqual([{ id: 1 }]);
      unrelated.forEach((other, index) =>
        expect(client.getQueryData(other)).toBe(retained[index]),
      );
      // Existing admin invalidations still reach the versioned club queries.
      await client.invalidateQueries({ queryKey: base });
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    } finally {
      client.clear();
    }
  },
);

it("a late response from the previous order cannot append its offset to the new cache", async () => {
  const client = new QueryClient();
  const base = [
    ["club", "listByCategory"],
    { input: { limit: 12 }, type: "query" },
  ];
  const oldKey = cursorQueryKey(base, "101");
  const key = cursorQueryKey(base, "101", "club-publication-date-v1");
  let release!: (value: CursorChain<CursorPage>) => void;
  const oldRead = client.fetchQuery({
    queryKey: oldKey,
    queryFn: () =>
      new Promise<CursorChain<CursorPage>>((resolve) => {
        release = resolve;
      }),
  });
  try {
    const current = {
      pages: [{ items: [{ id: 1 }], nextCursor: null }],
      pageParams: [null],
    };
    client.setQueryData(key, current);
    release({
      pages: [{ items: [{ id: 900 }], nextCursor: "96" }],
      pageParams: ["84"],
    });
    await oldRead;
    expect(client.getQueryData(key)).toEqual(current);
  } finally {
    client.clear();
  }
});
