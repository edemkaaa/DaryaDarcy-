import { afterEach, expect, it, vi } from "vitest";
import {
  QueryObserver,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import {
  createAppQueryClient,
  INACTIVE_COMMENT_QUERY_LIMIT,
  INACTIVE_FEED_QUERY_LIMIT,
} from "../apps/frontend/src/shared/api/query-client";
import { subscribeSessionChecks } from "../apps/frontend/src/shared/api/session-events";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

it.each([
  "feed.savedPostsPage",
  "admin.postsPage",
  "admin.articlesPage",
  "admin.membersPage",
  "admin.paymentsPage",
])(
  "bounds abandoned %s scopes while retaining an observed screen",
  async (path) => {
    const client = createAppQueryClient();
    const key = (id: number) => [
      path.split("."),
      { input: { id }, type: "query" },
    ];
    client.setQueryData(key(0), { pages: ["CONFIRMED"] });
    const observer = new QueryObserver(client, {
      queryKey: key(0),
      enabled: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      for (let index = 1; index <= 40; index++)
        client.setQueryData(key(index), { pages: [index] });
      await Promise.resolve();
      expect(client.getQueryData(key(0))).toEqual({ pages: ["CONFIRMED"] });
      expect(client.getQueryData(key(1))).toBeUndefined();
      expect(client.getQueryCache().getAll()).toHaveLength(3);
    } finally {
      unsubscribe();
      client.clear();
    }
  },
);

it("reuses fresh data and refetches after an explicit invalidation", async () => {
  const client = createAppQueryClient();
  const queryFn = vi.fn(async () => ["POST"]);
  const options = { queryKey: ["posts"], queryFn };
  try {
    await client.fetchQuery(options);
    await client.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: ["posts"] });
    await client.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(2);
  } finally {
    client.clear();
  }
});

it("keeps inactive data for five minutes, then releases it", async () => {
  vi.useFakeTimers();
  const client = createAppQueryClient();
  try {
    await client.fetchQuery({
      queryKey: ["posts"],
      queryFn: async () => ["POST"],
    });
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(client.getQueryData(["posts"])).toEqual(["POST"]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.getQueryData(["posts"])).toBeUndefined();
  } finally {
    client.clear();
  }
});

