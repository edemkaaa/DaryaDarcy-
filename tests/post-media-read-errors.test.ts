import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { TrpcContext } from "../apps/backend/src/_core/context";

const transport = vi.hoisted(() => ({
  query: vi.fn(),
  mediaError: null as Error | null,
  mediaRows: [] as unknown[][],
  tagError: null as Error | null,
}));
vi.mock("mysql2/promise", () => ({
  default: { /** Подменяет mysql2 транспорт без замены настоящих репозиториев и Drizzle. */ createPool: () => ({ /** Не создаёт реальные listeners пула в тестовом SQL-double. */ on() {}, query: transport.query }) },
}));

// The SQL transport is doubled, not the repositories or Drizzle. These tests
// inject unavailable reads; real MySQL coverage remains a separate gate.
let database: typeof import("../apps/backend/src/db");
const reads = [
  { name: "feed list", /** Читает обычный список ленты через существующий фасад. */ run: () => database.getPosts() },
  { name: "feed page", /** Читает страницу ленты, чтобы проверить обязательность загрузки её media. */ run: () => database.getPostsPaginated({ limit: 1 }) },
  { name: "post detail", /** Читает детали конкретного поста вместе с media. */ run: () => database.getPostById(41) },
  { name: "saved posts", /** Читает сохранённые ID через общий фасад постов. */ run: () => database.getPostsByIds([41]) },
  { name: "admin posts", /** Читает администраторский список постов для проверки полноты media. */ run: () => database.getAllPostsAdmin() },
  {
    name: "club page",
    /** Читает страницу Клуба через тот же repository pipeline. */
    run: () => database.getPostsForTarget("club", { limit: 1 }),
  },
  { name: "post media", /** Читает непосредственно вложения поста для проверки исходной ошибки SQL. */ run: () => database.getPostMediaByPostId(41) },
];
const media = {
  id: 51,
  postId: 41,
  type: "video",
  url: "https://assets.example.test/lesson.webm",
  posterUrl: null,
  filename: "Lesson.webm",
  mimeType: "video/webm",
  fileSize: 1234,
  duration: 72,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};
