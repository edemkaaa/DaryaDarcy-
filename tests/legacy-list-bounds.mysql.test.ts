import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection, Pool, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

/** Проверяет явный предел старых полных списков и доступность page-процедур на коллекциях больше 200 строк. */
describe.skipIf(!testDatabaseUrl || process.env.LEGACY_LIST_BOUNDS_DATABASE_URL !== testDatabaseUrl)("bounded legacy post collections", () => {
  let conn: Connection, app: INestApplication, base: string, token: string;
  let commentPostId: number;
  /** Вызывает настоящий HTTP tRPC с admin JWT и извлекает результат или код ошибки. */
  async function call(path: string, input?: unknown) {
    const res = await fetch(`${base}/api/trpc/${path}${input === undefined ? "" : `?input=${encodeURIComponent(superjson.stringify(input))}`}`, { headers: { authorization: `Bearer ${token}` } });
    const body = await res.json();
    return { status: res.status, data: body.result ? superjson.deserialize<unknown>(body.result.data) : body.error?.json?.data?.code as unknown };
  }
  /** Только при явном отдельном URL создаёт 201 собственную запись каждого legacy-списка и локальный API. */
  beforeAll(async () => {
    conn = await openContentTestDatabase(); vi.stubEnv("DATABASE_URL", testDatabaseUrl!); vi.stubEnv("JWT_SECRET", "legacy-bounds-fixture-secret-32-characters");
    await conn.query("INSERT INTO users(id,openId,role) VALUES (98640,'legacy-list-bounds-admin','admin')");
    await conn.query("INSERT INTO users(openId) VALUES ?", [Array.from({ length: 201 }, (_, i) => [`legacy-bounds-extra-${i}`])]);
    await conn.query("INSERT INTO articles(title,sections,published) VALUES ?", [Array.from({ length: 201 }, () => ["Legacy bounds article fixture", "[]", false])]);
    await conn.query("INSERT INTO posts(text,photos,tags,source,target) VALUES ?", [Array.from({ length: 201 }, (_, i) => ["Bounded fixture", "[]", JSON.stringify([i === 200 ? "last-only" : "ordinary"]), "legacy-list-bounds", "feed"])]);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM posts WHERE source='legacy-list-bounds'");
    commentPostId = Number(rows[0].id);
    await conn.query("INSERT INTO post_comments(userId,postId,text) VALUES ?", [Array.from({ length: 201 }, () => [98640, commentPostId, "Legacy comments fixture"])]);
    await conn.query("INSERT INTO saved_posts(userId,postId) VALUES ?", [rows.map(row => [98640, row.id])]);
    app = await createBackendApplication(); await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`; token = await sdk.createSessionToken("legacy-list-bounds-admin", { sessionVersion: 0 });
  });
  /** Закрывает API, удаляет только suite-фикстуры по owner/source/title и закрывает пул. */
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await conn.query("DELETE FROM saved_posts WHERE userId=98640");
      await conn.query("DELETE FROM post_comments WHERE userId=98640");
      await conn.query("DELETE FROM posts WHERE source='legacy-list-bounds'");
      await conn.query("DELETE FROM users WHERE openId LIKE 'legacy-bounds-extra-%'");
      await conn.query("DELETE FROM articles WHERE title='Legacy bounds article fixture'");
      await conn.query("DELETE FROM users WHERE id=98640"); await conn.end();
    }
    await ((await getDb()) as unknown as { $client: Pool })?.$client.end(); vi.unstubAllEnvs();
  });
  /** Переполненные legacy-коллекции возвращают 413 вместо полной гидратации или скрытого усечения. */
  it.each(["feed.list", "feed.savedPosts", "admin.posts", "admin.members", "admin.articles"])("refuses oversized %s explicitly instead of hydrating or silently truncating", async path => {
    expect(await call(path)).toEqual({ status: 413, data: "PAYLOAD_TOO_LARGE" });
  });
  /** Тег фильтруется до cap, а paginated feed и saved остаются рабочими на большой коллекции. */
  it("filters legacy feed tags before the cap and keeps page APIs usable", async () => {
    const filtered = await call("feed.list", { tag: "last-only" });
    expect(filtered.status).toBe(200); expect(filtered.data).toHaveLength(1);
    const paged = await call("feed.listPaginated", { limit: 12 });
    expect(paged.status).toBe(200); expect((paged.data as { posts: unknown[] }).posts).toHaveLength(12); expect(paged.data).toMatchObject({ nextCursor: 12 });
    const saved = await call("feed.savedPostsPage", { limit: 12, target: "feed" });
    expect(saved.status).toBe(200); expect((saved.data as { items: unknown[] }).items).toHaveLength(12);
  });
  /** Legacy-список комментариев ограничен, но отдельная commentsPage выдаёт запрошенную страницу. */
  it("bounds the old comments collection and preserves its page endpoint", async () => {
    expect((await call("club.comments", { postId: commentPostId })).status).toBe(413);
    const page = await call("club.commentsPage", { postId: commentPostId, limit: 12 });
    expect(page.status).toBe(200); expect((page.data as { items: unknown[] }).items).toHaveLength(12);
  });
  /** Дробные и отрицательные идентификаторы отклоняются валидацией до чтения данных. */
  it.each([
    ["feed.getById", { id: 1.5 }], ["feed.getById", { id: -1 }],
    ["admin.getPostMedia", { postId: 1.5 }], ["videos.getById", { id: -1 }],
  ])("refuses invalid identifiers before reading %s", async (path, input) => {
    expect((await call(path, input)).status).toBe(400);
  });
});
