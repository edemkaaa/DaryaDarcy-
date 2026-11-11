import { afterEach, expect, it, vi } from "vitest";
import { getUntypedClient } from "@trpc/client";
import superjson from "superjson";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import { createAppQueryClient } from "../apps/frontend/src/shared/api/query-client";
import { validateReadResponse } from "../apps/frontend/src/shared/api/read-response-contracts";
import { shouldRetryQuery } from "../apps/frontend/src/shared/api/errors";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import type { CommentReportInboxRow } from "../apps/frontend/src/shared/api/contract";

afterEach(() => {
  cancelSessionRequests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const date = new Date("2026-10-30T12:00:00Z");
const article = { id: 7, title: "Article", coverUrl: null, access: "public" };
const video = {
  id: 7,
  title: "Video",
  youtubeId: "legacy-id",
  duration: null,
  views: null,
  publishedText: null,
  videoUrl: null,
};
const post = {
  id: 7,
  text: "Post",
  photos: [],
  tags: [],
  target: "feed",
  media: [],
  richText: null,
  createdAt: date,
  publishedAt: null,
  likeCount: 0,
  commentCount: 0,
};
it("checks that a UUID detail response matches the requested post", () => {
  // Сценарий: Детальный ответ UUID должен относиться к запрошенному publicId.

  const publicId = "c22db58f-698b-41ea-8e12-524d8323b034";
  expect(() => validateReadResponse("feed.getById", { ...post, publicId }, { publicId })).not.toThrow();
  expect(() => validateReadResponse("feed.getById", post, { publicId })).toThrow();
  expect(() => validateReadResponse("feed.getById", { ...post, publicId }, {
    publicId: "a71ccf8d-4744-40e3-a6e8-57bb355c90d7",
  })).toThrow();
});
const card = {
  id: 7,
  text: "Post",
  photos: [],
  tags: [],
  target: "feed",
  tagCount: 0,
  hasVideo: false,
  published: false,
  status: "draft",
  scheduledAt: null,
  publishedAt: null,
  createdAt: date,
};
const counts = { total: 0, published: 0, scheduled: 0, draft: 0 };
const stats = {
  totalPosts: 0,
  publishedPosts: 0,
  scheduledPosts: 0,
  draftPosts: 0,
  feedPosts: 0,
  clubPosts: 0,
  bothPosts: 0,
  totalLikes: 0,
  totalSaves: 0,
  postsThisMonth: 0,
  postsLastMonth: 0,
  topLikedPosts: [],
};
const day = { ...card, ...counts, dayIndex: 0 };
const member = {
  id: 7,
  email: null,
  contactPhone: null,
  name: null,
  role: "user",
  createdAt: date,
  clubExpiresAt: null,
  blockedAt: null,
  blockedReason: null,
};
const payment = {
  id: 7,
  userId: 7,
  orderId: "order",
  email: null,
  sum: null,
  status: "paid",
  paidAt: date,
  expiresAt: null,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  createdAt: date,
  updatedAt: date,
};
const comment = {
  id: 7,
  postId: 7,
  userId: 7,
  parentId: null,
  text: "Comment",
  photos: null,
  createdAt: date,
  authorName: null,
  authorAvatarUrl: null,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
};
const report = {
  id: 31,
  commentId: 12,
  reason: "Reported comment",
  createdAt: date,
  commentText: "Comment",
  commentPhotos: [],
  postId: 7,
  authorUserId: 201,
  authorName: "Author",
  reporterUserId: 202,
  reporterName: "Reporter",
  canBlockAuthor: true,
} satisfies CommentReportInboxRow;
const input = {
  id: 7,
  postId: 7,
  days: [{ from: "2026-10-30", to: "2026-10-31" }],
};
// Матрица совместимых ответов включает страницы, детали, nullable-поля и счётчики: новые поля сохраняются, обязательные проверяются.
const valid = [
  ["moderation.listCommentReports", [report]],
  [
    "moderation.listCommentReports",
    [{ ...report, authorName: null, reporterName: null, commentPhotos: null }],
  ],
  ["admin.membersPage", { items: [member], nextCursor: null }],
  ["admin.paymentsPage", { items: [payment], nextCursor: null }],
  ["club.commentsPage", { items: [comment], nextCursor: null, totalCount: 1 }],
  ["articles.list", [article]],
  [
    "articles.getById",
    { ...article, locked: false, sections: [{ type: "text", text: "Body" }] },
  ],
  ["videos.list", [video]],
  ["videos.getById", video],
  ["feed.listPaginated", { posts: [post], nextCursor: null }],
  ["feed.getById", post],
  ["feed.savedPostsPage", { items: [post], nextCursor: "opaque:cursor" }],
  ["club.listByCategory", { posts: [post], nextCursor: 7 }],
  [
    "feed.tags",
    [
      {
        id: 7,
        slug: "autumn",
        label: "Autumn",
        category: "season",
        sortOrder: 0,
      },
    ],
  ],
  ["admin.postsPage", { posts: [card], nextCursor: null }],
  [
    "admin.articlesPage",
    {
      items: [
        {
          ...article,
          published: true,
          sortOrder: 0,
          createdAt: date,
          updatedAt: date,
        },
      ],
      nextCursor: null,
    },
  ],
  ["admin.stats", stats],
  ["admin.postCounts", counts],
  ["admin.postCalendar", { days: [day], upcoming: [card] }],
] as const;
// Отрицательная матрица нарушает по одному полю: типы, принадлежность детали, даты, enum и курсоры должны проверяться до обновления кеша.
const bad = [
  ["moderation.listCommentReports", null],
  ["moderation.listCommentReports", {}],
  ["moderation.listCommentReports", [null]],
  ["moderation.listCommentReports", [{ ...report, id: "31" }]],
  ["moderation.listCommentReports", [{ ...report, commentId: 0 }]],
  ["moderation.listCommentReports", [{ ...report, postId: -1 }]],
  ["moderation.listCommentReports", [{ ...report, authorUserId: null }]],
  ["moderation.listCommentReports", [{ ...report, reporterUserId: 1.5 }]],
  ["moderation.listCommentReports", [{ ...report, reason: {} }]],
  ["moderation.listCommentReports", [{ ...report, createdAt: "yesterday" }]],
  ["moderation.listCommentReports", [{ ...report, createdAt: new Date(NaN) }]],
  ["moderation.listCommentReports", [{ ...report, commentText: {} }]],
  ["moderation.listCommentReports", [{ ...report, authorName: {} }]],
  ["moderation.listCommentReports", [{ ...report, reporterName: [] }]],
  [
    "moderation.listCommentReports",
    [{ ...report, commentPhotos: ["valid", { private: "PRIVATE_PAYLOAD" }] }],
  ],
  ["feed.getById", { ...post, likeCount: undefined }],
  [
    "feed.listPaginated",
    { posts: [{ ...post, commentCount: undefined }], nextCursor: null },
  ],
  [
    "admin.membersPage",
    { items: [{ ...member, role: "owner" }], nextCursor: null },
  ],
  [
    "admin.membersPage",
    { items: [{ ...member, blockedAt: "yesterday" }], nextCursor: null },
  ],
  [
    "admin.paymentsPage",
    { items: [{ ...payment, sum: 10 }], nextCursor: null },
  ],
  [
    "admin.paymentsPage",
    { items: [{ ...payment, status: "refunded" }], nextCursor: null },
  ],
  [
    "club.commentsPage",
    { items: [{ ...comment, text: null }], nextCursor: null, totalCount: 1 },
  ],
  [
    "club.commentsPage",
    { items: [{ ...comment, postId: 8 }], nextCursor: null, totalCount: 1 },
  ],
  [
    "club.commentsPage",
    { items: [{ ...comment, parentId: 8 }], nextCursor: null, totalCount: 1 },
  ],
  ["club.commentsPage", { items: [comment], nextCursor: null, totalCount: -1 }],
  ["articles.list", {}],
  ["articles.list", [null]],
  ["articles.list", [{ ...article, title: undefined }]],
  ["articles.list", [{ ...article, access: "unknown" }]],
  ["articles.list", [{ ...article, id: "7" }]],
  ["articles.list", [{ ...article, id: 0 }]],
  ["articles.list", [{ ...article, id: 1.5 }]],
  [
    "articles.getById",
    { ...article, locked: false, sections: [{ type: "future-block" }] },
  ],
  [
    "articles.getById",
    { ...article, locked: false, sections: [{ type: "text", text: {} }] },
  ],
  ["articles.getById", { ...article, locked: "false", sections: [] }],
  ["articles.getById", { ...article, id: 8, locked: false, sections: [] }],
  ["videos.list", [null]],
  ["videos.list", [{ ...video, youtubeId: null }]],
  ["videos.list", [{ ...video, duration: 42 }]],
  ["videos.list", [{ ...video, thumbnailUrl: {} }]],
  ["videos.getById", { ...video, id: 8 }],
  ["feed.listPaginated", { posts: "PRIVATE_PAYLOAD", nextCursor: null }],
  ["feed.listPaginated", { posts: [null], nextCursor: null }],
  ["feed.listPaginated", { posts: [post] }],
  ["feed.listPaginated", { posts: [post], nextCursor: "7" }],
  ["feed.getById", { ...post, photos: [1] }],
  ["feed.getById", { ...post, tags: null }],
  ["feed.getById", { ...post, target: "unknown" }],
  ["feed.getById", { ...post, createdAt: "yesterday" }],
  ["feed.getById", { ...post, createdAt: new Date(NaN) }],
  [
    "feed.getById",
    { ...post, richText: [{ type: "paragraph", children: [{ text: {} }] }] },
  ],
  ["feed.getById", { ...post, media: [{ id: 1, type: "video", url: {} }] }],
  ["feed.savedPostsPage", { items: [post], nextCursor: "" }],
  ["club.listByCategory", { posts: [], nextCursor: -1 }],
  [
    "feed.tags",
    [{ id: 1, slug: "a", label: "a", category: "unknown", sortOrder: 0 }],
  ],
  [
    "admin.postsPage",
    { posts: [{ ...card, status: "unknown" }], nextCursor: null },
  ],
  [
    "admin.postsPage",
    { posts: [{ ...card, hasVideo: "false" }], nextCursor: null },
  ],
  ["admin.articlesPage", { items: [{ ...article }], nextCursor: null }],
  ["admin.stats", { ...stats, totalPosts: "0" }],
  ["admin.stats", { ...stats, totalSaves: -1 }],
  ["admin.stats", { ...stats, topLikedPosts: [null] }],
  ["admin.stats", { ...stats, postsLastMonth: undefined }],
  ["admin.postCounts", { ...counts, draft: 0.5 }],
  ["admin.postCounts", { ...counts, total: Infinity }],
  ["admin.postCalendar", { days: [{ ...day, dayIndex: 1 }], upcoming: [] }],
  ["admin.postCalendar", { days: [day, day], upcoming: [] }],
  ["admin.postCalendar", { days: [{ ...day, published: true }], upcoming: [] }],
  ["admin.postCalendar", { days: [], upcoming: [null] }],
] as const;
const envelope = (value: unknown) => /* Кодирует тестовый ответ SuperJSON, сохраняя даты и разрешённые отсутствующие значения. */ ({
  result: { data: superjson.serialize(value) },
});

it.each(valid)(
  "accepts compatible decoded %s without replacing data",
  (path, value) => {
    // Сценарий: Совместимые декодированные ответы принимаются без подмены данных.

    expect(() => validateReadResponse(path, value, input)).not.toThrow();
  },
);

it.each(bad)(
  "rejects malformed %s before the real tRPC query resolves (%#)",
  async (path, value) => {
    // Сценарий: Повреждённый успешный ответ отклоняется до завершения query и не повторяется автоматически.

    const fetcher = vi.fn(async () => Response.json([envelope(value)]));
    vi.stubGlobal("fetch", fetcher);
    const error = await getUntypedClient(createTRPCClient())
      .query(path, input)
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ cause: { kind: "invalid-response" } });
    expect(shouldRetryQuery(0, error)).toBe(false);
    expect(String(error)).toContain("Некорректный ответ сервера");
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it.each(valid)(
  "preserves new fields and SuperJSON in %s",
  async (path, value) => {
    // Сценарий: Новые поля и даты SuperJSON сохраняются после проверки обязательной части контракта.

    const withExtras = Array.isArray(value)
      ? value.map((row) => ({ ...row, futureField: date }))
      : { ...value, futureField: date };
    vi.stubGlobal("fetch", async () => Response.json([envelope(withExtras)]));
    await expect(
      getUntypedClient(createTRPCClient()).query(path, input),
    ).resolves.toEqual(withExtras);
  },
);

it.each([
  "articles.list",
  "videos.list",
  "feed.tags",
  "moderation.listCommentReports",
])("accepts an empty %s", async (path) => {
  // Сценарий: Пустой список остаётся допустимым успешным ответом.

  vi.stubGlobal("fetch", async () => Response.json([envelope([])]));
  await expect(
    getUntypedClient(createTRPCClient()).query(path),
  ).resolves.toEqual([]);
});

it.each([undefined, false, "true"])(
  "preserves readable reports with a non-authorizing permission hint %s",
  async (canBlockAuthor) => {
    // Сценарий: Подсказка права блокировки не превращается в самостоятельное разрешение и не мешает читать жалобы.

    const value = [{ ...report, canBlockAuthor }];
    vi.stubGlobal("fetch", async () => Response.json([envelope(value)]));
    await expect(
      createTRPCClient().moderation.listCommentReports.query(),
    ).resolves.toEqual(value);
  },
);
it.each(
  ["articles.getById", "videos.getById", "feed.getById"].flatMap((path) =>
    [null, undefined].map((value) => ({ path, value })),
  ),
)("preserves allowed absence for $path ($value)", async ({ path, value }) => {
  // Сценарий: Разрешённое отсутствие детали сохраняет null/undefined.

  vi.stubGlobal("fetch", async () => Response.json([envelope(value)]));
  await expect(
    getUntypedClient(createTRPCClient()).query(path, input),
  ).resolves.toBe(value);
});

it("accepts a locked article and valid ISO dates", () => {
  // Сценарий: Закрытая статья и корректные ISO-даты проходят валидацию.

  validateReadResponse(
    "articles.getById",
    { ...article, access: "club", locked: true, sections: [] },
    input,
  );
  validateReadResponse(
    "feed.getById",
    { ...post, createdAt: "2026-10-30T15:00:00+03:00" },
    input,
  );
});

it.each([
  {
    name: "articles",
    value: article,
    read: (client: ReturnType<typeof createTRPCClient>) =>
      /* Читает список статей реальным tRPC-клиентом для проверки поведения QueryClient. */ client.articles.list.query(),
  },
  {
    name: "reports",
    value: report,
    read: (client: ReturnType<typeof createTRPCClient>) =>
      /* Читает список жалоб реальным tRPC-клиентом для проверки изоляции ошибки контракта. */ client.moderation.listCommentReports.query(),
  },
])(
  "does not poison or erase the last confirmed $name cache or retry a malformed 200",
  async ({ name, value: row, read }) => {
    // Сценарий: Повреждённый 200 не стирает подтверждённый кеш и не вызывает повтор; настоящий пустой ответ его обновляет.

    const cache = createAppQueryClient();
    let value: unknown = [row];
    const fetcher = vi.fn(async () => Response.json([envelope(value)]));
    vi.stubGlobal("fetch", fetcher);
    const client = createTRPCClient();
    const options = {
      queryKey: [`validated-${name}`],
      staleTime: 0,
      queryFn: async () => /* Передаёт выбранное чтение в QueryClient, чтобы проверить сохранность последнего подтверждённого кеша. */ read(client),
    };
    try {
      await cache.fetchQuery(options);
      value = [null];
      await expect(cache.fetchQuery(options)).rejects.toMatchObject({
        cause: { kind: "invalid-response" },
      });
      expect(cache.getQueryData(options.queryKey)).toEqual([row]);
      expect(cache.getQueryState(options.queryKey)?.status).toBe("error");
      expect(fetcher).toHaveBeenCalledTimes(2);
      value = [];
      await expect(cache.fetchQuery(options)).resolves.toEqual([]);
    } finally {
      cache.clear();
    }
  },
);

it("keeps a malformed success isolated from another success in the same batch", async () => {
  // Сценарий: Неверный элемент batch не повреждает независимый успешный элемент.

  const fetcher = vi.fn(async () =>
    Response.json([envelope([null]), envelope([])]),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const [articles, videos] = await Promise.allSettled([
    client.articles.list.query(),
    client.videos.list.query(),
  ]);
  expect(articles.status).toBe("rejected");
  if (articles.status === "rejected")
    expect(articles.reason).toMatchObject({
      cause: { kind: "invalid-response" },
    });
  expect(videos).toEqual({ status: "fulfilled", value: [] });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("does not reinterpret write acknowledgements or unrelated read protocols", () => {
  // Сценарий: Проверка read-контрактов не переопределяет квитанции записи и посторонние протоколы.

  expect(() =>
    validateReadResponse(
      "profile.update",
      { success: true, profileRevision: 2 },
      undefined,
    ),
  ).not.toThrow();
  expect(() =>
    validateReadResponse("club.subscription", {}, undefined),
  ).not.toThrow();
  expect(() => validateReadResponse("toString", {}, undefined)).not.toThrow();
});

it("keeps an aborted read cancelled while another operation in its batch completes", async () => {
  // Сценарий: Отменённое чтение остаётся отменённым, пока соседний элемент batch завершается успешно.

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetcher = vi.fn(async () => {
    await held;
    return Response.json([envelope([null]), envelope([])]);
  });
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const controller = new AbortController();
  const cancelled = client.articles.list
    .query(undefined, { signal: controller.signal })
    .catch((error: unknown) => error);
  const retained = client.videos.list.query();
  try {
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(await cancelled).toMatchObject({ cause: { kind: "cancelled" } });
  } finally {
    release();
  }
  await expect(retained).resolves.toEqual([]);
});
