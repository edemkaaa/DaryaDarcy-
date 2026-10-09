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
  default: { createPool: () => ({ on() {}, query: transport.query }) },
}));

// The SQL transport is doubled, not the repositories or Drizzle. These tests
// inject unavailable reads; real MySQL coverage remains a separate gate.
let database: typeof import("../apps/backend/src/db");
const reads = [
  { name: "feed list", run: () => database.getPosts() },
  { name: "feed page", run: () => database.getPostsPaginated({ limit: 1 }) },
  { name: "post detail", run: () => database.getPostById(41) },
  { name: "saved posts", run: () => database.getPostsByIds([41]) },
  { name: "admin posts", run: () => database.getAllPostsAdmin() },
  {
    name: "club page",
    run: () => database.getPostsForTarget("club", { limit: 1 }),
  },
  { name: "post media", run: () => database.getPostMediaByPostId(41) },
];
const media = {
  id: 51,
  postId: 41,
  type: "video",
  url: "https://assets.example.test/lesson.webm",
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
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  transport.mediaError = null;
  transport.mediaRows = [];
  transport.tagError = null;
  transport.query
    .mockReset()
    .mockImplementation(async ({ sql }: { sql: string }) => {
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
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("post media read integrity", () => {
  it.each(reads)(
    "rejects failed SQL in $name instead of a complete empty model",
    async ({ run }) => {
      transport.mediaError = new Error("PRIVATE_SQL_SENTINEL");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      await expect(run()).rejects.toThrow();
    },
  );
  it.each(reads)("rejects unavailable database in $name", async ({ run }) => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(run()).rejects.toThrow("Database not available");
  });
  it.each(reads)(
    "keeps genuinely empty media successful in $name",
    async ({ run }) => {
      expect(postMedia(await run())).toEqual([]);
    },
  );
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
  it("does not query media for an empty post page", async () => {
    transport.query.mockResolvedValue([[], []]);
    expect(await database.getPostsPaginated({ limit: 1 })).toEqual({
      posts: [],
      nextCursor: null,
    });
    expect(transport.query).toHaveBeenCalledOnce();
  });
  it("keeps an empty saved-ID selection successful without a database", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await database.getPostsByIds([])).toEqual([]);
  });
  it("keeps the historical empty tag catalog when no database is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await database.getAllTags()).toEqual([]);
  });
  it("keeps a genuinely empty reference tag table successful", async () => {
    transport.query.mockResolvedValue([[], []]);
    expect(await database.getAllTags()).toEqual([]);
  });
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

describe("admin content read availability", () => {
  it.each([
    {
      name: "filtered posts",
      run: () => database.getAdminPostsFiltered(),
      want: [],
    },
    {
      name: "scheduled posts",
      run: () => database.getScheduledPosts(),
      want: [],
    },
    { name: "articles", run: () => database.listAllArticles(), want: [] },
    {
      name: "statistics",
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
      transport.query.mockResolvedValue([[], []]);
      expect(await run()).toEqual(want);
    },
  );
});
