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

/** Проверяет атомарное отклонение жалобы с аудитом и актуальность подсказок модераторских действий. */
describe.skipIf(!testDatabaseUrl)(
  "report dismissal audit on disposable MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const moderation = new ModerationService();
    /** Открывает одноразовую content-схему и локальный API с synthetic JWT. */
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "report-audit-synthetic-jwt-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Удаляет собственный audit-триггер, строки аудита, жалобы, комментарий, пост и пользователей. */
    async function cleanup() {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_report_audit_failure",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=8410");
      await conn.query("DELETE FROM comment_reports WHERE id IN (8413,8414)");
      await conn.query("DELETE FROM post_comments WHERE id=8412");
      await conn.query("DELETE FROM posts WHERE id=8415");
      await conn.query("DELETE FROM users WHERE id IN (8410,8411)");
    }
    /** Создаёт модератора, автора и две независимые жалобы на сохранённый комментарий. */
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (8410,'report-audit-actor','moderator'),(8411,'report-audit-author','user')",
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (8415,'fixture','[]','[]')",
      );
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (8412,8415,8411,'retained comment')",
      );
      await conn.query(
        "INSERT INTO comment_reports (id,commentId,reporterUserId,reason) VALUES (8413,8412,8411,'dismiss me'),(8414,8412,8410,'retain me')",
      );
    });
    /** Убирает адресный fault-триггер аудита после каждого сценария. */
    afterEach(async () => {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_report_audit_failure",
      );
    });
    /** Закрывает API, очищает собственные данные и соединения и восстанавливает окружение. */
    afterAll(async () => {
      await app?.close();
      if (conn) await cleanup();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Читает обе жалобы, исходный комментарий и audit для сравнения транзакционного результата. */
    async function state() {
      const [reports] = await conn.query<RowDataPacket[]>(
        "SELECT id,reason FROM comment_reports WHERE id IN (8413,8414) ORDER BY id",
      );
      const [comments] = await conn.query<RowDataPacket[]>(
        "SELECT id,text FROM post_comments WHERE id=8412",
      );
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=8410 ORDER BY id",
      );
      return { reports, comments, audit };
    }
    /** Запрещает INSERT аудита собственного модератора, имитируя сбой последней стадии операции. */
    async function rejectAudit() {
      await conn.query(`CREATE TRIGGER moderation_report_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=8410 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic report audit failure'; END IF; END`);
    }
    /** Отказ записи аудита сохраняет выбранную жалобу целиком. */
    it("retains the dismissed report when the audit write fails", async () => {
      const before = await state();
      await rejectAudit();
      await expect(
        moderation.dismissCommentReport({ id: 8410, sessionVersion: 0 }, 8413),
      ).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
    /** HTTP возвращает безопасный 500 без SQL и откатывает отклонение жалобы. */
    it("rolls back report dismissal through real HTTP and JWT without exposing SQL", async () => {
      const before = await state();
      await rejectAudit();
      const token = await sdk.createSessionToken("report-audit-actor", {
        sessionVersion: 0,
      });
      const response = await fetch(
        `${base}/api/trpc/moderation.dismissCommentReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: { reportId: 8413 } }),
        },
      );
      expect(response.status).toBe(500);
      const body = await response.text();
      expect(body).not.toContain("synthetic report audit failure");
      expect(body).not.toContain("admin_audit_log");
      expect(await state()).toEqual(before);
    });
    /** Коммит удаляет только выбранную жалобу, сохраняя комментарий и соседнюю жалобу. */
    it("commits only the selected dismissal and the moderator audit", async () => {
      expect(await moderation.dismissCommentReport({ id: 8410, sessionVersion: 0 }, 8413)).toEqual({
        ok: true,
      });
      expect(await state()).toEqual({
        reports: [{ id: 8414, reason: "retain me" }],
        comments: [{ id: 8412, text: "retained comment" }],
        audit: [
          {
            action: "dismiss_comment_report",
            targetType: "comment_report",
            targetId: 8413,
            details: null,
          },
        ],
      });
    });
    /** Совместимый повтор отсутствующей жалобы сохраняет успешный ответ и audit целевого ID. */
    it("preserves the existing audited success for an absent report", async () => {
      const before = await state();
      expect(await moderation.dismissCommentReport({ id: 8410, sessionVersion: 0 }, 8499)).toEqual({
        ok: true,
      });
      expect(await state()).toEqual({
        ...before,
        audit: [
          {
            action: "dismiss_comment_report",
            targetType: "comment_report",
            targetId: 8499,
            details: null,
          },
        ],
      });
    });
    /** После повышения автора до admin canBlockAuthor меняется, а запись отвергает прежнюю разрешающую подсказку. */
    it("recomputes author actions and still rejects a stale hint after a role change", async () => {
      const actor = { id: 8410, role: "moderator" as const, blockedAt: null, accountDeletionRequestedAt: null };
      expect((await moderation.listCommentReports(actor)).find(row => row.id === 8413)?.canBlockAuthor).toBe(true);
      // The write must not trust the earlier allowed hint.
      await conn.query("UPDATE users SET role='admin' WHERE id=8411");
      expect((await moderation.listCommentReports(actor)).find(row => row.id === 8413)?.canBlockAuthor).toBe(false);
      await expect(moderation.blockUser({ id: 8410, sessionVersion: 0 }, 8411, "synthetic stale hint")).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [rows] = await conn.query<RowDataPacket[]>("SELECT blockedAt FROM users WHERE id=8411");
      expect(rows[0].blockedAt).toBe(null);
    });
    /** Интерфейсная capability блокировки не предлагается для себя, отсутствующего и уже заблокированного автора. */
    it("does not offer self, absent or already blocked report authors", async () => {
      const actor = { id: 8410, role: "admin" as const, blockedAt: null, accountDeletionRequestedAt: null };
      await conn.query("UPDATE post_comments SET userId=8410 WHERE id=8412");
      expect((await moderation.listCommentReports(actor))[0].canBlockAuthor).toBe(false);
      await conn.query("UPDATE post_comments SET userId=8411 WHERE id=8412");
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=8411");
      expect((await moderation.listCommentReports(actor))[0].canBlockAuthor).toBe(false);
      await conn.query("DELETE FROM users WHERE id=8411");
      expect((await moderation.listCommentReports(actor))[0].canBlockAuthor).toBe(false);
    });
  },
);
