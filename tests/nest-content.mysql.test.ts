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
import type { Connection } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "native content reads over real HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-content-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (8970,'native-content-reader','user')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (8970,'native-content-subscription','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      );
      await conn.query(`INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES
      (8970,'public body',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE),
      (8971,'club body',JSON_ARRAY(),JSON_ARRAY(),'club','published',TRUE),
      (8972,'draft body',JSON_ARRAY(),JSON_ARRAY(),'both','draft',TRUE),
      (8973,'scheduled body',JSON_ARRAY(),JSON_ARRAY(),'both','scheduled',TRUE),
      (8974,'hidden body',JSON_ARRAY(),JSON_ARRAY(),'feed','published',FALSE)`);
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (8970,8971,'document','https://assets.example.test/club-fixture.pdf')",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-content-reader", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await conn.query(
        "UPDATE users SET role='user',blockedAt=NULL,sessionVersion=0 WHERE id=8970",
      );
      await conn.query(
        "UPDATE club_payments SET status='paid',expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='native-content-subscription'",
      );
      await conn.query("DELETE FROM saved_posts WHERE userId=8970");
      await conn.query("DELETE FROM likes WHERE userId=8970");
    });
    afterAll(async () => {
      await application?.close();
      await conn?.query("DELETE FROM saved_posts WHERE userId=8970");
      await conn?.query("DELETE FROM likes WHERE userId=8970");
      await conn?.query("DELETE FROM post_media WHERE id=8970");
      await conn?.query("DELETE FROM posts WHERE id BETWEEN 8970 AND 8974");
      await conn?.query(
        "DELETE FROM club_payments WHERE orderId='native-content-subscription'",
      );
      await conn?.query("DELETE FROM users WHERE id=8970");
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const client = (token?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ],
      });
    it("keeps public detail visible while hiding club body from anonymous readers", async () => {
      expect(await client().feed.getById.query({ id: 8970 })).toMatchObject({
        id: 8970,
        text: "public body",
      });
      expect(await client().feed.getById.query({ id: 8971 })).toBeUndefined();
    });
    it.each([8972, 8973, 8974])(
      "hides non-published detail %s even from a subscribed administrator",
      async (id) => {
        await conn.query("UPDATE users SET role='admin' WHERE id=8970");
        expect(await client(bearer).feed.getById.query({ id })).toBeUndefined();
      },
    );
    it("rechecks subscription expiry and live staff roles with the same JWT", async () => {
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toMatchObject({ text: "club body" });
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-content-subscription'",
      );
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toBeUndefined();
      for (const role of ["moderator", "admin"]) {
        await conn.query("UPDATE users SET role=? WHERE id=8970", [role]);
        expect(
          await client(bearer).feed.getById.query({ id: 8971 }),
        ).toMatchObject({ text: "club body" });
      }
      await conn.query("UPDATE users SET role='user' WHERE id=8970");
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toBeUndefined();
    });
    it("preserves bookmark order but removes unpaid club body and attachments", async () => {
      await conn.query(
        "INSERT INTO saved_posts (userId,postId,createdAt) VALUES (8970,8970,'2036-01-01'),(8970,8971,'2036-01-02'),(8970,8972,'2036-01-03')",
      );
      const saved = await client(bearer).feed.savedPosts.query();
      expect(saved.map((post) => post.id)).toEqual([8971, 8970]);
      expect(saved[0].media).toMatchObject([
        { url: "https://assets.example.test/club-fixture.pdf" },
      ]);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-content-subscription'",
      );
      expect(
        (await client(bearer).feed.savedPosts.query()).map((post) => post.id),
      ).toEqual([8970]);
    });
    it.each(["blockedAt=NOW()", "sessionVersion=1"])(
      "denies club and protected reads after %s",
      async (patch) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=8970`);
        expect(
          await client(bearer).feed.getById.query({ id: 8971 }),
        ).toBeUndefined();
        await expect(
          client(bearer).feed.savedPosts.query(),
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
      },
    );
    it("aggregates only the authenticated reader's saved and liked IDs", async () => {
      await conn.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (8970,8971)",
      );
      await conn.query("INSERT INTO likes (userId,postId) VALUES (8970,8970)");
      expect(await client(bearer).feed.userInteractions.query()).toEqual({
        likedIds: [8970],
        savedIds: [8971],
      });
      await expect(
        client().feed.userInteractions.query(),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
    });
  },
);