it("stale content stays cached when focus or the connection returns", async () => {
  const client = createAppQueryClient();
  const queryFn = vi.fn(async () => ["POST"]);
  await client.fetchQuery({ queryKey: ["posts"], queryFn });
  const observer = new QueryObserver(client, {
    queryKey: ["posts"],
    queryFn,
    staleTime: 0,
    refetchOnMount: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  client.mount();
  try {
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    // Resume callbacks run through the QueryClient's asynchronous event listeners.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toEqual(["POST"]);
    expect(observer.getCurrentResult().isFetching).toBe(false);
  } finally {
    unsubscribe();
    client.unmount();
    client.clear();
  }
});

it.each([401, 403])(
  "protected query rejection still asks for a session check: %s",
  async (status) => {
    const client = createAppQueryClient();
    const verify = vi.fn();
    const unsubscribe = subscribeSessionChecks(verify);
    const queryFn = vi.fn(async () => {
      throw new ApiError("denied", status);
    });
    try {
      await expect(
        client.fetchQuery({ queryKey: ["private"], queryFn }),
      ).rejects.toThrow("denied");
      expect(verify).toHaveBeenCalledExactlyOnceWith(status);
      expect(queryFn).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      client.clear();
    }
  },
);

it("a failed mutation is never retried automatically", async () => {
  const client = createAppQueryClient();
  const mutationFn = vi.fn(async () => {
    throw new ApiError("unavailable", 503);
  });
  try {
    const mutation = client.getMutationCache().build(client, { mutationFn });
    await expect(mutation.execute(undefined)).rejects.toThrow("unavailable");
    expect(mutationFn).toHaveBeenCalledTimes(1);
  } finally {
    client.clear();
  }
});

const commentKey = (postId: number) =>
  [["club", "comments"], { input: { postId }, type: "query" }] as const;

it("evicts the oldest unused comments while keeping an observed reply's data", async () => {
  const client = createAppQueryClient();
  const held = commentKey(0);
  client.setQueryData(held, ["DRAFT_CONTEXT"]);
  const observer = new QueryObserver(client, {
    queryKey: held,
    enabled: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    for (let id = 1; id <= INACTIVE_COMMENT_QUERY_LIMIT + 10; id++)
      client.setQueryData(commentKey(id), [`COMMENT_${id}`]);
    await Promise.resolve();
    expect(client.getQueryData(held)).toEqual(["DRAFT_CONTEXT"]);
    expect(client.getQueryData(commentKey(1))).toBeUndefined();
    expect(
      client.getQueryData(commentKey(INACTIVE_COMMENT_QUERY_LIMIT + 10)),
    ).toEqual([`COMMENT_${INACTIVE_COMMENT_QUERY_LIMIT + 10}`]);
    expect(client.getQueryCache().getAll()).toHaveLength(
      INACTIVE_COMMENT_QUERY_LIMIT + 1,
    );
    unsubscribe();
    await Promise.resolve();
    expect(client.getQueryCache().getAll()).toHaveLength(
      INACTIVE_COMMENT_QUERY_LIMIT,
    );
  } finally {
    unsubscribe();
    client.clear();
  }
});

it("bounds abandoned feed filters without removing pages of the current list", async () => {
  const client = createAppQueryClient();
  const key = (search: string) =>
    [
      ["feed", "listPaginated"],
      { input: { search }, type: "infinite" },
    ] as const;
  const current = key("current");
  const pages = {
    pages: Array.from({ length: 30 }, (_, id) => ({ posts: [id] })),
    pageParams: [],
  };
  client.setQueryData(current, pages);
  const observer = new QueryObserver(client, {
    queryKey: current,
    enabled: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    for (let id = 0; id < 10; id++)
      client.setQueryData(key(`old-${id}`), pages);
    await Promise.resolve();
    expect(client.getQueryData(current)).toBe(pages);
    expect(client.getQueryData(key("old-0"))).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(
      INACTIVE_FEED_QUERY_LIMIT + 1,
    );
    client.clear();
    await Promise.resolve();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  } finally {
    unsubscribe();
    client.clear();
  }
});

it("allows an unobserved comment request to settle before cache eviction", async () => {
  const client = createAppQueryClient();
  let resolve!: (data: string[]) => void;
  const pending = client.fetchQuery({
    queryKey: commentKey(0),
    queryFn: () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  });
  try {
    for (let id = 1; id <= INACTIVE_COMMENT_QUERY_LIMIT + 10; id++)
      client.setQueryData(commentKey(id), ["COMMENT"]);
    await Promise.resolve();
    expect(client.getQueryState(commentKey(0))?.fetchStatus).toBe("fetching");
    resolve(["RESPONSE"]);
    await expect(pending).resolves.toEqual(["RESPONSE"]);
    await Promise.resolve();
    expect(client.getQueryData(commentKey(0))).toEqual(["RESPONSE"]);
    expect(client.getQueryCache().getAll()).toHaveLength(
      INACTIVE_COMMENT_QUERY_LIMIT,
    );
  } finally {
    client.clear();
  }
});

it("bounds abandoned club filters independently of feed filters", async () => {
  const client = createAppQueryClient();
  const activeKey = [
    ["club", "listByCategory"],
    { input: { category: "life" }, type: "query" },
  ];
  const observer = new QueryObserver(client, {
    queryKey: activeKey,
    queryFn: async () => ({ pages: [] }),
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    for (let index = 0; index < 7; index++) {
      client.setQueryData(
        [
          ["club", "listByCategory"],
          { input: { tag: `tag-${index}` }, type: "query" },
        ],
        { pages: [] },
      );
      await Promise.resolve();
    }
    expect(
      client.getQueryCache().find({ queryKey: activeKey, exact: true }),
    ).toBeDefined();
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: [["club", "listByCategory"]] }),
    ).toHaveLength(3);
  } finally {
    unsubscribe();
    client.clear();
  }
});
