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
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

// Real admin HTTP/JWT and SQL. Trigger predicates touch only owned fixture rows.
describe.skipIf(!testDatabaseUrl)("atomic article/teaser writes", () => {
  let conn: Connection, application: INestApplication;
  let admin: ReturnType<typeof createTRPCProxyClient<AppRouter>>["admin"];
  const prefix = "atomic fixture ";
  const source = "article:9070";
  const gate = "backend_test_article_atomic_gate";
  const trigger = "backend_test_article_atomic_write";
  async function rows(sql: string, values: unknown[] = []) {
    const [result] = await conn.query<RowDataPacket[]>(sql, values);
    return result;
  }
  async function article(id = 9070) {
    return (await rows("SELECT * FROM articles WHERE id=?", [id]))[0];
  }
  async function teasers(id = 9070) {
    return rows("SELECT * FROM posts WHERE source=?", [`article:${id}`]);
  }
  async function clearOwnedRows() {
    const ids = [
      9070,
      9071,
      9072,
      ...(
        await rows("SELECT id FROM articles WHERE title LIKE ?", [prefix + "%"])
      ).map((row) => Number(row.id)),
    ];
    await conn.query(
      "DELETE FROM comment_likes WHERE commentId IN (9070,9071)",
    );
    await conn.query(
      "DELETE FROM comment_reports WHERE commentId IN (9070,9071)",
    );
    await conn.query("DELETE FROM post_comments WHERE id IN (9070,9071)");
    await conn.query("DELETE FROM likes WHERE userId=9070");
    await conn.query("DELETE FROM saved_posts WHERE userId=9070");
    await conn.query("DELETE FROM post_media WHERE id=9070");
    await conn.query(
      "DELETE FROM posts WHERE id IN (9070,9072) OR source IN (?)",
      [ids.map((id) => `article:${id}`)],
    );
    await conn.query("DELETE FROM articles WHERE id IN (?)", [ids]);
  }
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "atomic-article-fixture-secret-32-characters");
    vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
    await conn.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
      access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await conn.query(
      "INSERT INTO users (id,openId,role) VALUES (9070,'atomic-article-editor','admin')",
    );
    application = await createBackendApplication();
    await application.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
    const token = await sdk.createSessionToken("atomic-article-editor", {
      sessionVersion: 0,
    });
    admin = createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: base + "/api/trpc",
          transformer: superjson,
          headers: { Authorization: `Bearer ${token}` },
        }),
      ],
    }).admin;
  });
  beforeEach(async () => {
    await clearOwnedRows();
    await conn.query(`INSERT INTO articles (id,title,coverUrl,access,published,sections) VALUES
      (9070,'atomic fixture initial','https://assets.example.test/old.png','public',TRUE,JSON_ARRAY()),
      (9071,'atomic fixture draft',NULL,'club',FALSE,JSON_ARRAY())`);
    await conn.query(`INSERT INTO posts (id,text,photos,tags,source,target) VALUES
      (9070,'atomic fixture initial',JSON_ARRAY('https://assets.example.test/old.png'),JSON_ARRAY('exclusive'),'article:9070','club'),
      (9072,'atomic fixture other',JSON_ARRAY(),JSON_ARRAY(),'atomic-fixture-other','feed')`);
  });
  afterAll(async () => {
    await application?.close();
    if (conn) {
      await clearOwnedRows();
      await conn.query("DELETE FROM users WHERE id=9070");
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  async function rejectWrite(
    event: "INSERT" | "UPDATE" | "DELETE",
    table: "posts" | "articles",
    predicate: string,
    action: () => Promise<unknown>,
  ) {
    await conn.query(`CREATE TRIGGER ${trigger} BEFORE ${event} ON ${table} FOR EACH ROW
      BEGIN IF ${predicate} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Owned article write failure'; END IF; END`);
    try {
      await expect(action()).rejects.toMatchObject({
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
    } finally {
      await conn.query(`DROP TRIGGER ${trigger}`);
    }
  }
  async function relatedRows() {
    const result: Record<string, RowDataPacket[]> = {};
    for (const table of ["likes", "saved_posts", "post_media"])
      result[table] = await rows(
        `SELECT * FROM ${table} WHERE postId=9070 ORDER BY id`,
      );
    result.comments = await rows(
      "SELECT * FROM post_comments WHERE id IN (9070,9071) ORDER BY id",
    );
    for (const table of ["comment_likes", "comment_reports"])
      result[table] = await rows(
        `SELECT * FROM ${table} WHERE commentId=9070 ORDER BY id`,
      );
    return result;
  }
  async function seedDiscussion() {
    await conn.query("INSERT INTO likes (userId,postId) VALUES (9070,9070)");
    await conn.query(
      "INSERT INTO saved_posts (userId,postId) VALUES (9070,9070)",
    );
    await conn.query(
      "INSERT INTO post_media (id,postId,type,url) VALUES (9070,9070,'document','https://assets.example.test/atomic.pdf')",
    );
    await conn.query(
      "INSERT INTO post_comments (id,postId,userId,text) VALUES (9070,9070,9070,'owned comment')",
    );
    await conn.query(
      "INSERT INTO post_comments (id,postId,parentId,userId,text) VALUES (9071,9072,9070,9070,'external reply')",
    );
    await conn.query(
      "INSERT INTO comment_likes (commentId,userId) VALUES (9070,9070)",
    );
    await conn.query(
      "INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (9070,9070,'fixture')",
    );
  }

  it("rolls back article creation when teaser insertion fails", async () => {
    await rejectWrite(
      "INSERT",
      "posts",
      "NEW.text='atomic fixture rejected create'",
      () =>
        admin.createArticle.mutate({
          title: prefix + "rejected create",
          sections: [],
        }),
    );
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [
        prefix + "rejected create",
      ]),
    ).toEqual([]);
    expect(
      await rows("SELECT id FROM posts WHERE text=?", [
        prefix + "rejected create",
      ]),
    ).toEqual([]);
  });
  it("rolls back all article fields when its existing teaser edit fails", async () => {
    const before = await article(),
      teaserBefore = await teasers();
    await rejectWrite("UPDATE", "posts", `NEW.source='${source}'`, () =>
      admin.updateArticle.mutate({
        id: 9070,
        title: prefix + "edited",
        coverUrl: null,
        access: "club",
        sortOrder: 42,
        sections: [{ type: "text", text: "New body" }],
      }),
    );
    expect(await article()).toEqual(before);
    expect(await teasers()).toEqual(teaserBefore);
  });
  it("leaves a draft unpublished if its first teaser insertion fails", async () => {
    const before = await article(9071);
    await rejectWrite("INSERT", "posts", "NEW.source='article:9071'", () =>
      admin.updateArticle.mutate({ id: 9071, published: true }),
    );
    expect(await article(9071)).toEqual(before);
    expect(await teasers(9071)).toEqual([]);
  });
  it("restores published article and its entire cascade after unpublish fails", async () => {
    await seedDiscussion();
    const before = await article(),
      teaserBefore = await teasers(),
      relatedBefore = await relatedRows();
    await rejectWrite("DELETE", "posts", `OLD.source='${source}'`, () =>
      admin.updateArticle.mutate({ id: 9070, published: false }),
    );
    expect(await article()).toEqual(before);
    expect(await teasers()).toEqual(teaserBefore);
    expect(await relatedRows()).toEqual(relatedBefore);
  });
  it("restores teaser, discussion and detached replies if the final article deletion fails", async () => {
    await seedDiscussion();
    const before = await article(),
      teaserBefore = await teasers(),
      relatedBefore = await relatedRows();
    await rejectWrite("DELETE", "articles", "OLD.id=9070", () =>
      admin.deleteArticle.mutate({ id: 9070 }),
    );
    expect(await article()).toEqual(before);
    expect(await teasers()).toEqual(teaserBefore);
    expect(await relatedRows()).toEqual(relatedBefore);
  });
  it("commits the deletion cascade and keeps unrelated replies detached", async () => {
    await seedDiscussion();
    expect(await admin.deleteArticle.mutate({ id: 9070 })).toEqual({
      ok: true,
    });
    expect(await article()).toBeUndefined();
    expect(await teasers()).toEqual([]);
    const related = await relatedRows();
    expect(related.comments).toMatchObject([
      { id: 9071, postId: 9072, parentId: null, text: "external reply" },
    ]);
    expect(related.comments).toHaveLength(1);
    for (const [table, values] of Object.entries(related))
      if (table !== "comments") expect(values).toEqual([]);
    expect(await rows("SELECT id FROM posts WHERE id=9072")).toEqual([
      { id: 9072 },
    ]);
  });

  async function withGate(
    event: "INSERT" | "UPDATE" | "DELETE",
    predicate: string,
    check: (requests: Promise<unknown>[]) => Promise<void>,
  ) {
    expect(
      (await rows("SELECT GET_LOCK(?,3) acquired", [gate]))[0].acquired,
    ).toBe(1);
    let ownsTrigger = false;
    const requests: Promise<unknown>[] = [];
    try {
      await conn.query(`CREATE TRIGGER ${trigger} BEFORE ${event} ON posts FOR EACH ROW
        BEGIN IF ${predicate} THEN SET @backend_test_article_gate=GET_LOCK('${gate}',5);
        DO RELEASE_LOCK('${gate}'); END IF; END`);
      ownsTrigger = true;
      await check(requests);
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      await Promise.allSettled(requests);
      if (ownsTrigger) await conn.query(`DROP TRIGGER ${trigger}`);
    }
  }
  function start(requests: Promise<unknown>[], request: Promise<unknown>) {
    // Cleanup must settle in-flight failures even when an earlier assertion fails.
    void request.catch(() => {});
    requests.push(request);
  }
  async function waitForGate() {
    await vi.waitFor(
      async () => {
        expect(
          await rows(
            "SELECT 1 FROM performance_schema.metadata_locks WHERE OBJECT_TYPE='USER LEVEL LOCK' AND OBJECT_NAME=? AND LOCK_STATUS='PENDING'",
            [gate],
          ),
        ).not.toEqual([]);
      },
      { timeout: 3000, interval: 20 },
    );
  }
  async function waitForArticleWriter() {
    await vi.waitFor(
      async () => {
        expect(
          await rows(
            "SELECT 1 FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='users' AND l.INDEX_NAME='PRIMARY' AND l.LOCK_DATA='9070'",
          ),
        ).not.toEqual([]);
      },
      { timeout: 3000, interval: 20 },
    );
  }
  it("hides the newly inserted article until its teaser commits", async () => {
    const title = prefix + "gated create";
    await withGate("INSERT", `NEW.text='${title}'`, async (requests) => {
      start(requests, admin.createArticle.mutate({ title, sections: [] }));
      await waitForGate();
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [title]),
      ).toEqual([]);
      expect(await rows("SELECT id FROM posts WHERE text=?", [title])).toEqual(
        [],
      );
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      const [id] = await Promise.all(requests);
      expect(await article(Number(id))).toMatchObject({ title, published: 1 });
      expect(await teasers(Number(id))).toMatchObject([{ text: title }]);
      expect(await teasers(Number(id))).toHaveLength(1);
    });
  });
  it("exposes only the previous article and teaser while an edit is uncommitted", async () => {
    const before = await article(),
      teaserBefore = await teasers();
    await withGate("UPDATE", `NEW.source='${source}'`, async (requests) => {
      start(
        requests,
        admin.updateArticle.mutate({
          id: 9070,
          title: prefix + "gated edit",
          coverUrl: null,
        }),
      );
      await waitForGate();
      expect(await article()).toEqual(before);
      expect(await teasers()).toEqual(teaserBefore);
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      await Promise.all(requests);
      expect(await article()).toMatchObject({
        title: prefix + "gated edit",
        coverUrl: null,
      });
      expect(await teasers()).toMatchObject([
        { text: prefix + "gated edit", photos: [] },
      ]);
    });
  });
  it("serializes two draft publications into one teaser matching the final article", async () => {
    await withGate("INSERT", "NEW.source='article:9071'", async (requests) => {
      start(
        requests,
        admin.updateArticle.mutate({
          id: 9071,
          published: true,
          title: prefix + "first writer",
        }),
      );
      await waitForGate();
      start(
        requests,
        admin.updateArticle.mutate({
          id: 9071,
          published: true,
          title: prefix + "second writer",
          coverUrl: "https://assets.example.test/second.png",
        }),
      );
      await waitForArticleWriter();
      expect(await article(9071)).toMatchObject({
        published: 0,
        title: prefix + "draft",
      });
      expect(await teasers(9071)).toEqual([]);
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      expect(await Promise.all(requests)).toEqual([{ ok: true }, { ok: true }]);
      expect(await article(9071)).toMatchObject({
        title: prefix + "second writer",
        published: 1,
      });
      expect(await teasers(9071)).toMatchObject([
        {
          text: prefix + "second writer",
          photos: ["https://assets.example.test/second.png"],
          target: "club",
        },
      ]);
      expect(await teasers(9071)).toHaveLength(1);
    });
  });
  it("serializes delete behind in-flight publication without leaving an orphan teaser", async () => {
    await withGate("INSERT", "NEW.source='article:9071'", async (requests) => {
      start(
        requests,
        admin.updateArticle.mutate({ id: 9071, published: true }),
      );
      await waitForGate();
      start(requests, admin.deleteArticle.mutate({ id: 9071 }));
      await waitForArticleWriter();
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      expect(await Promise.all(requests)).toEqual([{ ok: true }, { ok: true }]);
      expect(await article(9071)).toBeUndefined();
      expect(await teasers(9071)).toEqual([]);
    });
  });
  it("keeps legacy orphan cleanup for deleting a missing article", async () => {
    await conn.query("DELETE FROM articles WHERE id=9070");
    expect(await admin.deleteArticle.mutate({ id: 9070 })).toEqual({
      ok: true,
    });
    expect(await teasers()).toEqual([]);
  });
  it("refuses a stale edit waiting behind a committed article deletion", async () => {
    await admin.updateArticle.mutate({ id: 9071, published: true });
    await withGate("DELETE", "OLD.source='article:9071'", async (requests) => {
      const deletion = admin.deleteArticle.mutate({ id: 9071 });
      start(requests, deletion);
      await waitForGate();
      const edit = admin.updateArticle.mutate({
        id: 9071,
        title: "Unsaved concurrent edit",
        published: true,
      });
      start(requests, edit);
      await waitForArticleWriter();
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      expect(await deletion).toEqual({ ok: true });
      await expect(edit).rejects.toMatchObject({
        message: "Статья не найдена",
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
      expect(await article(9071)).toBeUndefined();
      expect(await teasers(9071)).toEqual([]);
    });
  });
});
