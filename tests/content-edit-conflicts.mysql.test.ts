import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Pool } from "mysql2/promise";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: vi.fn(),
}));
const detail = z.object({ editRevision: z.string().regex(/^[a-f0-9]{64}$/) });
const postId = 99341,
  articleId = 99344,
  teaserId = 99345;
/** Проверяет ревизии двух редакторов постов и статей через HTTP без изменения данных stale-запросом. */
describe.skipIf(!testDatabaseUrl)(
  "editor concurrency on disposable MySQL and real HTTP",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    const tokens: string[] = [];
    /** Создаёт tRPC-клиент одного из двух администраторов suite. */
    const client = (which = 0) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: { Authorization: "Bearer " + tokens[which] },
          }),
        ],
      });
    /** Читает admin postDetail и проверяет формат 64-символьной editRevision. */
    const postVersion = async () => {
      const row = await client().admin.postDetail.query({ id: postId });
      expect(row).toHaveProperty(
        "editRevision",
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      return detail.parse(row).editRevision;
    };
    /** Читает admin articleDetail и проверяет формат содержательной editRevision. */
    const articleVersion = async () => {
      const row = await client().admin.articleDetail.query({ id: articleId });
      expect(row).toHaveProperty(
        "editRevision",
        expect.stringMatching(/^[a-f0-9]{64}$/),
      );
      return detail.parse(row).editRevision;
    };
    /** Читает фактические посты, статьи и media для независимой сверки после конфликтов. */
    const query = async (sql: string, args: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(sql, args))[0];
    /** Удаляет только собственные реакции, post-media, пост, тизер и статью. */
    async function clear() {
      await conn.query("DELETE FROM likes WHERE postId IN (?,?)", [
        postId,
        teaserId,
      ]);
      await conn.query("DELETE FROM post_media WHERE postId=?", [postId]);
      await conn.query("DELETE FROM posts WHERE id IN (?,?)", [
        postId,
        teaserId,
      ]);
      await conn.query("DELETE FROM articles WHERE id=?", [articleId]);
    }
    /** Создаёт изолированную content-схему, двух редакторов и настоящий локальный Nest API. */
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      await conn.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
      access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "editor-concurrency-only-synthetic-secret");
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(99340,'editor-guard-admin-a','admin'),(99346,'editor-guard-admin-b','admin')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base =
        "http://127.0.0.1:" +
        (app.getHttpServer().address() as AddressInfo).port;
      for (const openId of ["editor-guard-admin-a", "editor-guard-admin-b"])
        tokens.push(
          await sdk.createSessionToken(openId, { sessionVersion: 0 }),
        );
    });
    /** Включает обязательные ревизии и восстанавливает черновик поста и опубликованную статью с тизером. */
    beforeEach(async () => {
      vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "true");
      await clear();
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0 WHERE id IN(99340,99346)",
      );
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,status,published) VALUES(?,'Original',JSON_ARRAY(),JSON_ARRAY(),'draft',FALSE)",
        [postId],
      );
      await conn.query(
        "INSERT INTO articles(id,title,sections,access,published) VALUES(?,'Original article',JSON_ARRAY(JSON_OBJECT('type','text','text','Original body')),'club',TRUE)",
        [articleId],
      );
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,source,target,status,published) VALUES(?,'Original article',JSON_ARRAY(),JSON_ARRAY('exclusive'),?,'club','published',TRUE)",
        [teaserId, "article:" + articleId],
      );
    });
    /** Закрывает API, удаляет fixture и пользователей, закрывает пул и восстанавливает окружение. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await clear();
        await conn.query("DELETE FROM users WHERE id IN(99340,99346)");
        await conn.end();
      }
      await (
        (await getDb()) as (MySql2Database & { $client: Pool }) | null
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Повторное admin-чтение даёт стабильные ревизии, публичный detail не получает внутреннее edit-поле. */
    it("returns stable edit versions without changing public detail shape", async () => {
      expect(await postVersion()).toBe(await postVersion());
      expect(await articleVersion()).toBe(await articleVersion());
      const publicPost = await client().feed.getById.query({ id: postId });
      expect(publicPost ?? {}).not.toHaveProperty("editRevision");
    });
    /** Stale-правка текста, фото и публикации отклоняется целиком после принятой новой версии. */
    it("rejects a stale post body and publication together without side effects", async () => {
      const expectedRevision = await postVersion();
      await client().admin.updatePost.mutate({
        id: postId,
        text: "Fresh A",
        ...{ expectedRevision },
      });
      await expect(
        client(1).admin.updatePost.mutate({
          id: postId,
          text: "Original",
          status: "published",
          photos: ["https://example.test/not-written.jpg"],
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409, code: "CONFLICT" } });
      expect(
        (
          await query("SELECT text,status,published FROM posts WHERE id=?", [
            postId,
          ])
        )[0],
      ).toMatchObject({ text: "Fresh A", status: "draft", published: 0 });
      expect(await postVersion()).not.toBe(expectedRevision);
      expect(
        (await query("SELECT photos FROM posts WHERE id=?", [postId]))[0]
          .photos,
      ).toEqual([]);
    });
    /** Два независимых администратора одной ревизии дают ровно один успех и один 409. */
    it("serializes two independent admins: exactly one stale snapshot wins", async () => {
      const expectedRevision = await postVersion();
      const results = await Promise.allSettled(
        [0, 1].map((i) =>
          client(i).admin.updatePost.mutate({
            id: postId,
            text: "Writer " + i,
            ...{ expectedRevision },
          }),
        ),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find((r) => r.status === "rejected");
      expect(failed).toMatchObject({
        status: "rejected",
        reason: { data: { httpStatus: 409 } },
      });
    });
    /** Замена media без изменения timestamp поста всё равно меняет содержательную ревизию. */
    it("detects attachment changes even with an unchanged parent timestamp", async () => {
      await conn.query(
        "INSERT INTO post_media(id,postId,type,url,sortOrder) VALUES(99347,?,'video','https://example.test/old.mp4',0)",
        [postId],
      );
      const expectedRevision = await postVersion();
      await conn.query(
        "UPDATE post_media SET url='https://example.test/new.mp4' WHERE id=99347",
      );
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Stale body",
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409 } });
      expect(
        (await query("SELECT text FROM posts WHERE id=?", [postId]))[0].text,
      ).toBe("Original");
    });
    /** Добавленный лайк не вызывает ложный конфликт редактирования содержимого. */
    it("reactions do not invalidate the content revision", async () => {
      const expectedRevision = await postVersion();
      await conn.query("INSERT INTO likes(userId,postId) VALUES(99346,?)", [
        postId,
      ]);
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Updated",
          ...{ expectedRevision },
        }),
      ).resolves.toEqual({ success: true });
    });
    /** Stale-снятие публикации статьи не затирает новую статью или синхронизированный тизер. */
    it("rejects a stale article and preserves its synchronized teaser", async () => {
      const expectedRevision = await articleVersion();
      await client().admin.updateArticle.mutate({
        id: articleId,
        title: "Fresh article",
        ...{ expectedRevision },
      });
      await expect(
        client(1).admin.updateArticle.mutate({
          id: articleId,
          title: "Original article",
          published: false,
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409 } });
      expect(
        (
          await query("SELECT title,published FROM articles WHERE id=?", [
            articleId,
          ])
        )[0],
      ).toMatchObject({ title: "Fresh article", published: 1 });
      expect(
        (
          await query("SELECT text,published FROM posts WHERE id=?", [teaserId])
        )[0],
      ).toMatchObject({ text: "Fresh article", published: 1 });
    });
    /** Strict-режим требует revision даже для изменения только sortOrder. */
    it("requires a version in strict mode, including flag-only edits", async () => {
      await expect(
        client().admin.updatePost.mutate({ id: postId, sortOrder: 1 }),
      ).rejects.toMatchObject({ data: { httpStatus: 412 } });
      await expect(
        client().admin.updateArticle.mutate({ id: articleId, sortOrder: 1 }),
      ).rejects.toMatchObject({ data: { httpStatus: 412 } });
    });
    /** При выключенном strict legacy-запись разрешена, но переданная revision всё равно проверяется. */
    it("keeps legacy compatibility explicit while still validating supplied versions", async () => {
      vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "false");
      await client().admin.updatePost.mutate({ id: postId, text: "Legacy" });
      await client().admin.updateArticle.mutate({
        id: articleId,
        title: "Legacy",
      });
      const expectedRevision = "0".repeat(64);
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Bad",
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409 } });
    });
    /** Неверный формат revision даёт 400, некорректный rollout-флаг закрывает запись с 503. */
    it("does not let malformed versions or an invalid rollout flag bypass checks", async () => {
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Bad",
          ...{ expectedRevision: "oops" },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 400 } });
      vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "invalid");
      await expect(
        client().admin.updateArticle.mutate({ id: articleId, title: "Bad" }),
      ).rejects.toMatchObject({ data: { httpStatus: 503 } });
    });

    /** ASCII, кириллица и emoji сохраняются ровно на UTF-8 границе MySQL TEXT 65535 байт. */
    it.each([
      ["ASCII", "a".repeat(65_535)],
      ["Cyrillic", "я".repeat(32_767) + "a"],
      ["emoji", "🌿".repeat(16_383) + "abc"],
    ])(
      "stores the exact TEXT boundary for %s through HTTP",
      async (_kind, text) => {
        const expectedRevision = await postVersion();
        await client().admin.updatePost.mutate({
          id: postId,
          text,
          ...{ expectedRevision },
        });
        const [row] = await query(
          "SELECT text,OCTET_LENGTH(text) AS bytes FROM posts WHERE id=?",
          [postId],
        );
        expect(row.text).toBe(text);
        expect(row.bytes).toBe(65_535);
      },
    );
    /** После неизвестного клиенту результата чтение подтверждает запись, а повтор старой revision отклоняется. */
    it("reconciles an unobserved write by read; a stale retry cannot overwrite it", async () => {
      const expectedRevision = await postVersion();
      await client().admin.updatePost.mutate({
        id: postId,
        text: "Committed response lost",
        ...{ expectedRevision },
      });
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Committed response lost",
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409 } });
      const row = await client().admin.postDetail.query({ id: postId });
      expect(row?.text).toBe("Committed response lost");
      expect(detail.parse(row).editRevision).not.toBe(expectedRevision);
    });
    /** Текущее удаление media работает при strict и делает прежнюю content-revision устаревшей. */
    it("keeps current-state media deletion working in strict mode and invalidates old edits", async () => {
      await conn.query(
        "INSERT INTO post_media(id,postId,type,url,sortOrder) VALUES(99347,?,'video','https://example.test/video.mp4',0)",
        [postId],
      );
      const expectedRevision = await postVersion();
      await client().admin.deleteMedia.mutate({ id: 99347 });
      expect(
        await query("SELECT id FROM post_media WHERE id=99347"),
      ).toHaveLength(0);
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Stale",
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 409 } });
    });
    /** Блокировка администратора имеет приоритет над edit-precondition и не меняет пост. */
    it("retains authorization before the edit precondition", async () => {
      const expectedRevision = await postVersion();
      await conn.query(
        "UPDATE users SET blockedAt=UTC_TIMESTAMP() WHERE id=99340",
      );
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text: "Blocked",
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 401 } });
      expect(
        (await query("SELECT text FROM posts WHERE id=?", [postId]))[0].text,
      ).toBe("Original");
    });
    /** Превышение TEXT в байтах отклоняется и на create, и на update без SQL-обрезки или потери старого текста. */
    it("returns 400 for oversized UTF-8 text and preserves the old row", async () => {
      const expectedRevision = await postVersion();
      const text = "я".repeat(40_000);
      await expect(
        client().admin.updatePost.mutate({
          id: postId,
          text,
          ...{ expectedRevision },
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 400 } });
      expect(
        (await query("SELECT text FROM posts WHERE id=?", [postId]))[0].text,
      ).toBe("Original");
      await expect(
        client().admin.createPost.mutate({
          text,
          photos: [],
          tags: [],
          published: false,
        }),
      ).rejects.toMatchObject({ data: { httpStatus: 400 } });
    });
  },
);
