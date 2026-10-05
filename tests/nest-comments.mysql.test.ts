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

// Only the external transport is replaced; sessions, policies and SQL are real.
const push = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../apps/backend/src/push", () => ({
  sendServicePushNotification: push,
}));

describe.skipIf(!testDatabaseUrl)(
  "native discussion/reactions over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
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
    async function clearDiscussion() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM post_comments WHERE postId BETWEEN 8990 AND 8995",
      );
      if (rows.length) {
        const ids = rows.map((row) => row.id);
        await conn.query("DELETE FROM comment_likes WHERE commentId IN (?)", [
          ids,
        ]);
        await conn.query("DELETE FROM comment_reports WHERE commentId IN (?)", [
          ids,
        ]);
        await conn.query("DELETE FROM post_comments WHERE id IN (?)", [ids]);
      }
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-comment-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(
        "INSERT INTO users (id,openId,role,name) VALUES (8990,'native-comment-reader','user','Reader'),(8991,'native-comment-author','user','Author')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (8990,'native-comment-subscription','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      );
      await conn.query(`INSERT INTO posts (id,text,photos,tags,target,status,published,publishedAt) VALUES
      (8990,'club discussion',JSON_ARRAY(),JSON_ARRAY('community'),'club','published',TRUE,NOW()),
      (8991,'public discussion',JSON_ARRAY(),JSON_ARRAY('community'),'feed','published',TRUE,NOW()),
      (8992,'closed discussion',JSON_ARRAY(),JSON_ARRAY('community'),'club','published',TRUE,'2020-01-01'),
      (8993,'draft discussion',JSON_ARRAY(),JSON_ARRAY('community'),'club','draft',TRUE,NOW()),
      (8994,'hidden discussion',JSON_ARRAY(),JSON_ARRAY('community'),'club','published',FALSE,NOW()),
      (8995,'non discussion',JSON_ARRAY(),JSON_ARRAY('exclusive'),'club','published',TRUE,NOW())`);
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-comment-reader", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      push.mockClear();
      await conn.query(
        "UPDATE users SET role='user',blockedAt=NULL,sessionVersion=0 WHERE id=8990",
      );
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='native-comment-subscription'",
      );
      await clearDiscussion();
      await conn.query("DELETE FROM likes WHERE userId=8990");
      await conn.query("DELETE FROM saved_posts WHERE userId=8990");
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (8990,8990,8991,'club author'),(8991,8991,8991,'public author'),(8993,8993,8991,'draft author'),(8994,8994,8991,'hidden author')",
      );
    });
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await clearDiscussion();
        await conn.query("DELETE FROM likes WHERE userId=8990");
        await conn.query("DELETE FROM saved_posts WHERE userId=8990");
        await conn.query("DELETE FROM posts WHERE id BETWEEN 8990 AND 8995");
        await conn.query(
          "DELETE FROM club_payments WHERE orderId='native-comment-subscription'",
        );
        await conn.query("DELETE FROM users WHERE id IN (8990,8991)");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function comments() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id,postId,parentId,userId,text,photos FROM post_comments WHERE postId BETWEEN 8990 AND 8995 ORDER BY id",
      );
      return rows;
    }
    const mutations = (id: number) => [
      () => client(bearer).club.updateComment.mutate({ id, text: "changed" }),
      () => client(bearer).club.toggleCommentLike.mutate({ commentId: id }),
      () => client(bearer).club.deleteComment.mutate({ id }),
      () => client(bearer).club.reportComment.mutate({ id, reason: "reason" }),
    ];
    it("lists author fields and viewer likes only for a live member", async () => {
      expect(
        await client(bearer).club.toggleCommentLike.mutate({ commentId: 8990 }),
      ).toEqual({ liked: true, likeCount: 1 });
      expect(
        await client(bearer).club.comments.query({ postId: 8990 }),
      ).toMatchObject([
        {
          id: 8990,
          text: "club author",
          authorName: "Author",
          likeCount: 1,
          likedByMe: true,
        },
      ]);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      for (const postId of [8990, 8991])
        await expect(
          client(bearer).club.comments.query({ postId }),
        ).rejects.toMatchObject({
          data: { code: "FORBIDDEN", httpStatus: 403 },
        });
    });
    it("denies all club mutations after expiry without changing records or notifying", async () => {
      const original = await comments();
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      for (const action of [
        ...mutations(8990),
        () =>
          client(bearer).club.addComment.mutate({
            postId: 8990,
            text: "denied",
          }),
      ])
        await expect(action()).rejects.toMatchObject({
          data: { code: "FORBIDDEN", httpStatus: 403 },
        });
      expect(await comments()).toEqual(original);
      const [likes] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM comment_likes WHERE commentId=8990",
      );
      const [reports] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM comment_reports WHERE commentId=8990",
      );
      expect(likes).toEqual([]);
      expect(reports).toEqual([]);
      expect(push).not.toHaveBeenCalled();
    });
    it.each([8993, 8994])(
      "hides unpublished post %s for list/add/all mutations even from admin",
      async (postId) => {
        await conn.query("UPDATE users SET role='admin' WHERE id=8990");
        const original = await comments();
        for (const action of [
          () => client(bearer).club.comments.query({ postId }),
          () =>
            client(bearer).club.addComment.mutate({ postId, text: "denied" }),
          ...mutations(postId),
        ])
          await expect(action()).rejects.toMatchObject({
            data: { code: "NOT_FOUND", httpStatus: 404 },
          });
        expect(await comments()).toEqual(original);
        expect(push).not.toHaveBeenCalled();
      },
    );
    it.each([8992, 8995])(
      "retains closed/non-community comment window for %s",
      async (postId) => {
        await expect(
          client(bearer).club.addComment.mutate({ postId, text: "denied" }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(
          (await comments()).filter((row) => row.postId === postId),
        ).toEqual([]);
      },
    );
    it("persists trimmed text/photos and author-only edit", async () => {
      const { id } = await client(bearer).club.addComment.mutate({
        postId: 8990,
        text: "  mine  ",
        photos: [
          "https://assets.example.test/a.jpg",
          "https://assets.example.test/b.jpg",
        ],
      });
      expect((await comments()).find((row) => row.id === id)).toMatchObject({
        userId: 8990,
        text: "mine",
        photos: [
          "https://assets.example.test/a.jpg",
          "https://assets.example.test/b.jpg",
        ],
      });
      expect(
        await client(bearer).club.updateComment.mutate({
          id,
          text: " edited ",
        }),
      ).toEqual({ ok: true });
      expect((await comments()).find((row) => row.id === id)?.text).toBe(
        "edited",
      );
      await conn.query("UPDATE users SET role='admin' WHERE id=8990");
      await expect(
        client(bearer).club.updateComment.mutate({ id: 8990, text: "foreign" }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN", httpStatus: 403 } });
      expect((await comments()).find((row) => row.id === 8990)?.text).toBe(
        "club author",
      );
    });
    it("checks parent belongs to the post, persists replies, and only notifies another author", async () => {
      for (const [parentId, code] of [
        [8991, "BAD_REQUEST"],
        [-1, "NOT_FOUND"],
      ] as const)
        await expect(
          client(bearer).club.addComment.mutate({
            postId: 8990,
            parentId,
            text: "denied",
          }),
        ).rejects.toMatchObject({ data: { code } });
      expect(push).not.toHaveBeenCalled();
      const text = "a".repeat(81);
      const reply = await client(bearer).club.addComment.mutate({
        postId: 8990,
        parentId: 8990,
        text,
      });
      expect(
        (await comments()).find((row) => row.id === reply.id),
      ).toMatchObject({ parentId: 8990, postId: 8990, userId: 8990, text });
      expect(push).toHaveBeenCalledExactlyOnceWith({
        userId: 8991,
        title: "Ответ на ваш комментарий",
        body: `Reader: ${"a".repeat(80)}…`,
        data: { postId: 8990, type: "comment_reply", commentId: 8990 },
        target: "club",
      });
      await client(bearer).club.addComment.mutate({
        postId: 8990,
        parentId: reply.id,
        text: "self",
      });
      expect(push).toHaveBeenCalledTimes(1);
    });
    it("upserts one report and atomically removes associations on live moderator deletion", async () => {
      await client(bearer).club.toggleCommentLike.mutate({ commentId: 8990 });
      for (const reason of ["first reason", " second reason "])
        expect(
          await client(bearer).club.reportComment.mutate({ id: 8990, reason }),
        ).toEqual({ ok: true });
      const [reports] = await conn.query<RowDataPacket[]>(
        "SELECT reason FROM comment_reports WHERE commentId=8990 AND reporterUserId=8990",
      );
      expect(reports).toEqual([{ reason: "second reason" }]);
      await expect(
        client(bearer).club.deleteComment.mutate({ id: 8990 }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN", httpStatus: 403 } });
      const { id } = await client(bearer).club.addComment.mutate({
        postId: 8990,
        parentId: 8990,
        text: "reply",
      });
      await conn.query("UPDATE users SET role='moderator' WHERE id=8990");
      expect(
        await client(bearer).club.deleteComment.mutate({ id: 8990 }),
      ).toEqual({ ok: true });
      expect((await comments()).find((row) => row.id === 8990)).toBeUndefined();
      expect(
        (await comments()).find((row) => row.id === id)?.parentId,
      ).toBeNull();
      for (const table of ["comment_likes", "comment_reports"]) {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM ${table} WHERE commentId=8990`,
        );
        expect(rows).toEqual([]);
      }
      await conn.query("UPDATE users SET role='user' WHERE id=8990");
      await expect(
        client(bearer).club.deleteComment.mutate({ id: 8991 }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN", httpStatus: 403 } });
    });
    it("preserves public comment mutation access for authenticated non-members", async () => {
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      const { id } = await client(bearer).club.addComment.mutate({
        postId: 8991,
        text: "public reply",
      });
      expect(
        await client(bearer).club.updateComment.mutate({
          id,
          text: "public edit",
        }),
      ).toEqual({ ok: true });
      expect(
        await client(bearer).club.toggleCommentLike.mutate({ commentId: 8991 }),
      ).toEqual({ liked: true, likeCount: 1 });
      expect(
        await client(bearer).club.reportComment.mutate({
          id: 8991,
          reason: "public report",
        }),
      ).toEqual({ ok: true });
      expect(await client(bearer).club.deleteComment.mutate({ id })).toEqual({
        ok: true,
      });
    });
    it.each(["blockedAt=NOW()", "sessionVersion=1"])(
      "rejects all discussion writes/list after %s",
      async (patch) => {
        const original = await comments();
        await conn.query(`UPDATE users SET ${patch} WHERE id=8990`);
        for (const action of [
          () => client(bearer).club.comments.query({ postId: 8990 }),
          () =>
            client(bearer).club.addComment.mutate({
              postId: 8990,
              text: "denied",
            }),
          ...mutations(8990),
        ])
          await expect(action()).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED", httpStatus: 401 },
          });
        expect(await comments()).toEqual(original);
        expect(push).not.toHaveBeenCalled();
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "retains boolean/coerced input and actor identity for %s",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        for (const expected of [true, false]) {
          expect(
            await client(bearer).feed[method].mutate({ postId: "8991" }),
          ).toBe(expected);
          const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT userId,postId FROM ${table} WHERE userId=8990`,
          );
          expect(rows).toEqual(
            expected ? [{ userId: 8990, postId: 8991 }] : [],
          );
        }
        for (const patch of [
          "blockedAt=NOW()",
          "blockedAt=NULL,sessionVersion=1",
        ]) {
          await conn.query(`UPDATE users SET ${patch} WHERE id=8990`);
          await expect(
            client(bearer).feed[method].mutate({ postId: 8991 }),
          ).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED", httpStatus: 401 },
          });
        }
        await expect(
          client().feed[method].mutate({ postId: 8991 }),
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM ${table} WHERE userId=8990`,
        );
        expect(rows).toEqual([]);
      },
    );
  },
);
