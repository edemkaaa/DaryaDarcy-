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
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";

describe.skipIf(!testDatabaseUrl)(
  "moderation user mutations and audit on disposable MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const moderation = new ModerationService();
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "moderation-audit-synthetic-jwt-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS moderation_user_audit_failure");
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=8400");
      await conn.query("DELETE FROM billing_profiles WHERE userId=8401");
      await conn.query("DELETE FROM users WHERE id IN (8400,8401)");
      await conn.query(
        "INSERT INTO users (id,openId,email,sessionVersion,role) VALUES (8400,'moderation-audit-actor','actor@example.test',0,'moderator'),(8401,'moderation-audit-target','target@example.test',7,'user')",
      );
      await conn.query(
        "INSERT INTO billing_profiles (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES ('moderation-audit-profile',8401,'fixture.payform.ru','123','456','target@example.test',79000)",
      );
    });
    afterEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS moderation_user_audit_failure");
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
      const [account] = await conn.query<RowDataPacket[]>(
        "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=8401",
      );
      const [profile] = await conn.query<RowDataPacket[]>(
        "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=8401",
      );
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=8400 ORDER BY id",
      );
      return { account: account[0], profile: profile[0], audit };
    }
    async function rejectAudit() {
      await conn.query(`CREATE TRIGGER moderation_user_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=8400 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END`);
    }
    for (const operation of ["blockUser", "unblockUser"] as const) {
      it(`returns a safe HTTP failure with no persisted ${operation} when the audit fails`, async () => {
        if (operation === "unblockUser")
          await conn.query(
            "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
          );
        const before = await state();
        await rejectAudit();
        const token = await sdk.createSessionToken("moderation-audit-actor", {
          sessionVersion: 0,
        });
        const response = await fetch(
          `${base}/api/trpc/moderation.${operation}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              json: {
                userId: 8401,
                ...(operation === "blockUser"
                  ? { reason: "native reason" }
                  : {}),
              },
            }),
          },
        );
        expect(response.status).toBe(500);
        const body = await response.text();
        expect(body).not.toContain("synthetic audit failure");
        expect(body).not.toContain("admin_audit_log");
        expect(await state()).toEqual(before);
      });
    }
    it("rolls back blocking, session revocation and cancellation intent when audit insertion fails", async () => {
      await rejectAudit();
      await expect(
        moderation.blockUser(8400, 8401, "test reason"),
      ).rejects.toThrow();
      expect(await state()).toEqual({
        account: { blockedAt: null, blockedReason: null, sessionVersion: 7 },
        profile: { cancelRequestedAt: null, cancelledAt: null },
        audit: [],
      });
    });
    it("rolls back unblocking when audit insertion fails", async () => {
      await conn.query(
        "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
      );
      const before = await state();
      await rejectAudit();
      await expect(moderation.unblockUser(8400, 8401)).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
    it("commits blocking with its audit and pending cancellation without provider confirmation", async () => {
      expect(await moderation.blockUser(8400, 8401, "test reason")).toEqual({
        ok: true,
      });
      const saved = await state();
      expect(saved.account).toEqual({
        blockedAt: expect.any(Date),
        blockedReason: "test reason",
        sessionVersion: 8,
      });
      expect(saved.profile).toEqual({
        cancelRequestedAt: expect.any(Date),
        cancelledAt: null,
      });
      expect(saved.audit).toEqual([
        {
          action: "block_user",
          targetType: "user",
          targetId: 8401,
          details: "test reason",
        },
      ]);
    });
    it("commits unblocking with its audit without resetting sessions or cancellation intent", async () => {
      await conn.query(
        "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
      );
      await conn.query(
        "UPDATE billing_profiles SET cancelRequestedAt='2026-10-01 00:00:00' WHERE userId=8401",
      );
      const before = await state();
      expect(await moderation.unblockUser(8400, 8401)).toEqual({ ok: true });
      const saved = await state();
      expect(saved.account).toEqual({
        blockedAt: null,
        blockedReason: null,
        sessionVersion: 7,
      });
      expect(saved.profile).toEqual(before.profile);
      expect(saved.audit).toEqual([
        {
          action: "unblock_user",
          targetType: "user",
          targetId: 8401,
          details: null,
        },
      ]);
    });
  },
);
