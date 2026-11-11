import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";

/** Проверяет атомарное модераторское удаление комментария с обязательным аудитом и сохранением ответов. */
describe.skipIf(!testDatabaseUrl)(
  "reported comment audit on disposable MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const moderation = new ModerationService();
    /** Создаёт изолированный content-стенд и настоящий локальный API для JWT-проверки. */
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "comment-audit-synthetic-jwt-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Удаляет собственный fault-триггер, аудит, обсуждение, пост и двух пользователей. */
    async function clearFixture() {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_comment_audit_failure",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=8420");
      await conn.query(
        "DELETE FROM comment_reports WHERE commentId IN (8422,8423)",
      );
      await conn.query(
        "DELETE FROM comment_likes WHERE commentId IN (8422,8423)",
      );
      await conn.query("DELETE FROM post_comments WHERE id IN (8422,8423)");
      await conn.query("DELETE FROM posts WHERE id=8424");
      await conn.query("DELETE FROM users WHERE id IN (8420,8421)");
    }
    /** Восстанавливает модератора, автора, корневой комментарий и ответ с независимыми лайками и жалобами. */
    beforeEach(async () => {
      await clearFixture();
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (8420,'comment-audit-actor','moderator'),(8421,'comment-audit-author','user')",
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (8424,'fixture','[]','[]')",
      );
      await conn.query(
        "INSERT INTO post_comments (id,postId,parentId,userId,text) VALUES (8422,8424,NULL,8421,'remove me'),(8423,8424,8422,8421,'retain reply')",
      );
      await conn.query(
        "INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (8422,8420,'target report'),(8423,8420,'reply report')",
      );
      await conn.query(
        "INSERT INTO comment_likes (commentId,userId) VALUES (8422,8420),(8423,8420)",
      );
    });
    /** Снимает тестовый триггер отказа аудита после каждого сценария. */
    afterEach(async () => {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_comment_audit_failure",
      );
    });
    /** Закрывает API и даже при ошибке уборки закрывает оба соединения и возвращает окружение. */
    afterAll(async () => {
      await app?.close();
      try {
        if (conn) await clearFixture();
      } finally {
        await conn?.end();
        const database = await getDb();
        await (
          database as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
        vi.unstubAllEnvs();
      }
    });
    /** Читает комментарии, parentId, жалобы, лайки и аудит для проверки согласованного каскада. */
    async function state() {
      const [comments] = await conn.query<RowDataPacket[]>(
        "SELECT id,parentId,text FROM post_comments WHERE id IN (8422,8423) ORDER BY id",
      );
      const [reports] = await conn.query<RowDataPacket[]>(
        "SELECT commentId,reason FROM comment_reports WHERE commentId IN (8422,8423) ORDER BY commentId",
      );
      const [likes] = await conn.query<RowDataPacket[]>(
        "SELECT commentId,userId FROM comment_likes WHERE commentId IN (8422,8423) ORDER BY commentId",
      );
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=8420 ORDER BY id",
      );
      return { comments, reports, likes, audit };
    }
    /** Создаёт триггер отказа вставки аудита только для собственного модератора. */
    async function rejectAudit() {
      await conn.query(`CREATE TRIGGER moderation_comment_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=8420 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic comment audit failure'; END IF; END`);
    }
    /** Отказ обязательного аудита откатывает удаление, реакции и отсоединение ответа. */
    it("restores comment, reply parent, likes and reports when its audit fails", async () => {
      const before = await state();
      await rejectAudit();
      await expect(
        moderation.deleteReportedComment({ id: 8420, sessionVersion: 0 }, 8422),
      ).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
    /** Реальный HTTP при отказе аудита возвращает 500 без SQL-деталей и без изменения обсуждения. */
    it("rolls back deletion through real HTTP and JWT without exposing SQL", async () => {
      const before = await state();
      await rejectAudit();
      const token = await sdk.createSessionToken("comment-audit-actor", {
        sessionVersion: 0,
      });
      const response = await fetch(
        `${base}/api/trpc/moderation.deleteReportedComment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            json: { commentId: 8422, actorUserId: 9999 },
          }),
        },
      );
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).not.toContain("synthetic comment audit failure");
      expect(body).not.toContain("admin_audit_log");
      expect(await state()).toEqual(before);
    });
    /** Успех удаляет только выбранный комментарий с реакциями и коммитит audit; ответ сохраняется без parentId. */
    it("commits deletion and audit while retaining the detached reply and its reactions", async () => {
      expect(await moderation.deleteReportedComment({ id: 8420, sessionVersion: 0 }, 8422)).toEqual({
        ok: true,
      });
      expect(await state()).toEqual({
        comments: [{ id: 8423, parentId: null, text: "retain reply" }],
        reports: [{ commentId: 8423, reason: "reply report" }],
        likes: [{ commentId: 8423, userId: 8420 }],
        audit: [
          {
            action: "delete_reported_comment",
            targetType: "comment",
            targetId: 8422,
            details: null,
          },
        ],
      });
    });
    /** Отсутствующий комментарий даёт NOT_FOUND без каскада или ложного audit. */
    it("preserves NOT_FOUND without audit or cascade for an absent comment", async () => {
      const before = await state();
      await expect(
        moderation.deleteReportedComment({ id: 8420, sessionVersion: 0 }, 8499),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await state()).toEqual(before);
    });
    /** Отсутствие жалоб не мешает модераторскому удалению с обязательной записью аудита. */
    it("continues to delete a comment without reports and records its audit", async () => {
      await conn.query("DELETE FROM comment_reports WHERE commentId=8422");
      await moderation.deleteReportedComment({ id: 8420, sessionVersion: 0 }, 8422);
      const result = await state();
      expect(result.comments).toEqual([
        { id: 8423, parentId: null, text: "retain reply" },
      ]);
      expect(result.audit).toEqual([
        {
          action: "delete_reported_comment",
          targetType: "comment",
          targetId: 8422,
          details: null,
        },
      ]);
    });
  },
);
