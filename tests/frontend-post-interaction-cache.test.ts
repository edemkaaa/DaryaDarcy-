import { expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  removeCachedSavedPost,
  updateCachedPostLikeCount,
} from "../apps/frontend/src/domain/post/post-interaction-cache";

const key = (path: string) => [path.split("."), { type: "query" }];

it("propagates an authoritative count through existing cards while preserving pages, content and unrelated caches", () => {
  const client = new QueryClient();
  const post = { id: 7, likeCount: 3, text: "keep", media: [{ id: 7 }] };
  const other = { id: 8, likeCount: 10 };
  const rows = [other, post];
  const page = { posts: rows, nextCursor: 24 };
  const chain = { pages: [page], pageParams: [12] };
  const saved = {
    pages: [{ items: rows, nextCursor: "opaque" }],
    pageParams: [null],
  };
  const entries = [
    ["feed.getById", post],
    ["feed.list", rows],
    ["feed.listPaginated", chain],
    [
      "club.listByCategory",
      { pages: [{ items: rows, nextCursor: "24" }], pageParams: [null] },
    ],
    ["feed.savedPostsPage", saved],
    ["club.comments", rows],
  ] as const;
  try {
    for (const [path, data] of entries) client.setQueryData(key(path), data);
    const unrelated = [
      ["feed", "getById"],
      { type: "query", input: { id: 8 } },
    ];
    client.setQueryData(unrelated, other, { updatedAt: 123 });
    updateCachedPostLikeCount(client, 7, 42);
    expect(client.getQueryData(key("feed.getById"))).toEqual({
      ...post,
      likeCount: 42,
    });
    expect(client.getQueryData(key("feed.list"))).toEqual([
      other,
      { ...post, likeCount: 42 },
    ]);
    const updated = client.getQueryData<typeof chain>(
      key("feed.listPaginated"),
    )!;
    expect(updated.pageParams).toBe(chain.pageParams);
    expect(updated.pages[0].nextCursor).toBe(24);
    expect(updated.pages[0].posts[0]).toBe(other);
    expect(updated.pages[0].posts[1]).toEqual({ ...post, likeCount: 42 });
    expect(
      client.getQueryData<typeof saved>(key("feed.savedPostsPage"))!.pages[0]
        .items[1].likeCount,
    ).toBe(42);
    expect(
      client.getQueryData<typeof saved>(key("club.listByCategory"))!.pages[0]
        .items[1].likeCount,
    ).toBe(42);
    expect(client.getQueryData(key("club.comments"))).toBe(rows);
    expect(client.getQueryState(unrelated)?.dataUpdatedAt).toBe(123);
    expect(client.getQueryCache().getAll()).toHaveLength(entries.length + 1);
  } finally {
    client.clear();
  }
});

it("removes an unsaved post from the retained tail without changing keyset cursors or public lists", () => {
  const client = new QueryClient();
  const first = { items: [{ id: 1 }], nextCursor: "saved:1" };
  const saved = {
    pages: [first, { items: [{ id: 2 }, { id: 3 }], nextCursor: "saved:3" }],
    pageParams: [null, "saved:1"],
  };
  try {
    client.setQueryData(key("feed.savedPostsPage"), saved);
    client.setQueryData(key("feed.savedPosts"), [{ id: 2 }, { id: 3 }]);
    client.setQueryData(key("feed.list"), [{ id: 2 }]);
    removeCachedSavedPost(client, 2);
    const updated = client.getQueryData<typeof saved>(
      key("feed.savedPostsPage"),
    )!;
    expect(updated.pages[0]).toBe(first);
    expect(updated.pages[1]).toEqual({
      items: [{ id: 3 }],
      nextCursor: "saved:3",
    });
    expect(updated.pageParams).toBe(saved.pageParams);
    expect(client.getQueryData(key("feed.savedPosts"))).toEqual([{ id: 3 }]);
    expect(client.getQueryData(key("feed.list"))).toEqual([{ id: 2 }]);
  } finally {
    client.clear();
  }
});
