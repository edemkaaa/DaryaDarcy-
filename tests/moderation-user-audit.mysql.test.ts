import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
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
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";

/** Проверяет атомарность блокировки, session revocation, запроса отмены подписки и обязательного admin-аудита. */
describe.skipIf(!testDatabaseUrl)(
  "moderation user mutations and audit on disposable MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const moderation = new ModerationService();
    /** Открывает одноразовую схему и настоящий локальный API с synthetic JWT. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "moderation-audit-synthetic-jwt-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Убирает fault-триггер и восстанавливает собственного модератора, получателя и billing-профиль. */
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
    /** Гарантированно снимает адресный отказ INSERT аудита. */
    afterEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS moderation_user_audit_failure");
    });
    /** Закрывает API и соединения и возвращает окружение. */
    afterAll(async () => {
      await app?.close();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Читает блокировку и epoch получателя, pending/confirmed отмену и аудит актёра. */
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
    /** Устанавливает trigger отказа audit только для собственного тестового модератора. */
    async function rejectAudit() {
      await conn.query(`CREATE TRIGGER moderation_user_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW
      BEGIN IF NEW.actorUserId=8400 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END`);
    }
    for (const operation of ["blockUser", "unblockUser"] as const) {
      for (const target of ["admin", "moderator", "self"] as const) {
        /** Модератор не может блокировать или разблокировать admin, moderator либо себя; аккаунты, отмена и аудит неизменны. */
        it(`forbids moderator ${operation} against ${target} without account, cancellation or audit changes`, async () => {
          const targetId = target === "self" ? 8400 : 8401;
          if (target !== "self")
            await conn.query("UPDATE users SET role=? WHERE id=8401", [target]);
          if (operation === "unblockUser" && target !== "self")
            await conn.query(
              "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
            );
          const before = await state();
          const [actorBefore] = await conn.query(
            "SELECT id,role,blockedAt,blockedReason,sessionVersion FROM users WHERE id=8400",
          );
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
                  userId: targetId,
                  ...(operation === "blockUser"
                    ? { reason: "native reason" }
                    : {}),
                },
              }),
            },
          );
          expect(response.status).toBe(403);
          expect(await state()).toEqual(before);
          const [actorAfter] = await conn.query(
            "SELECT id,role,blockedAt,blockedReason,sessionVersion FROM users WHERE id=8400",
          );
          expect(actorAfter).toEqual(actorBefore);
        });
      }
      /** Внутри транзакции block/unblock заново проверяется снятая роль актёра. */
      it(`rechecks a revoked actor inside the ${operation} transaction`, async () => {
        await conn.query("UPDATE users SET role='user' WHERE id=8400");
        const before = await state();
        const result =
          operation === "blockUser"
            ? moderation.blockUser(
                { id: 8400, sessionVersion: 0 },
                8401,
                "native reason",
              )
            : moderation.unblockUser({ id: 8400, sessionVersion: 0 }, 8401);
        await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await state()).toEqual(before);
      });
    }
    for (const operation of ["blockUser", "unblockUser"] as const) {
      /** Старый контекст запрещён после смены epoch, включая блокировку и последующую разблокировку актёра. */
      it.each(["epoch", "blocked-then-restored"] as const)(
        `${operation} rejects an in-flight context after %s without side effects`,
        async (change) => {
          if (operation === "unblockUser")
            await conn.query(
              "UPDATE users SET blockedAt=NOW(),blockedReason='Retain block' WHERE id=8401",
            );
          const captured = appRouter.createCaller({
            user: (await getUserByOpenId("moderation-audit-actor"))!,
            req: {} as TrpcContext["req"],
            res: {} as TrpcContext["res"],
          });
          if (change === "blocked-then-restored") {
            await conn.query(
              "UPDATE users SET blockedAt=NOW(),sessionVersion=sessionVersion+1 WHERE id=8400",
            );
            await conn.query("UPDATE users SET blockedAt=NULL WHERE id=8400");
          } else
            await conn.query(
              "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=8400",
            );
          const before = await state();
          const result =
            operation === "blockUser"
              ? captured.moderation.blockUser({
                  userId: 8401,
                  reason: "Synthetic late block",
                })
              : captured.moderation.unblockUser({ userId: 8401 });
          await expect(result).rejects.toMatchObject({ code: "UNAUTHORIZED" });
          expect(await state()).toEqual(before);
        },
      );
      /** Новая аутентификация после отзыва epoch восстанавливает разрешённое действие и audit. */
      it(`${operation} allows a newly authenticated context after revocation`, async () => {
        if (operation === "unblockUser")
          await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=8401");
        await conn.query(
          "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=8400",
        );
        const current = appRouter.createCaller({
          user: (await getUserByOpenId("moderation-audit-actor"))!,
          req: {} as TrpcContext["req"],
          res: {} as TrpcContext["res"],
        });
        const result =
          operation === "blockUser"
            ? current.moderation.blockUser({
                userId: 8401,
                reason: "Fresh moderator",
              })
            : current.moderation.unblockUser({ userId: 8401 });
        expect(await result).toEqual({ ok: true });
        const saved = await state();
        expect(saved.audit).toHaveLength(1);
        expect(Boolean(saved.account.blockedAt)).toBe(
          operation === "blockUser",
        );
      });
      /** Отсутствующий участник даёт явный 404 без ложного подтверждения или аудита. */
      it(`does not confirm ${operation} for a deleted member or write a misleading audit`, async () => {
        await conn.query("DELETE FROM users WHERE id=8401");
        const before = await state();
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
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
          error: {
            json: {
              message: "Аккаунт не найден",
              data: { code: "NOT_FOUND", httpStatus: 404 },
            },
          },
        });
        expect(await state()).toEqual(before);
      });
    }
    for (const operation of ["blockUser", "unblockUser"] as const) {
      /** Fault аудита через HTTP откатывает block/unblock и возвращает безопасный 500 без SQL-деталей. */
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
    /** Ошибка audit откатывает блокировку, увеличение epoch и запрос отмены как одну операцию. */
    it("rolls back blocking, session revocation and cancellation intent when audit insertion fails", async () => {
      await rejectAudit();
      await expect(
        moderation.blockUser(
          { id: 8400, sessionVersion: 0 },
          8401,
          "test reason",
        ),
      ).rejects.toThrow();
      expect(await state()).toEqual({
        account: { blockedAt: null, blockedReason: null, sessionVersion: 7 },
        profile: { cancelRequestedAt: null, cancelledAt: null },
        audit: [],
      });
    });
    /** Без обязательного audit прежние блокировка и причина сохраняются. */
    it("rolls back unblocking when audit insertion fails", async () => {
      await conn.query(
        "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
      );
      const before = await state();
      await rejectAudit();
      await expect(
        moderation.unblockUser({ id: 8400, sessionVersion: 0 }, 8401),
      ).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
    /** Успешная блокировка увеличивает epoch и сохраняет audit с pending-отменой, не утверждая подтверждение провайдера. */
    it("commits blocking with its audit and pending cancellation without provider confirmation", async () => {
      expect(
        await moderation.blockUser(
          { id: 8400, sessionVersion: 0 },
          8401,
          "test reason",
        ),
      ).toEqual({
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
    /** Разблокировка снимает только блок и причину, сохраняя epoch и ранее запрошенную отмену. */
    it("commits unblocking with its audit without resetting sessions or cancellation intent", async () => {
      await conn.query(
        "UPDATE users SET blockedAt='2026-10-01 00:00:00',blockedReason='saved reason' WHERE id=8401",
      );
      await conn.query(
        "UPDATE billing_profiles SET cancelRequestedAt='2026-10-01 00:00:00' WHERE userId=8401",
      );
      const before = await state();
      expect(
        await moderation.unblockUser({ id: 8400, sessionVersion: 0 }, 8401),
      ).toEqual({ ok: true });
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
