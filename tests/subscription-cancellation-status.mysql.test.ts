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
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import * as db from "../apps/backend/src/db";
import { billingKey } from "../apps/backend/src/billing/protocol";
import { processCancellations } from "../apps/backend/src/billing/cancellation";
import { cancelProdamusSubscription } from "../apps/backend/src/prodamus";
import type { AppRouter } from "../apps/backend/src/routers";

// Native HTTP/JWT/SQL and signed cancellation HTTP against loopback only.
// No checkout, external provider, payments, SMTP or real notification delivery.
/** Проверяет pending и confirmed отмены через настоящий HTTP, JWT, SQL и локальный подписанный провайдер. */
describe.skipIf(!testDatabaseUrl)(
  "cancellation status across native HTTP and SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let merchant: Server;
    let droppedReply: Server;
    let base: string;
    let dropBase: string;
    let calls: string[];
    let protocolErrors: number;
    let mode: "failure" | "success" | "partial" | "disconnect";
    const actorId = 98710;
    const otherId = 98711;
    const expiresAt = new Date("2030-12-01T00:00:00Z");
    const secret = "synthetic-cancellation-loopback-signing-key";
    const nativeFetch = globalThis.fetch;
    /** Открывает локальный сервер на случайном порту и возвращает его loopback-адрес. */
    async function listen(server: Server) {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }
    /** Закрывает собственный HTTP-сервер вместе с оставшимися соединениями. */
    async function close(server?: Server) {
      if (!server) return;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    }
    /** Читает контрольные строки SQL для состояния отмены. */
    async function rows(query: string, values: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, values))[0];
    }
    /** Снимает recurring-профили с lease и оплаченные сроки пользователя. */
    async function state() {
      return {
        profiles: await rows(
          "SELECT profileKey,cancelRequestedAt,cancelledAt,attempts,nextAttemptAt,leaseId,leaseUntil FROM billing_profiles WHERE userId=? ORDER BY profileKey",
          [actorId],
        ),
        payments: await rows(
          "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=?",
          [actorId],
        ),
      };
    }
    /** Создаёт HTTP tRPC-клиент для выбранного пользователя или гостя и управляемого прокси-адреса. */
    function client(userId?: number, origin = base) {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${origin}/api/trpc`,
            transformer: superjson,
            /** Подписывает отдельный JWT выбранного синтетического аккаунта либо оставляет запрос гостевым. */
            headers: async () =>
              userId === undefined
                ? {}
                : {
                    Authorization: `Bearer ${await sdk.createSessionToken(`cancellation-status-${userId}`, { sessionVersion: 0 })}`,
                  },
          }),
        ],
      });
    }
    /** Делает готовыми к повтору только собственные recurring-профили, не меняя production-backoff. */
    async function due() {
      // Advance only these owned fixtures, not the worker's real backoff policy.
      await conn.query(
        "UPDATE billing_profiles SET nextAttemptAt=NOW() WHERE userId=?",
        [actorId],
      );
    }
    /** Запускает локальный подписанный провайдер и API; прокси может потерять ответ только после завершения upstream-запроса. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      merchant = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) body += String(chunk);
        const data = new URLSearchParams(body);
        const profile = data.get("profile");
        const canonical = JSON.stringify({
          active_user: "0",
          profile,
          subscription: "123",
        });
        if (
          request.method !== "POST" ||
          request.url !== "/rest/setActivity/" ||
          !["456", "457"].includes(profile ?? "") ||
          data.get("subscription") !== "123" ||
          data.get("active_user") !== "0" ||
          data.has("active_manager") ||
          data.get("signature") !==
            createHmac("sha256", secret).update(canonical).digest("hex")
        ) {
          protocolErrors++;
          response.writeHead(400).end("synthetic invalid request");
          return;
        }
        calls.push(profile!);
        if (mode === "disconnect") {
          response.destroy();
          return;
        }
        const confirmed =
          mode === "success" || (mode === "partial" && profile === "456");
        response
          .writeHead(confirmed ? 200 : 503)
          .end(confirmed ? "success" : "not confirmed");
      });
      const provider = await listen(merchant);
      for (const [key, value] of Object.entries({
        DATABASE_URL: testDatabaseUrl!,
        NODE_ENV: "test",
        JWT_SECRET: "synthetic-cancellation-status-session-key",
        PRODAMUS_PAYFORM_URL: provider,
        PRODAMUS_SECRET: secret,
        PRODAMUS_SUBSCRIPTION_ID: "123",
      }))
        vi.stubEnv(key, value);
      vi.stubGlobal("fetch", ((input, options) => {
        const target = new URL(
          input instanceof Request ? input.url : String(input),
        );
        if (target.protocol !== "http:" || target.hostname !== "127.0.0.1")
          throw new Error("External HTTP forbidden in cancellation fixture");
        return nativeFetch(input, options);
      }) as typeof fetch);
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      // Lose only the client response after the upstream API has fully completed.
      droppedReply = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) body += String(chunk);
        const upstream = await nativeFetch(`${base}/api/trpc/club.cancel`, {
          method: "POST",
          body,
          headers: {
            "Content-Type": "application/json",
            Authorization: request.headers.authorization ?? "",
          },
        });
        await upstream.arrayBuffer();
        response.destroy();
      });
      dropBase = await listen(droppedReply);
    });
    /** Пересоздаёт два аккаунта и точную цепочку заказа, квитанции, recurring-профиля и письма. */
    beforeEach(async () => {
      calls = [];
      protocolErrors = 0;
      mode = "failure";
      for (const table of [
        "access_email_outbox",
        "billing_receipts",
        "billing_profiles",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId IN (?,?)`, [
          actorId,
          otherId,
        ]);
      await conn.query("DELETE FROM users WHERE id IN (?,?)", [
        actorId,
        otherId,
      ]);
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (?,'cancellation-status-98710','user'),(?,'cancellation-status-98711','user')",
        [actorId, otherId],
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt,sum,email) VALUES (?,'club-98710-synthetic','paid',?,'790','synthetic@example.test')",
        [actorId, expiresAt],
      );
      await conn.query(
        "INSERT INTO billing_profiles(profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES ('cancellation-status-one',?,'127.0.0.1','123','456','synthetic@example.test',79000)",
        [actorId],
      );
      const paymentKey = billingKey(["127.0.0.1", "98710-payment"]);
      const payloadHash = billingKey([
        "club-98710-synthetic",
        "79000",
        "synthetic@example.test",
        "rub",
        "123",
        "456",
      ]);
      await conn.query(
        "INSERT INTO billing_receipts(paymentKey,userId,orderId,payloadHash,amountMinor) VALUES (?,?,'club-98710-synthetic',?,79000)",
        [paymentKey, actorId, payloadHash],
      );
      await conn.query(
        "INSERT INTO access_email_outbox(eventKey,userId,email,kind,payload) VALUES (?,?,'synthetic@example.test','club-access',JSON_OBJECT('orderId','club-98710-synthetic'))",
        [`club-access:${paymentKey}`, actorId],
      );
    });
    /** Удаляет собственный отказной триггер, возвращает подмены и проверяет отсутствие нарушений протокола провайдера. */
    afterEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS owned_cancellation_sql_failure");
      vi.restoreAllMocks();
      expect(protocolErrors).toBe(0);
    });
    /** Закрывает прокси, API и провайдера, удаляет свои записи и восстанавливает глобальный fetch и окружение. */
    afterAll(async () => {
      await close(droppedReply);
      await app?.close();
      await close(merchant);
      if (conn) {
        for (const table of [
          "access_email_outbox",
          "billing_receipts",
          "billing_profiles",
          "club_payments",
        ])
          await conn.query(`DELETE FROM ${table} WHERE userId IN (?,?)`, [
            actorId,
            otherId,
          ]);
        await conn.query("DELETE FROM users WHERE id IN (?,?)", [
          actorId,
          otherId,
        ]);
        await conn.end();
      }
      const database = await db.getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    /** Проверяет различие отказа SQL до и после сохранения намерения: серверная ошибка не должна выглядеть окончательным клиентским отказом. */
    it.each(["before commit", "after commit"] as const)(
      "SQL failure %s is a server error, never a terminal client rejection",
      async (stage) => {
        const before = await state();
        await conn.query(`CREATE TRIGGER owned_cancellation_sql_failure
          BEFORE UPDATE ON billing_profiles FOR EACH ROW
          BEGIN
            IF NEW.userId = 98710 AND ${stage === "before commit" ? "NEW.cancelRequestedAt IS NOT NULL" : "NEW.leaseId IS NOT NULL"} THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRIVATE_CANCELLATION_SQL_DETAIL';
            END IF;
          END`);
        await expect(
          client(actorId).club.cancel.mutate(),
        ).rejects.toMatchObject({
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        });
        expect(calls).toEqual([]);
        const saved = await state();
        expect(saved.payments).toEqual(before.payments);
        if (stage === "before commit") {
          expect(saved).toEqual(before);
        } else {
          expect(saved.profiles[0]).toMatchObject({
            cancelRequestedAt: expect.any(Date),
            cancelledAt: null,
            attempts: 0,
            leaseId: null,
            leaseUntil: null,
          });
        }
        expect(await client(actorId).club.subscription.query()).toMatchObject({
          cancellationStatus: stage === "before commit" ? "none" : "pending",
          hasClubAccess: true,
          cancelAtPeriodEnd: false,
          expiresAt,
        });
        await conn.query("DROP TRIGGER owned_cancellation_sql_failure");
        mode = "success";
        expect(await client(actorId).club.cancel.mutate()).toMatchObject({
          ok: true,
          cancellationStatus: "confirmed",
          expiresAt,
        });
        expect(calls).toEqual(["456"]);
      },
    );
    /** Проверяет безопасный отказ для legacy-подписки без доказанной привязки recurring-профиля. */
    it("an unverified legacy billing profile remains a safe client refusal", async () => {
      await conn.query("DELETE FROM billing_profiles WHERE userId=?", [
        actorId,
      ]);
      const before = await state();
      await expect(client(actorId).club.cancel.mutate()).rejects.toMatchObject({
        message: "Не удалось определить подписку. Обратитесь в поддержку.",
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
      expect(await state()).toEqual(before);
      expect(calls).toEqual([]);
    });
    /** Проверяет pending при 503 провайдера и его восстановление новым клиентом только чтением без потери оплаченного срока. */
    it("returns pending on provider 503, then restores it with a read-only fresh client", async () => {
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "none",
      });
      expect(await client(actorId).club.cancel.mutate()).toMatchObject({
        ok: true,
        cancellationStatus: "pending",
        expiresAt,
        message: expect.stringContaining(
          "автосписание может оставаться активным",
        ),
      });
      const saved = await state();
      expect(saved.profiles).toHaveLength(1);
      expect(saved.profiles[0]).toMatchObject({
        cancelRequestedAt: expect.any(Date),
        cancelledAt: null,
        attempts: 1,
      });
      expect(saved.payments).toEqual([
        {
          orderId: "club-98710-synthetic",
          status: "paid",
          expiresAt,
          cancelAtPeriodEnd: 0,
        },
      ]);
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "pending",
        hasClubAccess: true,
        cancelAtPeriodEnd: false,
        expiresAt,
      });
      expect(await state()).toEqual(saved);
      expect(calls).toEqual(["456"]);
    });
    /** Проверяет восстановление потерянного ответа без второй отправки провайдеру и дублирования запроса отмены. */
    it("recovers a lost response without a second provider attempt or duplicate request", async () => {
      await expect(
        client(actorId, dropBase).club.cancel.mutate(),
      ).rejects.toThrow();
      const saved = await state();
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "pending",
        cancelAtPeriodEnd: false,
        expiresAt,
      });
      expect(await client(actorId).club.cancel.mutate()).toMatchObject({
        cancellationStatus: "pending",
      });
      expect(await state()).toEqual(saved);
      expect(calls).toEqual(["456"]);
    });
    /** Проверяет pending при разрыве соединения провайдером вместо ложного неуспеха принятого API-действия. */
    it("reports a disconnected provider as pending, not a failed API request", async () => {
      mode = "disconnect";
      expect(await client(actorId).club.cancel.mutate()).toMatchObject({
        ok: true,
        cancellationStatus: "pending",
        expiresAt,
      });
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "pending",
        cancelAtPeriodEnd: false,
      });
    });
    /** Проверяет переход к confirmed после фонового подтверждения с сохранением оплаченного доступа до окончания срока. */
    it("worker confirmation changes reads to confirmed and preserves the paid period", async () => {
      await client(actorId).club.cancel.mutate();
      await due();
      mode = "success";
      await processCancellations(
        (await db.getDb())!,
        cancelProdamusSubscription,
        actorId,
      );
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "confirmed",
        cancelAtPeriodEnd: true,
        hasClubAccess: true,
        expiresAt,
      });
      expect(await client(actorId).club.cancel.mutate()).toMatchObject({
        ok: true,
        cancellationStatus: "confirmed",
        expiresAt,
      });
      expect(calls).toEqual(["456", "456"]);
    });
    /** Проверяет, что частичное подтверждение нескольких recurring-профилей не объявляет всю подписку отменённой. */
    it("partial provider confirmation does not report all renewal profiles cancelled", async () => {
      await conn.query(
        "INSERT INTO billing_profiles(profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES ('cancellation-status-two',?,'127.0.0.1','123','457','synthetic@example.test',79000)",
        [actorId],
      );
      mode = "partial";
      expect(await client(actorId).club.cancel.mutate()).toMatchObject({
        cancellationStatus: "pending",
      });
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "pending",
        cancelAtPeriodEnd: false,
      });
      await due();
      mode = "success";
      await processCancellations(
        (await db.getDb())!,
        cancelProdamusSubscription,
        actorId,
      );
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "confirmed",
        cancelAtPeriodEnd: true,
        expiresAt,
      });
      expect(calls).toEqual(["456", "457", "457"]);
    });
    /** Удерживает SQL-блокировку пользователя и проверяет отзыв сессии перед продолжением отмены без обращения к провайдеру. */
    it("rejects cancellation after session revocation while waiting for the user lock", async () => {
      const control = await mysql.createConnection({
        uri: testDatabaseUrl!,
        timezone: "Z",
      });
      const before = await state();
      let pending: Promise<unknown> | undefined;
      try {
        await control.beginTransaction();
        await control.query("UPDATE users SET sessionVersion=1 WHERE id=?", [
          actorId,
        ]);
        const request = client(actorId)
          .club.cancel.mutate()
          .then(
            (result) => ({ result }),
            (error) => ({ error }),
          );
        pending = request;
        await vi.waitFor(
          async () => {
            const waiting = await rows(
              "SELECT COUNT(*) n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
              [control.threadId],
            );
            expect(waiting[0].n).toBeGreaterThan(0);
          },
          { timeout: 3000, interval: 20 },
        );
        await control.commit();
        expect(await request).toMatchObject({
          error: { data: { code: "UNAUTHORIZED", httpStatus: 401 } },
        });
        expect(await state()).toEqual(before);
        expect(calls).toEqual([]);
      } finally {
        await control.rollback();
        await pending;
        await control.end();
      }
    });
    /** Проверяет отказ нового непривязанного заказа независимо от более старого отменённого профиля и legacy-флага. */
    it("refuses an unbound new order despite an older cancelled profile", async () => {
      await conn.query(
        "UPDATE billing_profiles SET cancelRequestedAt=NOW(),cancelledAt=NOW() WHERE userId=?",
        [actorId],
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,email,expiresAt,sum) VALUES (?,'club-new-unbound','paid','synthetic@example.test',DATE_ADD(?, INTERVAL 30 DAY),'790')",
        [actorId, expiresAt],
      );
      const before = await state();
      await expect(client(actorId).club.cancel.mutate()).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
      expect(await state()).toEqual(before);
      expect(calls).toEqual([]);
      // Old versions could persist this flag for an unrelated order.
      await conn.query(
        "UPDATE club_payments SET cancelAtPeriodEnd=1 WHERE orderId='club-new-unbound'",
      );
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "none",
        cancelAtPeriodEnd: false,
        hasClubAccess: true,
      });
    });
    /** Проверяет точную привязку квитанции к recurring-профилю даже при совпавших email и сумме. */
    it("refuses a receipt whose profile is different even when amount and email match", async () => {
      await conn.query(
        "UPDATE billing_receipts SET payloadHash=? WHERE userId=?",
        [
          billingKey([
            "club-98710-synthetic",
            "79000",
            "synthetic@example.test",
            "rub",
            "123",
            "457",
          ]),
          actorId,
        ],
      );
      await expect(client(actorId).club.cancel.mutate()).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      });
      expect((await state()).profiles[0].cancelRequestedAt).toBeNull();
      expect(calls).toEqual([]);
    });
    /** Проверяет отсутствие доступа к чужому pending-запросу и невозможность отмены гостем или другим аккаунтом. */
    it("does not leak or cancel another account's pending request", async () => {
      await client(actorId).club.cancel.mutate();
      const saved = await state();
      expect(await client(otherId).club.subscription.query()).toMatchObject({
        cancellationStatus: "none",
        subscribed: false,
      });
      expect(await client().club.subscription.query()).toMatchObject({
        cancellationStatus: "none",
      });
      await expect(client(otherId).club.cancel.mutate()).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
      await expect(client().club.cancel.mutate()).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
      expect(await state()).toEqual(saved);
      expect(calls).toEqual(["456"]);
    });
    /** Проверяет видимость уже принятой pending-отмены после истечения оплаченного доступа. */
    it("keeps a saved pending request visible even after paid access expires", async () => {
      await client(actorId).club.cancel.mutate();
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=?",
        [actorId],
      );
      expect(await client(actorId).club.subscription.query()).toMatchObject({
        cancellationStatus: "pending",
        subscribed: false,
        hasClubAccess: false,
      });
      expect(calls).toEqual(["456"]);
    });
    /** Приостанавливает настоящее чтение оплаченного периода и проверяет, что конкурентное подтверждение не создаёт ложный статус none. */
    it("never emits none between an earlier paid read and concurrent worker confirmation", async () => {
      await client(actorId).club.cancel.mutate();
      await due();
      const actual = db.getActiveClubSubscription;
      let observed!: () => void;
      let release!: () => void;
      const readStarted = new Promise<void>((resolve) => {
        observed = resolve;
      });
      const continueRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(db, "getActiveClubSubscription").mockImplementation(
        async (id, reader) => {
          const paid = await actual(id, reader);
          if (id === actorId) {
            observed();
            await continueRead;
          }
          return paid;
        },
      );
      const response = client(actorId).club.subscription.query();
      // Attach a rejection handler immediately; finally always releases the read.
      const settled = response.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      try {
        await readStarted;
        mode = "success";
        await processCancellations(
          (await db.getDb())!,
          cancelProdamusSubscription,
          actorId,
        );
      } finally {
        release();
      }
      const result = await settled;
      expect(result).toMatchObject({
        value: {
          cancellationStatus: expect.stringMatching(/^(pending|confirmed)$/),
        },
      });
    });
  },
);
