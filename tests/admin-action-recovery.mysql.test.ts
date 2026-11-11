import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

/** Проверяем журнал административных намерений через настоящий HTTP и SQL, включая неизвестный результат и параллельные повторы. */
describe.skipIf(!testDatabaseUrl)(
  "durable admin actions through HTTP and disposable SQL",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    let admin: string, other: string, moderator: string, member: string;
    const target = 990804;
    /** Выполняем ограниченное чтение фикстуры для независимой сверки сохранённых эффектов. */
    const rows = async (q: string, args: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(q, args))[0];
    /** Удаляем свой триггер и записи выделенных аккаунтов, включая журнал операции, аудит и письма. */
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS owned_admin_action_failure");
      if (
        (
          await rows(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='admin_action_operations'",
          )
        ).length
      )
        await conn.query(
          "DELETE FROM admin_action_operations WHERE actorUserId BETWEEN 990800 AND 990804",
        );
      for (const table of [
        "admin_audit_log",
        "access_email_outbox",
        "password_tokens",
        "club_payments",
      ])
        await conn.query(
          `DELETE FROM ${table} WHERE ${table === "admin_audit_log" ? "actorUserId" : "userId"} BETWEEN 990800 AND 990804`,
        );
      await conn.query("DELETE FROM users WHERE id BETWEEN 990800 AND 990804");
    }
    /** Запускаем локальный Nest с синтетическими JWT/ключом шифрования; подменяем лишь Date для предсказуемых сроков. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "owned-admin-action-session-secret");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 9).toString("base64"),
      );
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Разносим часы за окно квот и восстанавливаем роли, токены и исходную оплаченную подписку цели. */
    beforeEach(async () => {
      vi.setSystemTime(Date.now() + 3600001);
      await cleanup();
      await conn.query(`INSERT INTO users(id,openId,email,role,passwordHash) VALUES
      (990800,'action-admin','action-admin@example.invalid','admin','synthetic'),
      (990801,'action-other','action-other@example.invalid','admin','synthetic'),
      (990802,'action-moderator','action-mod@example.invalid','moderator','synthetic'),
      (990803,'action-member','action-member@example.invalid','user','synthetic'),
      (990804,'action-target','action-target@example.invalid','user','synthetic')`);
      [admin, other, moderator, member] = await Promise.all(
        [
          "action-admin",
          "action-other",
          "action-moderator",
          "action-member",
        ].map((id) => sdk.createSessionToken(id, { sessionVersion: 0 })),
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,status,sum,expiresAt) VALUES(990804,'owned-action-initial','action-target@example.invalid','paid','790',?)",
        [new Date(Date.now() + 86400000)],
      );
    });
    /** Останавливаем HTTP, очищаем свои данные, закрываем SQL и возвращаем реальные часы и окружение. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
    /** Отправляем настоящий запрос admin-процедуры с SuperJSON и выбранной сессией, различая GET-статус и POST-изменение. */
    async function trpc(
      path: string,
      input: unknown,
      token = admin,
      mutation = false,
    ) {
      const value = superjson.stringify(input);
      const response = await fetch(
        `${base}/api/trpc/admin.${path}${mutation ? "" : "?input=" + encodeURIComponent(value)}`,
        {
          method: mutation ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(mutation ? { body: value } : {}),
        },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result
          ? superjson.deserialize<any>(json.result.data)
          : json.error?.json?.data?.code,
      };
    }
    /** Вызываем продление с неизменяемым ключом операции и выбранной целью/исполнителем. */
    const grant = (key: string, userId = target, token = admin) =>
      trpc("grantClub", { userId, idempotencyKey: key }, token, true);
    /** Читаем состояние исходного ключа без повторного выполнения административного эффекта. */
    const status = (key: string, token = admin) =>
      trpc("actionStatus", { idempotencyKey: key }, token);
    /** Через реальный REST ставим повтор письма с тем же ключом и разбираем JSON либо статус отказа. */
    async function resend(key: string, token = admin, userId = target) {
      const r = await fetch(base + "/api/admin/access-email/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, idempotencyKey: key }),
      });
      return {
        status: r.status,
        data: r.headers.get("content-type")?.includes("json")
          ? await r.json()
          : null,
      };
    }
    /** Шесть параллельных одинаковых продлений создают одну запись и один срок; новый ключ даёт отдельное продление. */
    it("replays one grant across concurrent/lost responses and returns its committed expiry", async () => {
      const key = randomUUID();
      const initial = (
        await rows(
          "SELECT expiresAt FROM club_payments WHERE orderId='owned-action-initial'",
        )
      )[0].expiresAt;
      const results = await Promise.all(
        Array.from({ length: 6 }, () => grant(key)),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(new Set(results.map((r) => JSON.stringify(r.data))).size).toBe(1);
      expect(results[0].data.expiresAt).toBe(
        new Date(initial.getTime() + 31 * 86400000).toISOString(),
      );
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
      ).toHaveLength(2);
      const read = await status(key);
      expect(read).toEqual({
        status: 200,
        data: {
          state: "succeeded",
          kind: "grantClub",
          userId: target,
          expiresAt: results[0].data.expiresAt,
        },
      });
      expect(await grant(key)).toEqual(results[0]);
      expect(await grant(randomUUID())).toMatchObject({ status: 200 });
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
      ).toHaveLength(3);
    });
    /** Локальный relay дожидается реального коммита и теряет только ответ; статус и повтор исходного ключа восстанавливают результат без дубля. */
    it.each(["grantClub", "resendAccessEmail"] as const)(
      "recovers %s after a relay drops the real committed HTTP response",
      async (kind) => {
        const key = randomUUID();
        const path =
          kind === "grantClub"
            ? "/api/trpc/admin.grantClub"
            : "/api/admin/access-email/resend";
        const input = { userId: target, idempotencyKey: key };
        const body =
          kind === "grantClub"
            ? superjson.stringify(input)
            : JSON.stringify(input);
        const upstreamStatuses: number[] = [];
        const relay = createServer(async (req, res) => {
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const upstream = await fetch(base + path, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${admin}`,
              },
              body: Buffer.concat(chunks),
            });
            await upstream.text(); // The real API has committed; discard its response.
            upstreamStatuses.push(upstream.status);
            res.destroy();
          } catch {
            res.destroy();
          }
        });
        await new Promise<void>((resolve) =>
          relay.listen(0, "127.0.0.1", resolve),
        );
        try {
          const url = `http://127.0.0.1:${(relay.address() as AddressInfo).port}`;
          await expect(
            fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            }),
          ).rejects.toThrow();
        } finally {
          relay.closeAllConnections();
          await new Promise<void>((resolve) => relay.close(() => resolve()));
        }
        expect(upstreamStatuses).toEqual([kind === "grantClub" ? 200 : 202]);
        const result = await status(key);
        expect(result.data).toMatchObject({
          state: "succeeded",
          kind,
          userId: target,
        });
        if (kind === "grantClub") {
          expect((await grant(key)).data.expiresAt).toBe(result.data.expiresAt);
          expect(
            await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
          ).toHaveLength(2);
        } else {
          expect((await resend(key)).status).toBe(202);
          expect(
            await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
              target,
            ]),
          ).toHaveLength(1);
        }
      },
    );
    /** Ответ продления совпадает с фактической датой сохранённой MySQL, включая точность и исходно истёкший доступ. */
    it("returns the expiry actually committed by MySQL for a previously expired account", async () => {
      await conn.query("DELETE FROM club_payments WHERE userId=?", [target]);
      const result = await grant(randomUUID());
      expect(result.status).toBe(200);
      const [stored] = await rows(
        "SELECT expiresAt FROM club_payments WHERE userId=?",
        [target],
      );
      expect(result.data.expiresAt).toBe(stored.expiresAt.toISOString());
    });
    /** Тот же ключ с иной целью/действием конфликтует, а другой администратор не видит чужую квитанцию. */
    it("conflicts on changed target or action and never leaks another actor's receipt", async () => {
      const key = randomUUID();
      await grant(key);
      expect((await grant(key, 990803)).status).toBe(409);
      expect((await resend(key)).status).toBe(409);
      expect(await status(key, other)).toEqual({
        status: 200,
        data: { state: "notFound" },
      });
      expect(await status(randomUUID())).toEqual({
        status: 200,
        data: { state: "notFound" },
      });
    });
    /** Параллельные и поздние повторы восстанавливают одну постановку outbox, даже если письмо уже отмечено отправленным. */
    it("replays the original mail enqueue even after delivery without sending a second mail", async () => {
      const key = randomUUID();
      const replies = await Promise.all(
        Array.from({ length: 6 }, () => resend(key)),
      );
      expect(
        replies.every((r) => r.status === 202 && r.data.queued === true),
      ).toBe(true);
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(1);
      await conn.query(
        "UPDATE access_email_outbox SET sentAt=CURRENT_TIMESTAMP WHERE userId=?",
        [target],
      );
      expect((await resend(key)).status).toBe(202);
      expect(await status(key)).toEqual({
        status: 200,
        data: {
          state: "succeeded",
          kind: "resendAccessEmail",
          userId: target,
          queued: true,
        },
      });
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(1);
      expect((await resend(randomUUID())).status).toBe(202);
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(2);
    });
    /** Отклонённое намерение остаётся отклонённым после разблокировки цели; новый ключ может выполнить новое действие. */
    it("persists a business rejection without replaying it after the target becomes available", async () => {
      const key = randomUUID();
      await conn.query(
        "UPDATE users SET blockedAt=CURRENT_TIMESTAMP WHERE id=?",
        [target],
      );
      expect((await grant(key)).status).toBe(409);
      expect(await status(key)).toEqual({
        status: 200,
        data: {
          state: "rejected",
          kind: "grantClub",
          userId: target,
          code: "CONFLICT",
        },
      });
      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=?", [target]);
      expect((await grant(key)).status).toBe(409);
      expect((await grant(randomUUID())).status).toBe(200);
    });
    /** Ошибка SQL-эффекта не оставляет успешной квитанции, поэтому тот же ключ после исправления допускает ровно одно исполнение. */
    it("rolls back a failed effect and permits retry with the same key", async () => {
      const key = randomUUID();
      await conn.query(
        "CREATE TRIGGER owned_admin_action_failure BEFORE INSERT ON club_payments FOR EACH ROW BEGIN IF NEW.userId=990804 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic action failure'; END IF; END",
      );
      expect((await grant(key)).status).toBe(500);
      expect(await status(key)).toEqual({
        status: 200,
        data: { state: "notFound" },
      });
      await conn.query("DROP TRIGGER owned_admin_action_failure");
      expect((await grant(key)).status).toBe(200);
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
      ).toHaveLength(2);
    });
    /** Отказ записи журнала атомарно откатывает и выдачу срока, и постановку письма; оба ключа остаются повторяемыми. */
    it("rolls back both effects when saving the receipt fails", async () => {
      const grantKey = randomUUID(),
        mailKey = randomUUID();
      await conn.query(
        "CREATE TRIGGER owned_admin_action_failure BEFORE INSERT ON admin_action_operations FOR EACH ROW BEGIN IF NEW.actorUserId=990800 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic receipt failure'; END IF; END",
      );
      expect((await grant(grantKey)).status).toBe(500);
      expect((await resend(mailKey)).status).toBe(503);
      expect(await status(grantKey)).toEqual({
        status: 200,
        data: { state: "notFound" },
      });
      expect(await status(mailKey)).toEqual({
        status: 200,
        data: { state: "notFound" },
      });
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(0);
      await conn.query("DROP TRIGGER owned_admin_action_failure");
      expect((await grant(grantKey)).status).toBe(200);
      expect((await resend(mailKey)).status).toBe(202);
    });
    /** Восстановление оплаченного доступа не превращает прежний отказ письма в новую отправку. */
    it("keeps a rejected email intent rejected after access is restored", async () => {
      const key = randomUUID();
      await conn.query("DELETE FROM club_payments WHERE userId=?", [target]);
      expect((await resend(key)).status).toBe(400);
      expect((await status(key)).data).toEqual({
        state: "rejected",
        kind: "resendAccessEmail",
        userId: target,
        code: "CONFLICT",
      });
      expect((await grant(randomUUID())).status).toBe(200);
      expect((await resend(key)).status).toBe(400);
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(0);
      expect((await resend(randomUUID())).status).toBe(202);
    });
    /** Параллельный polling сохраняет точные записи результата и число всех побочных эффектов. */
    it("status polling never adds grants, mail or audit records", async () => {
      const key = randomUUID();
      await resend(key);
      const before = await rows(
        "SELECT result FROM admin_action_operations WHERE actorUserId=990800",
      );
      const effects = await rows(
        "SELECT (SELECT COUNT(*) FROM access_email_outbox) mail,(SELECT COUNT(*) FROM club_payments) payments,(SELECT COUNT(*) FROM admin_audit_log) audit",
      );
      await Promise.all(Array.from({ length: 8 }, () => status(key)));
      expect(
        await rows(
          "SELECT result FROM admin_action_operations WHERE actorUserId=990800",
        ),
      ).toEqual(before);
      expect(
        await rows(
          "SELECT (SELECT COUNT(*) FROM access_email_outbox) mail,(SELECT COUNT(*) FROM club_payments) payments,(SELECT COUNT(*) FROM admin_audit_log) audit",
        ),
      ).toEqual(effects);
    });
    /** Идемпотентные повторы всё равно учитываются транспортной часовой квотой, но не создают дополнительные письма. */
    it("preserves the existing hourly mail limit for new and repeated keys", async () => {
      const key = randomUUID();
      for (let n = 0; n < 20; n++) expect((await resend(key)).status).toBe(202);
      expect((await resend(key)).status).toBe(429);
      expect((await status(key)).data.state).toBe("succeeded");
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(1);
    });
    /** После понижения роли и status, и повтор ранее успешного ключа запрещены; гость и обычный пользователь также отклоняются. */
    it("rechecks actor rights for both replay and status", async () => {
      const key = randomUUID();
      await grant(key);
      await conn.query("UPDATE users SET role='user' WHERE id=990800");
      expect((await grant(key)).status).toBe(403);
      expect((await status(key)).status).toBe(403);
      expect((await status(key, member)).status).toBe(403);
      expect((await status(key, "")).status).toBe(401);
    });
    /** Модератор может поставить письмо и прочитать свой результат, но не получает права продления. */
    it("allows a moderator's keyed mail but refuses a moderator's grant", async () => {
      const key = randomUUID();
      expect((await resend(key, moderator)).status).toBe(202);
      expect((await status(key, moderator)).data.state).toBe("succeeded");
      expect((await grant(randomUUID(), target, moderator)).status).toBe(403);
    });
    /** Некорректный ключ отклоняется до создания платежа или письма. */
    it("rejects malformed keys before any effect", async () => {
      expect((await grant("bad-key")).status).toBe(400);
      expect((await resend("bad-key")).status).toBe(400);
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [target]),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
          target,
        ]),
      ).toHaveLength(0);
    });
  },
);