const emptyStatistics = {
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
/** Извлекает media из разных форм ответов, сохраняя различие отсутствующего поля и честного пустого массива. */
function postMedia(result: unknown): unknown {
  if (Array.isArray(result) && result.length === 0) return [];
  const first = Array.isArray(result)
    ? result[0]
    : result &&
        typeof result === "object" &&
        "posts" in result &&
        Array.isArray(result.posts)
      ? result.posts[0]
      : result;
  if (!first || typeof first !== "object") return undefined;
  return "postId" in first
    ? result
    : "media" in first
      ? first.media
      : undefined;
}
/** Создаёт независимый SQL-double с инъекцией отказов media/tags и настоящими формами строк Drizzle. */
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  transport.mediaError = null;
  transport.mediaRows = [];
  transport.tagError = null;
  transport.query
    .mockReset()
    .mockImplementation(async ({ sql }: { sql: string }) => {
      if (/^(set transaction|start transaction|begin|commit|rollback)/i.test(sql)) {
        return [[], []];
      }
      if (sql.includes("from `tags`")) {
        if (transport.tagError) throw transport.tagError;
        return [[[71, "winter", "Зима", "season", 3]], []];
      }
      if (sql.includes("from `post_media`")) {
        if (transport.mediaError) throw transport.mediaError;
        return [transport.mediaRows, []];
      }
      if (sql.includes("from `posts`")) {
        const row: unknown[] = [
          41,
          "Lesson",
          [],
          [],
          "manual",
          null,
          0,
          1,
          "published",
          "feed",
          null,
          null,
          null,
          "2026-01-01 00:00:00",
          "2026-01-01 00:00:00",
        ];
        if (sql.includes("as `likeCount`")) row.push(0);
        if (sql.includes("as `commentCount`")) row.push(0);
        return [[row], []];
      }
      throw new Error("Unexpected fixture query");
    });
  database = await import("../apps/backend/src/db");
});
/** Возвращает окружение и spies после каждого независимого чтения. */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Проверяет, что обязательные media не исчезают из модели при инфраструктурном сбое. */
describe("post media read integrity", () => {
  /** Ошибка SQL media должна отклонить весь ответ вместо успешной неполной модели. */
  it.each(reads)(
    "rejects failed SQL in $name instead of a complete empty model",
    async ({ run }) => {
      transport.mediaError = new Error("PRIVATE_SQL_SENTINEL");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(run()).rejects.toThrow();
    },
  );
  /** Недоступная БД не является подтверждённым пустым результатом чтения. */
  it.each(reads)("rejects unavailable database in $name", async ({ run }) => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(run()).rejects.toThrow("Database not available");
  });
  /** Пустые media остаются успешным ответом при доступном SQL. */
  it.each(reads)(
    "keeps genuinely empty media successful in $name",
    async ({ run }) => {
      expect(postMedia(await run())).toEqual([]);
    },
  );
  /** После восстановления возвращает исходные идентификаторы и metadata без остаточного состояния ошибки. */
  it.each(reads)(
    "returns original IDs and metadata after $name recovers",
    async ({ run }) => {
      transport.mediaError = new Error("PRIVATE_SQL_SENTINEL");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(run()).rejects.toThrow();
      transport.mediaError = null;
      transport.mediaRows = [
        [
          51,
          41,
          "video",
          "https://assets.example.test/lesson.webm",
          null,
          "Lesson.webm",
          "video/webm",
          1234,
          72,
          0,
          "2026-01-01 00:00:00",
        ],
      ];
      expect(postMedia(await run())).toEqual([media]);
    },
  );
  /** Не запрашивает media для честно пустой страницы постов. */
  it("does not query media for an empty post page", async () => {
    transport.query.mockResolvedValue([[], []]);
    expect(await database.getPostsPaginated({ limit: 1 })).toEqual({
      posts: [],
      nextCursor: null,
    });
    const selects = transport.query.mock.calls
      .map(([query]) => query.sql as string)
      .filter(sql => /^select\b/i.test(sql));
    expect(selects).toHaveLength(1);
    expect(selects[0]).not.toContain("post_media");
  });
  /** Пустая подборка сохранённых ID не требует подключения к БД. */
  it("keeps an empty saved-ID selection successful without a database", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await database.getPostsByIds([])).toEqual([]);
  });
  /** Отличает недоступность БД от пустого справочника тегов. */
  it("distinguishes an unavailable database from an empty tag catalog", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(database.getAllTags()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
  /** Сохраняет успешный пустой список при доступной пустой таблице тегов. */
  it("keeps a genuinely empty reference tag table successful", async () => {
    transport.query.mockResolvedValue([[], []]);
    expect(await database.getAllTags()).toEqual([]);
  });
  /** Через HTTP проверяет безопасную ошибку чтения и последующее восстановление без раскрытия SQL и персональных данных. */
  it.each([
    { path: "admin.posts" },
    { path: "admin.getPostMedia", input: { postId: 41 } },
    { path: "feed.listPaginated", input: { limit: 1 } },
    { path: "feed.tags" },
  ])(
    "returns a sanitized HTTP failure for $path, then recovers",
    async ({ path, input }) => {
      const { appRouter } = await import("../apps/backend/src/routers");
      const app = express();
      app.use(
        "/api/trpc",
        createExpressMiddleware({
          router: appRouter,
          // Identity is a fixture; this is not a JWT or live authorization test.
          /** Подставляет тестового администратора только для маршрутизации; это не проверка настоящего JWT или сессии. */
          createContext: ({ req, res }) =>
            ({
              req,
              res,
              user: { id: 1, role: "admin", blockedAt: null },
            }) as TrpcContext,
        }),
      );
      const server = createServer(app);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      transport.mediaError = new Error(
        "PRIVATE_SQL_SENTINEL params private@example.test",
      );
      transport.tagError = transport.mediaError;
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      const url =
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trpc/${path}` +
        (input
          ? `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
          : "");
      try {
        const response = await fetch(url);
        expect(response.status).toBe(500);
        const body = await response.text();
        expect(body).toContain("Внутренняя ошибка сервера");
        expect(body).not.toMatch(
          /PRIVATE_SQL_SENTINEL|private@example|stack|select /,
        );
        transport.mediaError = null;
        transport.tagError = null;
        const recovered = await fetch(url);
        expect(recovered.status).toBe(200);
        if (path === "feed.tags") {
          const recoveredBody = await recovered.text();
          expect(recoveredBody).toContain('"slug":"winter"');
          expect(recoveredBody).toContain('"label":"Зима"');
          expect(recoveredBody).toContain('"category":"season"');
        }
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  );
});

/** Проверяет различие сбоя и честно пустых данных в администраторских списках и статистике. */
describe("admin content read availability", () => {
  /** Передаёт SQL-ошибку наружу, а после восстановления возвращает корректную пустую модель. */
  it.each([
    {
      name: "filtered posts",
      /** Читает отфильтрованный список администратора через настоящий фасад. */
      run: () => database.getAdminPostsFiltered(),
      want: [],
    },
    {
      name: "scheduled posts",
      /** Читает отложенные публикации через настоящий фасад. */
      run: () => database.getScheduledPosts(),
      want: [],
    },
    { name: "articles", /** Читает статьи через настоящий фасад. */ run: () => database.listAllArticles(), want: [] },
    {
      name: "statistics",
      /** Читает статистику с настоящей обработкой пустых SQL-агрегатов. */
      run: () => database.getPostStatistics(),
      want: emptyStatistics,
    },
  ])(
    "$name propagates SQL failure and permits genuinely empty data after recovery",
    async ({ run, want }) => {
      // Only the SQL transport fails. The real facade, repositories and Drizzle
      // must distinguish an unavailable read from a connected empty catalog.
      transport.query.mockRejectedValue(
        new Error("PRIVATE_ADMIN_SQL_SENTINEL"),
      );
      await expect(run()).rejects.toThrow();
      transport.query.mockImplementation(async ({ sql }: { sql: string }) => {
        // SQL aggregates return one row even for a connected empty catalog.
        // Preserve the actual transport shape; ordinary row reads stay empty.
        if (sql.includes("COUNT(CASE WHEN"))
          return [[[0, 0, 0, 0, 0, 0, 0, 0, 0]], []];
        if (sql.includes("COUNT(*)") && !sql.includes("limit"))
          return [[[0]], []];
        return [[], []];
      });
      expect(await run()).toEqual(want);
    },
  );
});
