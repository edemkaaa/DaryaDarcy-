import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { AddressInfo } from "node:net";
import superjson from "superjson";
import { drizzle } from "drizzle-orm/mysql2";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { compactContentRecovery } from "../apps/backend/src/content/recovery-compaction";

type Page = {
  items: { requestId: string; createdAt: Date; status: string }[];
  nextCursor: string | null;
};
describe.skipIf(!testDatabaseUrl)(
  "own recovery export through native HTTP/JWT/SQL",
  () => {
    let conn: Connection,
      app: Awaited<ReturnType<typeof createBackendApplication>>,
      base: string,
      token: string;
    const key = (value: string) => value.repeat(64);
    async function cleanup() {
      await conn.query(
        "DELETE FROM posts WHERE id=97580 AND source='r6-export-created'",
      );
      await conn.query(
        "DELETE FROM articles WHERE id=97580 AND title='r6-export-created'",
      );
      for (const table of [
        "post_creation_requests",
        "article_creation_requests",
        "content_recovery_markers",
        "private_attachment_uploads",
      ])
        await conn.query(
          `DELETE FROM ${table} WHERE actorUserId IN (97580,97581)`,
        );
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      await conn.query(
        "CREATE TABLE IF NOT EXISTS articles(id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB",
      );
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "r6-export-fixture-secret-32-characters");
      await conn.query(
        "INSERT INTO users(id,openId,role,sessionVersion) VALUES(97580,'r6-export-owner','admin',0),(97581,'r6-export-neighbor','admin',0)",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("r6-export-owner", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await cleanup();
      vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "false");
      await conn.query(
        "UPDATE users SET sessionVersion=0,blockedAt=NULL,role='admin' WHERE id=97580",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.query("DELETE FROM users WHERE id IN(97580,97581)");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function request(input: unknown, bearer: string | undefined = token) {
      const response = await fetch(
        `${base}/api/trpc/profileExtras.recoveryExport?input=${encodeURIComponent(JSON.stringify(superjson.serialize(input)))}`,
        {
          headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
          signal: AbortSignal.timeout(10000),
        },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result
          ? superjson.deserialize<Page>(json.result.data)
          : undefined,
        error: json.error?.json,
      };
    }
    async function fixture(kind: "post" | "article") {
      const table =
        kind === "post"
          ? "post_creation_requests"
          : "article_creation_requests";
      const resultColumn = kind === "post" ? "postId" : "articleId";
      const claim = kind === "article" ? ",claimToken" : "";
      const claimValue = kind === "article" ? ",'fixture-claim-token'" : "";
      await conn.query(
        `INSERT INTO ${table}(requestKey,actorUserId,payloadHash,${resultColumn}${claim}) VALUES(?,97580,REPEAT('e',64),97580${claimValue}),(?,97580,REPEAT('e',64),97580${claimValue}),(?,97581,REPEAT('e',64),97581${claimValue})`,
        [key("1"), key("3"), key("4")],
      );
      await conn.query(
        "INSERT INTO content_recovery_markers(kind,requestKey,actorUserId,createdAt) VALUES(?,?,97580,DATE_SUB(NOW(),INTERVAL 31 DAY))",
        [kind, key("2")],
      );
    }
    it.each(["post", "article"] as const)(
      "exports only own %s records with bounded stable pagination",
      async (kind) => {
        await fixture(kind);
        const first = await request({ kind, limit: 2 });
        expect(first.status).toBe(200);
        expect(
          first.data?.items.map((row) => [row.requestId, row.status]),
        ).toEqual([
          [key("1"), "deleted"],
          [key("2"), "expired"],
        ]);
        expect(first.data?.nextCursor).toBe(key("2"));
        const next = await request({
          kind,
          limit: 2,
          afterKey: first.data!.nextCursor,
        });
        expect(next.data?.items.map((row) => row.requestId)).toEqual([
          key("3"),
        ]);
        expect(next.data?.nextCursor).toBeNull();
        for (const row of first.data!.items)
          expect(Object.keys(row).sort()).toEqual([
            "createdAt",
            "requestId",
            "status",
          ]);
      },
    );
    it("does not leak private filename, storage evidence or draft download identity", async () => {
      await conn.query(
        "INSERT INTO private_attachment_uploads(requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize,state,etag) VALUES(?,97580,'97580000-0000-4000-8000-000000000001',REPEAT('e',64),REPEAT('f',64),'document','Personal name.pdf','application/pdf',10,'ready','private-etag'),(?,97581,'97580000-0000-4000-8000-000000000002',REPEAT('e',64),REPEAT('f',64),'document','Neighbor.pdf','application/pdf',10,'pending',NULL)",
        [key("1"), key("2")],
      );
      const result = await request({ kind: "private_attachment" });
      expect(result.status).toBe(200);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0].status).toBe("ready");
      expect(Object.keys(result.data!.items[0]).sort()).toEqual([
        "createdAt",
        "requestId",
        "status",
      ]);
    });
    it.each(["post", "article"] as const)(
      "reports a live %s without exporting its draft content or ID",
      async (kind) => {
        await fixture(kind);
        if (kind === "post")
          await conn.query(
            "INSERT INTO posts(id,text,photos,tags,source,published,status) VALUES(97580,'Private draft',JSON_ARRAY(),JSON_ARRAY(),'r6-export-created',FALSE,'draft')",
          );
        else
          await conn.query(
            "INSERT INTO articles(id,title,sections,published) VALUES(97580,'r6-export-created',JSON_ARRAY(),FALSE)",
          );
        const result = await request({ kind });
        expect(result.status).toBe(200);
        expect(result.data!.items.map((row) => row.status)).toEqual([
          "created",
          "expired",
          "created",
        ]);
        expect(JSON.stringify(result.data)).not.toMatch(
          /Private draft|r6-export-created|97580/,
        );
      },
    );
    it("reports pending uploads and refuses invalid ready storage evidence", async () => {
      await conn.query(
        "INSERT INTO private_attachment_uploads(requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize,state) VALUES(?,97580,'97580000-0000-4000-8000-000000000003',REPEAT('e',64),REPEAT('f',64),'document','Pending.pdf','application/pdf',10,'pending')",
        [key("1")],
      );
      expect(
        (await request({ kind: "private_attachment" })).data!.items[0].status,
      ).toBe("pending");
      await conn.query(
        "UPDATE private_attachment_uploads SET state='ready' WHERE actorUserId=97580",
      );
      expect((await request({ kind: "private_attachment" })).status).toBe(503);
    });
    it("preserves cursor continuity across compaction and never revives an expired result", async () => {
      await fixture("post");
      await conn.query(
        "UPDATE post_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE requestKey=?",
        [key("3")],
      );
      const first = await request({ kind: "post", limit: 2 });
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
      await compactContentRecovery(drizzle(conn), 100);
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
      const next = await request({
        kind: "post",
        afterKey: first.data!.nextCursor,
      });
      expect(
        next.data?.items.map((row) => [row.requestId, row.status]),
      ).toEqual([[key("3"), "expired"]]);
    });
    it.each([
      { kind: "post", userId: 97581 },
      { kind: "post", limit: 101 },
      { kind: "post", afterKey: "invalid" },
      { kind: "billing" },
    ])(
      "rejects target override and malformed/broad input %j",
      async (input) => {
        expect((await request(input)).status).toBe(400);
      },
    );
    it("denies guests and disabled exports", async () => {
      expect((await request({ kind: "post" }, "")).status).toBe(401);
      vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "false");
      expect((await request({ kind: "post" })).status).toBe(404);
    });
    it("denies revoked and blocked users without revealing records", async () => {
      await fixture("post");
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97580");
      expect((await request({ kind: "post" })).status).toBe(401);
      await conn.query(
        "UPDATE users SET sessionVersion=0,blockedAt=NOW() WHERE id=97580",
      );
      // Existing SDK rejects blocked authentication; the HTTP context is guest.
      expect((await request({ kind: "post" })).status).toBe(401);
    });
    it("rechecks the epoch and block for an already authenticated RPC context", async () => {
      const user = await getUserByOpenId("r6-export-owner");
      const caller = appRouter.createCaller({
        user: user!,
        req: {} as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97580");
      await expect(
        caller.profileExtras.recoveryExport({ kind: "post" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await conn.query(
        "UPDATE users SET sessionVersion=0,blockedAt=NOW() WHERE id=97580",
      );
      await expect(
        caller.profileExtras.recoveryExport({ kind: "post" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("returns a point-in-time export without waiting for an in-flight owner lock", async () => {
      await fixture("post");
      await conn.beginTransaction();
      await conn.query("SELECT id FROM users WHERE id=97580 FOR UPDATE");
      let completed = false;
      const pending = request({ kind: "post" }).then((result) => {
        completed = true;
        return result;
      });
      try {
        await vi.waitFor(() => expect(completed).toBe(true), {
          timeout: 1000,
          interval: 20,
        });
        expect((await pending).status).toBe(200);
      } finally {
        await conn.rollback();
        await pending;
      }
    });
    it("allows personal export to a member and does not return other owners", async () => {
      await fixture("article");
      await conn.query("UPDATE users SET role='user' WHERE id=97580");
      const result = await request({ kind: "article" });
      expect(result.status).toBe(200);
      expect(result.data!.items.map((row) => row.requestId)).toEqual([
        key("1"),
        key("2"),
        key("3"),
      ]);
    });
    it("gives terminal markers precedence over duplicate detailed rows", async () => {
      await fixture("post");
      await conn.query(
        "INSERT INTO content_recovery_markers(kind,requestKey,actorUserId,createdAt) VALUES('post',?,97580,DATE_SUB(NOW(),INTERVAL 31 DAY))",
        [key("1")],
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
      const result = await request({ kind: "post" });
      expect(
        result.data!.items.map((row) => [row.requestId, row.status]),
      ).toEqual([
        [key("1"), "expired"],
        [key("2"), "expired"],
        [key("3"), "deleted"],
      ]);
    });
    it("fails closed on incomplete schema with sanitized error", async () => {
      await conn.query(
        "RENAME TABLE content_recovery_markers TO backend_test_export_hold",
      );
      try {
        const result = await request({ kind: "post" });
        expect(result.status).toBe(503);
        expect(JSON.stringify(result.error)).not.toMatch(
          /SELECT|information_schema|backend_test_export_hold|stack/,
        );
      } finally {
        await conn.query(
          "RENAME TABLE backend_test_export_hold TO content_recovery_markers",
        );
      }
    });
  },
);
