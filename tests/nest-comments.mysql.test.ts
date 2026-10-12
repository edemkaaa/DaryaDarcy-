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
  sendMarketingPostNotification: vi.fn(async () => undefined),
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
    it("subscription reports moderator service access separately from a paid period", async () => {
      await conn.query("UPDATE users SET role='moderator' WHERE id=8990");
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      expect(await client(bearer).club.subscription.query()).toMatchObject({
        hasClubAccess: true,
        subscribed: false,
        isOwner: false,
        expiresAt: null,
        cancelAtPeriodEnd: false,
      });
      expect(
        await client(bearer).club.comments.query({ postId: 8990 }),
      ).toHaveLength(1);
      await expect(client(bearer).admin.payments.query()).rejects.toMatchObject({
        data: { code: "FORBIDDEN", httpStatus: 403 },
      });
    });
    it("keeps paid access separate from moderator authority", async () => {
      await conn.query("UPDATE users SET role='moderator' WHERE id=8990");
      expect(await client(bearer).club.subscription.query()).toMatchObject({
        hasClubAccess: true,
        subscribed: true,
        isOwner: false,
        cancelAtPeriodEnd: false,
        expiresAt: expect.any(Date),
      });
      await conn.query("UPDATE users SET role='user' WHERE id=8990");
      expect(await client(bearer).club.subscription.query()).toMatchObject({
        hasClubAccess: true,
        subscribed: true,
      });
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      expect(await client(bearer).club.subscription.query()).toMatchObject({
        hasClubAccess: false,
        subscribed: false,
        expiresAt: null,
      });
      await conn.query(
        "UPDATE users SET role='moderator',blockedAt=NOW() WHERE id=8990",
      );
      for (const actor of [client(), client(bearer)])
        expect(await actor.club.subscription.query()).toMatchObject({
          hasClubAccess: false,
          subscribed: false,
          isOwner: false,
          expiresAt: null,
        });
    });
    it.each(["feed", "both"])(
      "reads the saved public %s comment without a paid subscription",
      async (target) => {
        await conn.query("UPDATE posts SET target=? WHERE id=8991", [target]);
        await conn.query(
          "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
        );
        try {
          const { id } = await client(bearer).club.addComment.mutate({
            postId: 8991,
            text: "public reader reply",
          });
          expect((await comments()).find((row) => row.id === id)).toMatchObject(
            {
              postId: 8991,
              userId: 8990,
              text: "public reader reply",
            },
          );
          expect(
            await client(bearer).club.comments.query({ postId: 8991 }),
          ).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ id: 8991, authorName: "Author" }),
              expect.objectContaining({ id, authorName: "Reader" }),
            ]),
          );
          const unpaidAuthor = await sdk.createSessionToken(
            "native-comment-author",
            {
              sessionVersion: 0,
            },
          );
          expect(
            await client(unpaidAuthor).club.comments.query({ postId: 8991 }),
          ).toHaveLength(2);
          await expect(
            client(unpaidAuthor).club.comments.query({ postId: 8990 }),
          ).rejects.toMatchObject({
            data: { code: "FORBIDDEN", httpStatus: 403 },
          });
        } finally {
          await conn.query("UPDATE posts SET target='feed' WHERE id=8991");
        }
      },
    );
    it("requires a live authenticated account even for public discussion", async () => {
      const original = await comments();
      for (const postId of [8990, 8991]) {
        await expect(
          client().club.comments.query({ postId }),
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
      }
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=8990");
      for (const postId of [8990, 8991]) {
        await expect(
          client(bearer).club.comments.query({ postId }),
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
      }
      expect(await comments()).toEqual(original);
    });
    it("keeps old public discussion readable but its posting window closed", async () => {
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      await conn.query(
        "UPDATE posts SET publishedAt='2020-01-01' WHERE id=8991",
      );
      try {
        const original = await comments();
        expect(
          await client(bearer).club.comments.query({ postId: 8991 }),
        ).toMatchObject([{ id: 8991, text: "public author" }]);
        await expect(
          client(bearer).club.addComment.mutate({
            postId: 8991,
            text: "too late",
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(await comments()).toEqual(original);
      } finally {
        await conn.query("UPDATE posts SET publishedAt=NOW() WHERE id=8991");
      }
    });
    it.each(["admin", "moderator"])(
      "keeps %s service access to club discussion without a paid period",
      async (role) => {
        await conn.query("UPDATE users SET role=? WHERE id=8990", [role]);
        await conn.query(
          "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
        );
        expect(
          await client(bearer).club.comments.query({ postId: 8990 }),
        ).toMatchObject([{ id: 8990, text: "club author" }]);
      },
    );
    it("hides draft, scheduled, hidden and absent discussions from unpaid readers", async () => {
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
      );
      const original = await comments();
      for (const postId of [8993, 8994, 8996]) {
        await expect(
          client(bearer).club.comments.query({ postId }),
        ).rejects.toMatchObject({
          data: { code: "NOT_FOUND", httpStatus: 404 },
        });
      }
      await conn.query("UPDATE posts SET status='scheduled' WHERE id=8993");
      try {
        await expect(
          client(bearer).club.comments.query({ postId: 8993 }),
        ).rejects.toMatchObject({
          data: { code: "NOT_FOUND", httpStatus: 404 },
        });
        expect(await comments()).toEqual(original);
      } finally {
        await conn.query("UPDATE posts SET status='draft' WHERE id=8993");
      }
    });
    it("lists club author fields and viewer likes only for a live member", async () => {
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
      await expect(
        client(bearer).club.comments.query({ postId: 8990 }),
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
      "waits for an in-flight %s transaction and observes its committed state",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        const gate = `backend_test_native_${table}_gate`;
        const requests: Promise<boolean>[] = [];
        const [lock] = await conn.query<RowDataPacket[]>(
          "SELECT GET_LOCK(?,3) acquired",
          [gate],
        );
        expect(lock[0].acquired).toBe(1);
        let ownsTrigger = false;
        try {
          await conn.query(`CREATE TRIGGER ${gate} BEFORE INSERT ON ${table} FOR EACH ROW
            BEGIN IF NEW.userId=8990 AND NEW.postId=8991 THEN
            SET @native_reaction_gate=GET_LOCK('${gate}',10);
            IF @native_reaction_gate<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture gate timeout'; END IF;
            DO RELEASE_LOCK('${gate}'); END IF; END`);
          ownsTrigger = true;
          requests.push(client(bearer).feed[method].mutate({ postId: 8991 }));
          const waiting = async () => {
            const [rows] = await conn.query<RowDataPacket[]>(
              "SELECT COUNT(*) n FROM performance_schema.metadata_locks WHERE OBJECT_TYPE='USER LEVEL LOCK' AND OBJECT_NAME=? AND LOCK_STATUS='PENDING'",
              [gate],
            );
            return Number(rows[0].n);
          };
          await vi.waitFor(async () => expect(await waiting()).toBe(1), {
            timeout: 3000,
            interval: 20,
          });
          requests.push(client(bearer).feed[method].mutate({ postId: 8991 }));
          // Before repair both inserts reach the gate after observing absence.
          // After repair the second request waits on the real actor row instead.
          await vi.waitFor(
            async () => {
              const [rows] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) n FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='users' AND l.INDEX_NAME='PRIMARY' AND l.LOCK_DATA='8990'",
              );
              expect((await waiting()) >= 2 || Number(rows[0].n) >= 1).toBe(
                true,
              );
            },
            { timeout: 3000, interval: 20 },
          );
          const [before] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM ${table} WHERE userId=8990 AND postId=8991`,
          );
          expect(before).toEqual([]);
          await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
          const results = await Promise.all(requests);
          const [after] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM ${table} WHERE userId=8990 AND postId=8991`,
          );
          expect(after).toHaveLength(0);
          expect(results).toEqual([true, false]);
        } finally {
          await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
          await Promise.allSettled(requests);
          if (ownsTrigger) await conn.query(`DROP TRIGGER ${gate}`);
        }
      },
      15_000,
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "rejects %s for invalid, absent, unpublished and inaccessible posts without SQL writes",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        await conn.query(
          "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
        );
        await conn.query("UPDATE posts SET status='scheduled' WHERE id=8993");
        for (const [postId, code] of [
          [0, "BAD_REQUEST"],
          [-1, "BAD_REQUEST"],
          [8991.5, "BAD_REQUEST"],
          [8996, "NOT_FOUND"],
          [8993, "NOT_FOUND"],
          [8994, "NOT_FOUND"],
          [8990, "FORBIDDEN"],
        ] as const) {
          await expect(
            client(bearer).feed[method].mutate({ postId }),
          ).rejects.toMatchObject({ data: { code } });
          const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT postId FROM ${table} WHERE userId=8990`,
          );
          expect(rows).toEqual([]);
        }
        await conn.query("UPDATE posts SET status='draft' WHERE id=8993");
        await expect(
          client(bearer).feed[method].mutate({ postId: 8993 }),
        ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
        // Public reactions remain available without a subscription.
        expect(await client(bearer).feed[method].mutate({ postId: 8991 })).toBe(
          true,
        );
        expect(await client(bearer).feed[method].mutate({ postId: 8991 })).toBe(
          false,
        );
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT postId FROM ${table} WHERE userId=8990`,
        );
        expect(rows).toEqual([]);
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "preserves staff club access and does not remove inaccessible existing %s rows",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        await conn.query(
          "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-comment-subscription'",
        );
        for (const role of ["moderator", "admin"]) {
          await conn.query("UPDATE users SET role=? WHERE id=8990", [role]);
          expect(
            await client(bearer).feed[method].mutate({ postId: 8990 }),
          ).toBe(true);
          expect(
            await client(bearer).feed[method].mutate({ postId: 8990 }),
          ).toBe(false);
        }
        await conn.query("UPDATE users SET role='user' WHERE id=8990");
        await conn.query(
          `INSERT INTO ${table} (userId,postId) VALUES (8990,8990)`,
        );
        const [before] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM ${table} WHERE userId=8990`,
        );
        await expect(
          client(bearer).feed[method].mutate({ postId: 8990 }),
        ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
        expect(
          (
            await conn.query<RowDataPacket[]>(
              `SELECT * FROM ${table} WHERE userId=8990`,
            )
          )[0],
        ).toEqual(before);
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "rechecks publication after %s waits for a concurrent visibility edit",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        let pending: Promise<unknown> | undefined;
        await conn.beginTransaction();
        try {
          await conn.query("SELECT id FROM posts WHERE id=8991 FOR UPDATE");
          pending = client(bearer)
            .feed[method].mutate({ postId: 8991 })
            .then(
              (result) => result,
              (error: unknown) => error,
            );
          await vi.waitFor(
            async () => {
              const [rows] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS waiting FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks b ON b.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID WHERE b.OBJECT_SCHEMA='backend_test' AND b.OBJECT_NAME='posts' AND b.LOCK_DATA='8991'",
              );
              expect(Number(rows[0].waiting)).toBeGreaterThan(0);
            },
            { timeout: 5000 },
          );
          await conn.query(
            "UPDATE posts SET status='draft',published=FALSE WHERE id=8991",
          );
          await conn.commit();
          expect(await pending).toMatchObject({ data: { code: "NOT_FOUND" } });
          expect(
            (
              await conn.query<RowDataPacket[]>(
                `SELECT postId FROM ${table} WHERE userId=8990`,
              )
            )[0],
          ).toEqual([]);
        } finally {
          await conn.rollback();
          await pending;
          await conn.query(
            "UPDATE posts SET status='published',published=TRUE WHERE id=8991",
          );
        }
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "serializes concurrent %s requests without duplicates or lost toggles",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        for (const [requests, enabled, disabled, remaining] of [
          [20, 10, 10, 0],
          [21, 11, 10, 1],
        ]) {
          await conn.query(`DELETE FROM ${table} WHERE userId=8990`);
          const results = await Promise.all(
            Array.from({ length: requests }, () =>
              client(bearer).feed[method].mutate({ postId: 8991 }),
            ),
          );
          expect(results.filter((result) => result === true)).toHaveLength(
            enabled,
          );
          expect(results.filter((result) => result === false)).toHaveLength(
            disabled,
          );
          const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT userId,postId FROM ${table} WHERE userId=8990 AND postId=8991`,
          );
          expect(rows).toHaveLength(remaining);
          if (remaining) expect(rows).toEqual([{ userId: 8990, postId: 8991 }]);
        }
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "keeps concurrent %s requests isolated between actors",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        const author = await sdk.createSessionToken("native-comment-author", {
          sessionVersion: 0,
        });
        try {
          const [readerResults, authorResults] = await Promise.all(
            [bearer, author].map((token) =>
              Promise.all(
                Array.from({ length: 14 }, () =>
                  client(token).feed[method].mutate({ postId: 8991 }),
                ),
              ),
            ),
          );
          for (const results of [readerResults, authorResults]) {
            expect(results.filter((value) => value === true)).toHaveLength(7);
            expect(results.filter((value) => value === false)).toHaveLength(7);
          }
          const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT userId FROM ${table} WHERE userId IN (8990,8991) AND postId=8991`,
          );
          expect(rows).toEqual([]);
        } finally {
          await conn.query(
            `DELETE FROM ${table} WHERE userId=8991 AND postId=8991`,
          );
        }
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "disables all legacy %s duplicates without changing another post",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        await conn.query(
          `INSERT INTO ${table} (userId,postId) VALUES (8990,8991),(8990,8991),(8990,8990)`,
        );
        expect(await client(bearer).feed[method].mutate({ postId: 8991 })).toBe(
          false,
        );
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT postId FROM ${table} WHERE userId=8990`,
        );
        expect(rows).toEqual([{ postId: 8990 }]);
        expect(await client(bearer).feed[method].mutate({ postId: 8991 })).toBe(
          true,
        );
        const [enabled] = await conn.query<RowDataPacket[]>(
          `SELECT postId FROM ${table} WHERE userId=8990 AND postId=8991`,
        );
        expect(enabled).toEqual([{ postId: 8991 }]);
      },
    );
    it.each(["toggleLike", "toggleSave"] as const)(
      "rolls back failed %s writes and releases locks for the next request",
      async (method) => {
        const table = method === "toggleLike" ? "likes" : "saved_posts";
        const trigger = `backend_test_native_${table}_failure`;
        await conn.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON ${table} FOR EACH ROW
          BEGIN IF NEW.userId=8990 AND NEW.postId=8991 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture reaction failure'; END IF; END`);
        try {
          await expect(
            client(bearer).feed[method].mutate({ postId: 8991 }),
          ).rejects.toMatchObject({
            data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
          });
          const [rows] = await conn.query<RowDataPacket[]>(
            `SELECT id FROM ${table} WHERE userId=8990 AND postId=8991`,
          );
          expect(rows).toEqual([]);
        } finally {
          await conn.query(`DROP TRIGGER ${trigger}`);
        }
        expect(await client(bearer).feed[method].mutate({ postId: 8991 })).toBe(
          true,
        );
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT userId,postId FROM ${table} WHERE userId=8990 AND postId=8991`,
        );
        expect(rows).toEqual([{ userId: 8990, postId: 8991 }]);
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
