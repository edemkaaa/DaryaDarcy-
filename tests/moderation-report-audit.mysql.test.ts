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

describe.skipIf(!testDatabaseUrl)(
  "report dismissal audit on disposable MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const moderation = new ModerationService();
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "report-audit-synthetic-jwt-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_report_audit_failure",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=8410");
      await conn.query("DELETE FROM comment_reports WHERE id IN (8413,8414)");
      await conn.query("DELETE FROM post_comments WHERE id=8412");
      await conn.query("DELETE FROM posts WHERE id=8415");
      await conn.query("DELETE FROM users WHERE id IN (8410,8411)");
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
    afterEach(async () => {
      await conn.query(
        "DROP TRIGGER IF EXISTS moderation_report_audit_failure",
      );
    });
    afterAll(async () => {
      await app?.close();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
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
    async function rejectAudit() {
      await conn.query(`CREATE TRIGGER moderation_report_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=8410 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic report audit failure'; END IF; END`);
    }
    it("retains the dismissed report when the audit write fails", async () => {
      const before = await state();
      await rejectAudit();
      await expect(
        moderation.dismissCommentReport(8410, 8413),
      ).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
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
    it("commits only the selected dismissal and the moderator audit", async () => {
      expect(await moderation.dismissCommentReport(8410, 8413)).toEqual({
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
    it("preserves the existing audited success for an absent report", async () => {
      const before = await state();
      expect(await moderation.dismissCommentReport(8410, 8499)).toEqual({
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
  },
);
