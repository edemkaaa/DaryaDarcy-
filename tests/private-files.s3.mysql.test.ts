import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { Connection } from "mysql2/promise";
import { S3Client } from "@aws-sdk/client-s3";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { privateFilesBrowser } from "./helpers/private-files-browser";

// Explicit acceptance only. Credentials are supplied in memory by an owned
// harness; this suite never creates, lists or deletes working storage objects.
const enabled = process.env.AG2_S3_ACCEPTANCE === "true" && !!testDatabaseUrl;
describe.skipIf(!enabled)(
  "actual S3 with native attachment API and SQL",
  () => {
    let conn: Connection, app: INestApplication, base: string, token: string;
    let urls: string[];
    // Call-through observation, not a replacement transport or S3 response mock.
    const send = vi.spyOn(S3Client.prototype, "send");
    beforeAll(async () => {
      if (process.env.DATABASE_URL !== testDatabaseUrl)
        throw new Error("Explicit matching fixture DB inputs are required");
      const manifest = JSON.parse(
        await readFile(process.env.AG2_S3_FIXTURE_MANIFEST!, "utf8"),
      );
      expect(manifest.endpoint).toBe("https://s3.twcstorage.ru");
      expect(manifest.Bucket).toBe("daryadarcy-s3");
      expect(manifest.owner).toMatch(
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      );
      expect(process.env.S3_ENDPOINT).toBe(manifest.endpoint);
      expect(process.env.S3_BUCKET).toBe(manifest.Bucket);
      if (typeof manifest.browserExecutable === "string")
        vi.stubEnv("PLAYWRIGHT_EXECUTABLE_PATH", manifest.browserExecutable);
      const keys = ["audio", "documents"].map(
        (folder) => `feed/${folder}/private-v1/ag2-${manifest.owner}.txt`,
      );
      expect(
        manifest.objects
          .filter((row: { private: boolean }) => row.private)
          .map((row: { Key: string }) => row.Key),
      ).toEqual(keys);
      urls = keys.map(
        (key) => `${manifest.endpoint}/${manifest.Bucket}/${key}`,
      );
      conn = await openContentTestDatabase();
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97310,'ag2-native-reader','user')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (97310,'ag2-native-paid','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES (97301,'ag2-native-fixture',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE)",
      );
      for (let i = 0; i < urls.length; i++) {
        await conn.query(
          "INSERT INTO post_media (id,postId,type,url,mimeType,filename) VALUES (?,97301,?,?,'text/plain','fixture.txt')",
          [97301 + i, i === 0 ? "audio" : "document", urls[i]],
        );
      }
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("ag2-native-reader", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      send.mockClear();
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      await conn.query(
        "UPDATE posts SET published=TRUE,status='published',target='feed' WHERE id=97301",
      );
      await conn.query(
        "UPDATE users SET role='user',blockedAt=NULL,sessionVersion=0 WHERE id=97310",
      );
      await conn.query(
        "UPDATE club_payments SET status='paid',expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='ag2-native-paid'",
      );
      for (let i = 0; i < urls.length; i++)
        await conn.query(
          "UPDATE post_media SET postId=97301,url=? WHERE id=?",
          [urls[i], 97301 + i],
        );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await conn.query("DELETE FROM post_media WHERE id IN (97301,97302)");
        await conn.query(
          "DELETE FROM posts WHERE id=97301 AND text='ag2-native-fixture'",
        );
        await conn.query(
          "DELETE FROM club_payments WHERE orderId='ag2-native-paid' AND userId=97310",
        );
        await conn.query(
          "DELETE FROM users WHERE id=97310 AND openId='ag2-native-reader'",
        );
        await conn.end();
      }
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      send.mockRestore();
      vi.unstubAllEnvs();
    });
    const auth = () => ({ Cookie: `${COOKIE_NAME}=${token}` });
    const read = (options: RequestInit = {}, id = 97302) =>
      fetch(`${base}/api/media/post-attachments/${id}`, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
    async function denied(options: RequestInit = {}) {
      const response = await read(options);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Файл недоступен." });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(send).not.toHaveBeenCalled();
    }
    it.each([97301, 97302])(
      "streams exact bytes from private prefix attachment %i",
      async (id) => {
        // The audio-path fixture checks transport, not audio decoding/playback.
        const response = await read({}, id);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("0123456789");
        expect(response.headers.get("content-length")).toBe("10");
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(JSON.stringify([...response.headers])).not.toMatch(
          /twcstorage|private-v1|ag2-/,
        );
      },
    );
    it("HEAD exposes length but no body, even with Range", async () => {
      const response = await read({
        method: "HEAD",
        headers: { Range: "bytes=2-5" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-length")).toBe("10");
      expect(await response.text()).toBe("");
      expect(send).toHaveBeenCalledTimes(1);
    });
    it.each([
      ["bytes=2-5", "2345", "bytes 2-5/10"],
      ["bytes=-3", "789", "bytes 7-9/10"],
      ["bytes=8-", "89", "bytes 8-9/10"],
    ])("reads exact native S3 range %s", async (range, body, expectedRange) => {
      const response = await read({ headers: { Range: range } });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(expectedRange);
      expect(response.headers.get("content-length")).toBe(String(body.length));
      expect(await response.text()).toBe(body);
    });
    it.each(["bytes=10-", "bytes=0-1,4-5"])(
      "refuses range %s before storage GET",
      async (range) => {
        const response = await read({ headers: { Range: range } });
        expect(response.status).toBe(416);
        expect(response.headers.get("content-range")).toBe("bytes */10");
        expect(send).toHaveBeenCalledTimes(1);
      },
    );
    it.each(["cookie", "bearer"])(
      "rechecks paid club access through %s",
      async (mode) => {
        await conn.query("UPDATE posts SET target='club' WHERE id=97301");
        await denied();
        const response = await read({
          headers:
            mode === "cookie" ? auth() : { Authorization: `Bearer ${token}` },
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("0123456789");
      },
    );
    it.each(["unpaid", "expired", "blocked", "revoked"])(
      "refuses club member %s without S3 calls",
      async (state) => {
        await conn.query("UPDATE posts SET target='club' WHERE id=97301");
        if (state === "unpaid")
          await conn.query(
            "UPDATE club_payments SET status='pending' WHERE orderId='ag2-native-paid'",
          );
        if (state === "expired")
          await conn.query(
            "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId='ag2-native-paid'",
          );
        if (state === "blocked")
          await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=97310");
        if (state === "revoked")
          await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97310");
        await denied({ headers: auth() });
      },
    );
    it.each(["admin", "moderator"])(
      "permits unpaid %s and rechecks role revocation",
      async (role) => {
        await conn.query("UPDATE posts SET target='club' WHERE id=97301");
        await conn.query(
          "UPDATE club_payments SET status='pending' WHERE orderId='ag2-native-paid'",
        );
        await conn.query("UPDATE users SET role=? WHERE id=97310", [role]);
        const response = await read({ headers: auth() });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("0123456789");
        await conn.query("UPDATE users SET role='user' WHERE id=97310");
        send.mockClear();
        await denied({ headers: auth() });
      },
    );
    it.each(["draft", "hidden", "detached"])(
      "refuses %s post/association before S3",
      async (state) => {
        if (state === "draft")
          await conn.query("UPDATE posts SET status='draft' WHERE id=97301");
        if (state === "hidden")
          await conn.query("UPDATE posts SET published=FALSE WHERE id=97301");
        if (state === "detached")
          await conn.query("UPDATE post_media SET postId=97399 WHERE id=97302");
        await denied();
      },
    );
    it("disabled delivery never reaches storage", async () => {
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "false");
      await denied();
    });
    it("deleted post and removed attachment are refused before storage", async () => {
      await conn.query(
        "DELETE FROM posts WHERE id=97301 AND text='ag2-native-fixture'",
      );
      try {
        await denied();
      } finally {
        await conn.query(
          "INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES (97301,'ag2-native-fixture',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE)",
        );
      }
      await conn.query(
        "DELETE FROM post_media WHERE id=97302 AND postId=97301",
      );
      try {
        await denied();
      } finally {
        await conn.query(
          "INSERT INTO post_media (id,postId,type,url,mimeType,filename) VALUES (97302,97301,'document',?,'text/plain','fixture.txt')",
          [urls[1]],
        );
      }
    });
    it("bad storage signature returns generic 503 without URL/key leakage", async () => {
      const key = process.env.S3_SECRET_KEY!;
      vi.stubEnv("S3_SECRET_KEY", "ag2-intentionally-invalid-signature");
      try {
        const response = await read();
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({
          error: "Файл временно недоступен.",
        });
        expect(JSON.stringify([...response.headers])).not.toMatch(
          /twcstorage|private-v1|ag2-/,
        );
      } finally {
        vi.stubEnv("S3_SECRET_KEY", key);
      }
    });
    it("browser cookie uses the unchanged Next rewrite and rechecks access", async () => {
      await conn.query("UPDATE posts SET target='club' WHERE id=97301");
      const browser = await privateFilesBrowser(base);
      try {
        expect((await browser.read(97302)).status).toBe(404);
        expect(send).not.toHaveBeenCalled();
        await browser.context.addCookies([
          {
            name: COOKIE_NAME,
            value: token,
            url: browser.origin,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        expect(await browser.read(97302, "bytes=2-5")).toEqual({
          status: 206,
          body: "2345",
          cache: "private, no-store",
          range: "bytes 2-5/10",
        });
        expect((await browser.read(97302)).body).toBe("0123456789");
        await conn.query(
          "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId='ag2-native-paid'",
        );
        send.mockClear();
        expect((await browser.read(97302)).status).toBe(404);
        expect(send).not.toHaveBeenCalled();
        await conn.query(
          "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='ag2-native-paid'",
        );
        await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97310");
        expect((await browser.read(97302)).status).toBe(404);
        expect(send).not.toHaveBeenCalled();
        await browser.context.clearCookies();
        expect((await browser.read(97302)).status).toBe(404);
      } finally {
        await browser.close();
      }
    }, 45000);
  },
);
