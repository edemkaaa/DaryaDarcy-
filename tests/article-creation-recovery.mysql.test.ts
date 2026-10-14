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
import { compactContentRecovery } from "../apps/backend/src/content/recovery-compaction";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

// Native HTTP/JWT/SQL. No mocks for authorization, writes or lost-response recovery.
describe.skipIf(!testDatabaseUrl)("durable article creation recovery", () => {
  let conn: Connection,
    application: INestApplication,
    base: string,
    bearer: string;
  const prefix = "recovery fixture ";
  const key = "cb7e9219-b57b-46ba-8718-a41b61197b10";
  const input = {
    title: prefix + "article",
    sections: [{ type: "text" as const, text: "body" }],
    idempotencyKey: key,
  };
  const client = (
    token: string | null = bearer,
    transport: typeof fetch = fetch,
  ) =>
    createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: base + "/api/trpc",
          transformer: superjson,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          fetch: transport,
        }),
      ],
    });
  async function rows(query: string, values: unknown[] = []) {
    const [result] = await conn.query<RowDataPacket[]>(query, values);
    return result;
  }
  async function cleanup() {
    const ids = (
      await rows("SELECT id FROM articles WHERE title LIKE ?", [prefix + "%"])
    ).map((row) => row.id);
    if (ids.length) {
      await conn.query("DELETE FROM posts WHERE source IN (?)", [
        ids.map((id) => `article:${id}`),
      ]);
      await conn.query("DELETE FROM articles WHERE id IN (?)", [ids]);
    }
    if ((await rows("SHOW TABLES LIKE 'article_creation_requests'")).length)
      await conn.query(
        "DELETE FROM article_creation_requests WHERE actorUserId IN (9090,9091)",
      );
    await conn.query(
      "DELETE FROM content_recovery_markers WHERE kind='article' AND actorUserId IN (9090,9091)",
    );
  }
  async function status(token: string | null = bearer, requestKey = key) {
    const response = await fetch(
      `${base}/api/trpc/admin.articleCreationStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: requestKey }))}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    const body = await response.json();
    return {
      code: response.status,
      data: body.result
        ? superjson.deserialize(body.result.data)
        : body.error?.json?.data?.code,
    };
  }
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "article-recovery-fixture-secret-32-chars");
    vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
    await conn.query(
      `CREATE TABLE IF NOT EXISTS articles (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`,
    );
    await conn.query(
      "INSERT INTO users (id,openId,role) VALUES (9090,'recovery-editor','admin'),(9091,'recovery-other-editor','admin')",
    );
    application = await createBackendApplication();
    await application.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
    bearer = await sdk.createSessionToken("recovery-editor", {
      sessionVersion: 0,
    });
  });
  beforeEach(async () => {
    await cleanup();
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    await conn.query(
      "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9090",
    );
  });
  afterAll(async () => {
    await application?.close();
    if (conn) {
      await cleanup();
      await conn.query("DELETE FROM users WHERE id IN (9090,9091)");
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  it("checks a committed result without creating another article", async () => {
    expect(await status()).toEqual({
      code: 200,
      data: { status: "notRecorded" },
    });
    const id = await client().admin.createArticle.mutate(input);
    expect(await status()).toEqual({
      code: 200,
      data: { status: "created", articleId: id },
    });
    await client().admin.deleteArticle.mutate({ id });
    expect(await status()).toEqual({
      code: 200,
      data: { status: "deleted", articleId: id },
    });
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([]);
  });
  it("expired article recovery refuses create and status without recreating a deleted material", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await client().admin.deleteArticle.mutate({ id });
    await conn.query(
      "UPDATE article_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=9090",
    );
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    await expect(
      client().admin.createArticle.mutate(input),
    ).rejects.toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
    expect(await status()).toEqual({ code: 409, data: "CONFLICT" });
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([]);
    expect(
      await rows("SELECT id FROM posts WHERE source=?", [`article:${id}`]),
    ).toEqual([]);
    expect(
      await rows(
        "SELECT articleId FROM article_creation_requests WHERE actorUserId=9090",
      ),
    ).toEqual([{ articleId: id }]);
  });
  it("expired status of a live article is not reported as notRecorded or success", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await conn.query(
      "UPDATE article_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=9090",
    );
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    expect(await status()).toEqual({ code: 409, data: "CONFLICT" });
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([{ id }]);
  });
  it("disabled expiry retains old article creation and status replay", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await conn.query(
      "UPDATE article_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=9090",
    );
    expect(await client().admin.createArticle.mutate(input)).toBe(id);
    expect(await status()).toEqual({
      code: 200,
      data: { status: "created", articleId: id },
    });
  });
  it("a compacted article refuses replay and never returns notRecorded", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await conn.query(
      "UPDATE article_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=9090",
    );
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
    expect((await compactContentRecovery((await getDb())!)).article).toBe(1);
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    await expect(
      client().admin.createArticle.mutate(input),
    ).rejects.toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
    expect(await status()).toEqual({ code: 409, data: "CONFLICT" });
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([{ id }]);
    expect(
      await rows(
        "SELECT articleId FROM article_creation_requests WHERE actorUserId=9090",
      ),
    ).toEqual([]);
  });
  it("does not reveal a successful creation to a guest", async () => {
    await client().admin.createArticle.mutate(input);
    expect(await status(null)).toEqual({ code: 401, data: "UNAUTHORIZED" });
    await expect(
      client(null).admin.createArticle.mutate(input),
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
    expect(
      await rows(
        "SELECT articleId FROM article_creation_requests WHERE actorUserId=9090",
      ),
    ).toHaveLength(1);
  });
  it("never reverts an edited article when its original create is replayed", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await client().admin.updateArticle.mutate({
      id,
      title: prefix + "edited",
      published: false,
    });
    expect(await client().admin.createArticle.mutate(input)).toBe(id);
    expect(
      await rows("SELECT title,published FROM articles WHERE id=?", [id]),
    ).toEqual([{ title: prefix + "edited", published: 0 }]);
    expect(
      await rows("SELECT id FROM posts WHERE source=?", [`article:${id}`]),
    ).toEqual([]);
  });
  it("rejects reordering the accepted section sequence under the same key", async () => {
    const sections = [
      { type: "text" as const, text: "first" },
      { type: "text" as const, text: "second" },
    ];
    await client().admin.createArticle.mutate({ ...input, sections });
    await expect(
      client().admin.createArticle.mutate({
        ...input,
        sections: [sections[1], sections[0]],
      }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });
  it("refuses a nontransactional journal rather than pretending creation is atomic", async () => {
    await conn.query("ALTER TABLE article_creation_requests ENGINE=MyISAM");
    try {
      await expect(
        client().admin.createArticle.mutate(input),
      ).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
      expect(await status()).toEqual({
        code: 500,
        data: "INTERNAL_SERVER_ERROR",
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
    } finally {
      await conn.query("ALTER TABLE article_creation_requests ENGINE=InnoDB");
    }
  });
  it("fails closed before creating when the ledger lacks its unique request key", async () => {
    await conn.query("ALTER TABLE article_creation_requests DROP PRIMARY KEY");
    try {
      await expect(
        client().admin.createArticle.mutate(input),
      ).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
      expect(await status()).toEqual({
        code: 500,
        data: "INTERNAL_SERVER_ERROR",
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
    } finally {
      await conn.query(
        "ALTER TABLE article_creation_requests ADD PRIMARY KEY (requestKey)",
      );
    }
  });
  it("recovers the original ID with a fresh client after a committed response is lost", async () => {
    let committedId = 0;
    const lostReply: typeof fetch = async (request, options) => {
      const response = await fetch(request, options);
      expect(response.status).toBe(200);
      committedId = superjson.deserialize(
        (await response.json()).result.data,
      ) as number;
      throw new Error("Owned lost HTTP acknowledgement");
    };
    await expect(
      client(bearer, lostReply).admin.createArticle.mutate(input),
    ).rejects.toThrow("Owned lost HTTP acknowledgement");
    expect(committedId).toBeGreaterThan(0);
    expect(await status()).toEqual({
      code: 200,
      data: { status: "created", articleId: committedId },
    });
    expect(await client().admin.createArticle.mutate(input)).toBe(committedId);
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([{ id: committedId }]);
    expect(
      await rows("SELECT id FROM posts WHERE source=?", [
        `article:${committedId}`,
      ]),
    ).toHaveLength(1);
  });
  it("serializes twelve concurrent creation attempts into one article and teaser", async () => {
    const ids = await Promise.all(
      Array.from({ length: 12 }, () =>
        client().admin.createArticle.mutate(input),
      ),
    );
    expect(new Set(ids).size).toBe(1);
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([{ id: ids[0] }]);
    expect(
      await rows("SELECT id FROM posts WHERE source=?", [`article:${ids[0]}`]),
    ).toHaveLength(1);
    expect(
      await rows(
        "SELECT articleId FROM article_creation_requests WHERE actorUserId=9090",
      ),
    ).toEqual([{ articleId: ids[0] }]);
  });
  it("scopes the same key to its authenticated creator", async () => {
    const id = await client().admin.createArticle.mutate(input);
    const other = await sdk.createSessionToken("recovery-other-editor", {
      sessionVersion: 0,
    });
    expect(await status(other)).toEqual({
      code: 200,
      data: { status: "notRecorded" },
    });
    const otherId = await client(other).admin.createArticle.mutate(input);
    expect(otherId).not.toBe(id);
    expect(await status(other)).toEqual({
      code: 200,
      data: { status: "created", articleId: otherId },
    });
  });
  it("hashes equivalent accepted defaults but detects changed ordered sections", async () => {
    const id = await client().admin.createArticle.mutate(input);
    expect(
      await client().admin.createArticle.mutate({
        ...input,
        title: "  " + input.title + "  ",
        coverUrl: null,
        sortOrder: 0,
        access: "club",
        published: true,
        sections: [
          {
            type: "text",
            text: "body",
            url: "",
            label: "",
            caption: "",
            urls: [],
          },
        ],
      }),
    ).toBe(id);
    await expect(
      client().admin.createArticle.mutate({
        ...input,
        sections: [{ type: "text", text: "changed" }],
      }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });
  it.each([
    "",
    "invalid",
    key.toUpperCase(),
    "cb7e9219-b57b-16ba-8718-a41b61197b10",
  ])(
    "rejects invalid creation keys before storing anything (%s)",
    async (badKey) => {
      await expect(
        client().admin.createArticle.mutate({
          ...input,
          idempotencyKey: badKey,
        }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
      expect(await status(bearer, badKey)).toEqual({
        code: 400,
        data: "BAD_REQUEST",
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT articleId FROM article_creation_requests WHERE actorUserId=9090",
        ),
      ).toEqual([]);
    },
  );
  it.each([
    "role='user'",
    "role='moderator'",
    "blockedAt=NOW()",
    "sessionVersion=1",
  ])(
    "denies replay and result lookup after current authority changes (%s)",
    async (patch) => {
      const id = await client().admin.createArticle.mutate(input);
      await conn.query(`UPDATE users SET ${patch} WHERE id=9090`);
      const code = patch.startsWith("role") ? "FORBIDDEN" : "UNAUTHORIZED";
      await expect(
        client().admin.createArticle.mutate(input),
      ).rejects.toMatchObject({ data: { code } });
      expect(await status()).toEqual({
        code: code === "FORBIDDEN" ? 403 : 401,
        data: code,
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([{ id }]);
    },
  );
  it("refuses to take over an incomplete committed result", async () => {
    const id = await client().admin.createArticle.mutate(input);
    await conn.query(
      "UPDATE article_creation_requests SET articleId=NULL WHERE actorUserId=9090",
    );
    await expect(
      client().admin.createArticle.mutate(input),
    ).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
    expect(await status()).toEqual({
      code: 500,
      data: "INTERNAL_SERVER_ERROR",
    });
    expect(
      await rows("SELECT id FROM articles WHERE title=?", [input.title]),
    ).toEqual([{ id }]);
  });
  it("rolls the intent and article back when its teaser insert fails", async () => {
    await conn.query(
      `CREATE TRIGGER backend_test_recovery_rollback BEFORE INSERT ON posts FOR EACH ROW BEGIN IF NEW.text='recovery fixture article' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Owned teaser failure'; END IF; END`,
    );
    try {
      await expect(
        client().admin.createArticle.mutate(input),
      ).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
      expect(await status()).toEqual({
        code: 200,
        data: { status: "notRecorded" },
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
    } finally {
      await conn.query("DROP TRIGGER backend_test_recovery_rollback");
    }
    const id = await client().admin.createArticle.mutate(input);
    expect(await status()).toEqual({
      code: 200,
      data: { status: "created", articleId: id },
    });
  });
  it("keeps legacy unkeyed calls independent and numeric", async () => {
    const { idempotencyKey: _key, ...legacy } = input;
    const first = await client().admin.createArticle.mutate(legacy);
    const second = await client().admin.createArticle.mutate(legacy);
    expect(first).toBeGreaterThan(0);
    expect(second).not.toBe(first);
    expect(await status()).toEqual({
      code: 200,
      data: { status: "notRecorded" },
    });
  });
  it("fails closed with no ledger while legacy calls keep their semantics", async () => {
    await conn.query(
      "RENAME TABLE article_creation_requests TO backend_test_recovery_ledger_backup",
    );
    try {
      await expect(
        client().admin.createArticle.mutate(input),
      ).rejects.toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
      expect(await status()).toEqual({
        code: 500,
        data: "INTERNAL_SERVER_ERROR",
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
      const { idempotencyKey: _key, ...legacy } = input;
      expect(await client().admin.createArticle.mutate(legacy)).toBeGreaterThan(
        0,
      );
    } finally {
      await conn.query(
        "RENAME TABLE backend_test_recovery_ledger_backup TO article_creation_requests",
      );
    }
  });
  it("never interprets an uncommitted creation as a confirmed absence", async () => {
    const gate = "backend_test_recovery_gate";
    await conn.query("SELECT GET_LOCK(?,3)", [gate]);
    await conn.query(
      `CREATE TRIGGER backend_test_recovery_wait BEFORE INSERT ON articles FOR EACH ROW BEGIN IF NEW.title='recovery fixture article' THEN SET @recovery_gate=GET_LOCK('backend_test_recovery_gate',5); DO RELEASE_LOCK('backend_test_recovery_gate'); END IF; END`,
    );
    const calls: Promise<number>[] = [];
    try {
      calls.push(client().admin.createArticle.mutate(input));
      await vi.waitFor(
        async () =>
          expect(
            (
              await rows(
                "SELECT 1 FROM performance_schema.metadata_locks WHERE OBJECT_TYPE='USER LEVEL LOCK' AND OBJECT_NAME=? AND LOCK_STATUS='PENDING'",
                [gate],
              )
            ).length,
          ).toBeGreaterThan(0),
        { timeout: 3000, interval: 20 },
      );
      expect(await status()).toEqual({
        code: 200,
        data: { status: "notRecorded" },
      });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([]);
      calls.push(client().admin.createArticle.mutate(input));
      await vi.waitFor(
        async () =>
          expect(
            (
              await rows(
                "SELECT 1 FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='users' AND l.LOCK_DATA='9090'",
              )
            ).length,
          ).toBeGreaterThan(0),
        { timeout: 3000, interval: 20 },
      );
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      const ids = await Promise.all(calls);
      expect(ids[1]).toBe(ids[0]);
      expect(await status()).toEqual({
        code: 200,
        data: { status: "created", articleId: ids[0] },
      });
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
      await Promise.allSettled(calls);
      await conn.query("DROP TRIGGER backend_test_recovery_wait");
    }
  });
  it("keeps the original creation across two independent compiled server processes", async () => {
    const directory = mkdtempSync(resolve(".tmp-article-recovery-"));
    const entry = join(directory, "application.mjs");
    try {
      await build({
        stdin: {
          loader: "ts",
          resolveDir: process.cwd(),
          contents: `
        import {createBackendApplication} from './apps/backend/src/_core/application';
        import {sdk} from './apps/backend/src/_core/sdk';
        import {getDb} from './apps/backend/src/db';
        import {createTRPCProxyClient,httpLink} from '@trpc/client';
        import superjson from 'superjson';
        const app=await createBackendApplication();
        try {
          await app.listen(0,'127.0.0.1');
          const token=await sdk.createSessionToken('recovery-editor',{sessionVersion:0});
          const admin=createTRPCProxyClient({links:[httpLink({url:'http://127.0.0.1:'+app.getHttpServer().address().port+'/api/trpc',transformer:superjson,headers:{Authorization:'Bearer '+token}})]}).admin;
          const id=await admin.createArticle.mutate(${JSON.stringify(input)});
          const status=await admin.articleCreationStatus.query({idempotencyKey:${JSON.stringify(key)}});
          console.log('RECOVERY_RESULT:'+JSON.stringify({id,status}));
        } finally {await app.close();const db=await getDb();await db?.$client.end();}
      `,
        },
        platform: "node",
        packages: "external",
        bundle: true,
        format: "esm",
        outfile: entry,
      });
      const run = () => {
        const output = execFileSync(process.execPath, [entry], {
          cwd: tmpdir(),
          encoding: "utf8",
          timeout: 10000,
          env: {
            NODE_ENV: "production",
            DATABASE_URL: testDatabaseUrl!,
            JWT_SECRET: "compiled-article-recovery-synthetic-secret",
            PUBLIC_APP_URL: "https://club.example.test",
          },
        });
        const line = output
          .split("\n")
          .find((value) => value.startsWith("RECOVERY_RESULT:"));
        expect(line).toBeDefined();
        return JSON.parse(line!.slice("RECOVERY_RESULT:".length));
      };
      const first = run();
      expect(first.id).toBeGreaterThan(0);
      expect(run()).toEqual(first);
      expect(first.status).toEqual({ status: "created", articleId: first.id });
      expect(
        await rows("SELECT id FROM articles WHERE title=?", [input.title]),
      ).toEqual([{ id: first.id }]);
      expect(
        await rows("SELECT id FROM posts WHERE source=?", [
          `article:${first.id}`,
        ]),
      ).toHaveLength(1);
    } finally {
      rmSync(entry, { force: true });
      rmdirSync(directory);
    }
  }, 25000);
});
