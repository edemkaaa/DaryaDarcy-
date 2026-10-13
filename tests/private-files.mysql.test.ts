import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { Connection } from "mysql2/promise";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { COOKIE_NAME } from "../packages/shared/src/const";

// Real HTTP/JWT/SQL/SDK. The loopback object wire is not an S3 ACL acceptance.
describe.skipIf(!testDatabaseUrl)("private attachment delivery", () => {
  let conn: Connection, app: INestApplication, wire: Server;
  let endpoint: string, base: string, token: string;
  const effects: string[] = [];
  let wireMode = "normal",
    upstreamClosed = false;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    wire = createServer((req, res) => {
      const path = new URL(req.url!, "http://loopback.invalid").pathname;
      effects.push(`${req.method} ${path}`);
      if (path !== "/private-fixture/feed/documents/fixture.txt") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("ETag", '"fixture-v1"');
      if (wireMode === "missing-etag") res.removeHeader("ETag");
      if (req.method === "GET" && wireMode === "changed")
        res.setHeader("ETag", '"fixture-v2"');
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Length", "10");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      if (
        req.headers["if-match"] !== '"fixture-v1"' ||
        !req.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")
      ) {
        res.writeHead(412);
        res.end();
        return;
      }
      if (wireMode === "error" || wireMode === "redirect") {
        res.removeHeader("Content-Length");
        res.statusCode = wireMode === "error" ? 403 : 307;
        res.setHeader("Location", endpoint + "/PRIVATE_PROVIDER_SENTINEL");
        res.setHeader("Set-Cookie", "PRIVATE_PROVIDER_SENTINEL");
        res.end("PRIVATE_PROVIDER_SENTINEL");
        return;
      }
      if (wireMode === "hold") {
        res.on("close", () => {
          upstreamClosed = true;
        });
        res.write("0");
        return;
      }
      if (req.headers.range && wireMode !== "ignored-range") {
        const match = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range)!;
        const start = Number(match[1]),
          end = Number(match[2]);
        res.statusCode = 206;
        res.setHeader("Content-Length", String(end - start + 1));
        res.setHeader("Content-Range", `bytes ${start}-${end}/10`);
        res.end("0123456789".slice(start, end + 1));
        return;
      }
      res.end("0123456789");
    });
    await new Promise<void>((done) => wire.listen(0, "127.0.0.1", done));
    endpoint = `http://127.0.0.1:${(wire.address() as AddressInfo).port}`;
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "private-files-fixture-secret-32-characters");
    vi.stubEnv("S3_ENDPOINT", endpoint);
    vi.stubEnv("S3_BUCKET", "private-fixture");
    vi.stubEnv("S3_ACCESS_KEY", "private-fixture-access");
    vi.stubEnv("S3_SECRET_KEY", "private-fixture-secret");
    vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
    await conn.query(
      "INSERT INTO users (id,openId,role) VALUES (91901,'private-files-reader','user')",
    );
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (91901,'private-files-paid','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
    );
    await conn.query(
      "INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES (91901,'fixture',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE)",
    );
    await conn.query(
      "INSERT INTO post_media (id,postId,type,url,mimeType,filename) VALUES (91901,91901,'document',?,'text/plain','fixture.txt')",
      [endpoint + "/private-fixture/feed/documents/fixture.txt"],
    );
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    token = await sdk.createSessionToken("private-files-reader", {
      sessionVersion: 0,
    });
  });
  beforeEach(async () => {
    effects.length = 0;
    wireMode = "normal";
    upstreamClosed = false;
    vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
    await conn.query(
      "UPDATE posts SET published=TRUE,status='published',target='feed' WHERE id=91901",
    );
    await conn.query(
      "UPDATE users SET role='user',blockedAt=NULL,sessionVersion=0 WHERE id=91901",
    );
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='private-files-paid'",
    );
    await conn.query(
      "UPDATE post_media SET postId=91901,url=?,mimeType='text/plain' WHERE id=91901",
      [endpoint + "/private-fixture/feed/documents/fixture.txt"],
    );
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await conn.query(
        "DELETE FROM post_media WHERE id=91901 AND postId=91901",
      );
      await conn.query("DELETE FROM posts WHERE id=91901");
      await conn.query(
        "DELETE FROM club_payments WHERE orderId='private-files-paid'",
      );
      await conn.query(
        "DELETE FROM users WHERE id=91901 AND openId='private-files-reader'",
      );
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    wire?.closeAllConnections();
    if (wire) await new Promise<void>((done) => wire.close(() => done()));
    vi.unstubAllEnvs();
  });
  function read(options: RequestInit = {}, id = "91901") {
    return fetch(`${base}/api/media/post-attachments/${id}`, options);
  }
  it("streams published public attachment bytes with private no-store", async () => {
    const res = await read();
    expect(res.status, JSON.stringify(effects)).toBe(200);
    expect(await res.text()).toBe("0123456789");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe("10");
    expect(effects).toEqual([
      "HEAD /private-fixture/feed/documents/fixture.txt",
      "GET /private-fixture/feed/documents/fixture.txt",
    ]);
  });
  it("rechecks club access for cookie download and refuses guest without S3", async () => {
    await conn.query("UPDATE posts SET target='club' WHERE id=91901");
    expect((await read()).status).toBe(404);
    expect(effects).toEqual([]);
    const res = await read({ headers: { Cookie: `${COOKIE_NAME}=${token}` } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("0123456789");
  });
  it.each(["", "false", "1"])(
    "disabled flag %s does not touch SQL or S3",
    async (flag) => {
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", flag);
      vi.stubEnv("DATABASE_URL", "");
      try {
        const res = await read({
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(404);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
        expect(effects).toEqual([]);
      } finally {
        vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      }
    },
  );
  it("HEAD returns length without a storage GET or response body", async () => {
    const res = await read({ method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("10");
    expect(await res.text()).toBe("");
    expect(effects).toEqual([
      "HEAD /private-fixture/feed/documents/fixture.txt",
    ]);
  });
  it.each([
    { range: "bytes=2-5", body: "2345", contentRange: "bytes 2-5/10" },
    { range: "bytes=8-", body: "89", contentRange: "bytes 8-9/10" },
    { range: "bytes=-3", body: "789", contentRange: "bytes 7-9/10" },
    { range: "bytes=7-99", body: "789", contentRange: "bytes 7-9/10" },
  ])(
    "serves only the requested range $range",
    async ({ range, body, contentRange }) => {
      const res = await read({ headers: { Range: range } });
      expect(res.status).toBe(206);
      expect(res.headers.get("content-range")).toBe(contentRange);
      expect(res.headers.get("content-length")).toBe(String(body.length));
      expect(await res.text()).toBe(body);
    },
  );
  it.each([
    "",
    "items=0-1",
    "bytes=1-0",
    "bytes=10-",
    "bytes=-0",
    "bytes=0-1,4-5",
    "bytes=9007199254740992-",
  ])(
    "refuses invalid/unsatisfiable range %s without object GET",
    async (range) => {
      const res = await read({ headers: { Range: range } });
      expect(res.status).toBe(416);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(effects.some((effect) => effect.startsWith("GET"))).toBe(false);
    },
  );
  it.each([
    "https://external.example.test/file.txt",
    "http://127.0.0.1:1/private-fixture/feed/documents/fixture.txt",
    "/relative/file.txt",
    "own-query",
    "own-userinfo",
    "own-dot",
    "own-encoded-slash",
    "own-backup",
  ])(
    "rejects ambiguous or external attachment URL %s without storage",
    async (kind) => {
      const urls: Record<string, string> = {
        "own-query":
          endpoint +
          "/private-fixture/feed/documents/fixture.txt?token=PRIVATE_QUERY",
        "own-userinfo":
          endpoint.replace("http://", "http://secret@") +
          "/private-fixture/feed/documents/fixture.txt",
        "own-dot":
          endpoint + "/private-fixture/feed/documents/../documents/fixture.txt",
        "own-encoded-slash":
          endpoint + "/private-fixture/feed/documents/%2Ffixture.txt",
        "own-backup": endpoint + "/private-fixture/backups/private.sql",
      };
      await conn.query("UPDATE post_media SET url=? WHERE id=91901", [
        urls[kind] ?? kind,
      ]);
      const res = await read();
      expect(res.status).toBe(404);
      expect(effects).toEqual([]);
      expect(await res.text()).not.toMatch(/PRIVATE_QUERY|secret|private.sql/);
    },
  );
  it.each([
    "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId='private-files-paid'",
    "UPDATE users SET blockedAt=NOW() WHERE id=91901",
    "UPDATE users SET sessionVersion=1 WHERE id=91901",
  ])(
    "rechecks paid/session state on the next range request: %s",
    async (sql) => {
      await conn.query("UPDATE posts SET target='club' WHERE id=91901");
      const headers = { Authorization: `Bearer ${token}` };
      expect((await read({ headers })).status).toBe(200);
      await conn.query(sql);
      effects.length = 0;
      const res = await read({ headers: { ...headers, Range: "bytes=0-1" } });
      expect(res.status).toBe(404);
      expect(effects).toEqual([]);
    },
  );
  it("staff access requires current role and grants no paid period", async () => {
    await conn.query("UPDATE posts SET target='club' WHERE id=91901");
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId='private-files-paid'",
    );
    await conn.query("UPDATE users SET role='moderator' WHERE id=91901");
    const headers = { Authorization: `Bearer ${token}` };
    expect((await read({ headers, method: "HEAD" })).status).toBe(200);
    await conn.query("UPDATE users SET role='user' WHERE id=91901");
    effects.length = 0;
    expect((await read({ headers, method: "HEAD" })).status).toBe(404);
    expect(effects).toEqual([]);
  });
  it.each([
    "UPDATE posts SET published=FALSE WHERE id=91901",
    "UPDATE posts SET status='draft' WHERE id=91901",
    "UPDATE posts SET status='scheduled' WHERE id=91901",
    "UPDATE post_media SET postId=91902 WHERE id=91901",
    "UPDATE post_media SET mimeType='text/html' WHERE id=91901",
  ])("refuses unpublished/missing parent or unsafe MIME: %s", async (sql) => {
    await conn.query(sql);
    expect((await read()).status).toBe(404);
    expect(effects).toEqual([]);
  });
  it.each([
    "0",
    "-1",
    "1.5",
    "9007199254740992",
    "91902",
    "91901?url=https://external.example.test",
  ])("refuses invalid/missing ID or supplied query: %s", async (id) => {
    expect((await read({}, id)).status).toBe(404);
    expect(effects).toEqual([]);
  });
  it.each(["error", "redirect"])(
    "provider %s stays generic without retry or leaked headers",
    async (mode) => {
      wireMode = mode;
      const res = await read();
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain("PRIVATE_PROVIDER_SENTINEL");
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(effects).toEqual([
        "HEAD /private-fixture/feed/documents/fixture.txt",
        "GET /private-fixture/feed/documents/fixture.txt",
      ]);
    },
  );
  it("client abort closes the held upstream body", async () => {
    wireMode = "hold";
    const abort = new AbortController();
    const res = await read({ signal: abort.signal });
    expect(res.status).toBe(200);
    abort.abort();
    await vi.waitFor(() => expect(upstreamClosed).toBe(true), {
      timeout: 2000,
    });
  });
  it("ingress rejection is also private no-store, without SQL or object reads", async () => {
    const res = await read({
      headers: { Origin: "https://untrusted.example.test" },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(effects).toEqual([]);
  });
  it("SQL read failure stays generic and never reaches storage", async () => {
    await conn.query("RENAME TABLE post_media TO private_files_missing_media");
    try {
      const res = await read();
      expect(res.status).toBe(503);
      expect(await res.text()).not.toMatch(
        /private_files_missing_media|SELECT|mysql/,
      );
      expect(effects).toEqual([]);
    } finally {
      await conn.query(
        "RENAME TABLE private_files_missing_media TO post_media",
      );
    }
  });
  it("refuses missing object version before GET", async () => {
    wireMode = "missing-etag";
    const res = await read();
    expect(res.status).toBe(503);
    expect(effects).toEqual([
      "HEAD /private-fixture/feed/documents/fixture.txt",
    ]);
  });
  it.each(["changed", "ignored-range"])(
    "refuses inconsistent provider response %s before sending bytes",
    async (mode) => {
      wireMode = mode;
      const res = await read({ headers: { Range: "bytes=2-5" } });
      expect(res.status).toBe(503);
      expect(await res.text()).not.toMatch(/0123456789|2345|fixture-v2/);
    },
  );
});
