import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import { processCancellations } from "../apps/backend/src/billing/cancellation";

/** Проверяет актуальное владение lease письма и отмены непосредственно перед внешним эффектом. */
describe.skipIf(!testDatabaseUrl)(
  "worker lease ownership before external effects",
  () => {
    let conn: Connection, pool: mysql.Pool;
    let owns = false;
    const id = 99631;
    /** Проверяет свободный ID, создаёт собственного адресата и отдельный пул на четыре соединения. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      const [occupied] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id=?",
        [id],
      );
      if (occupied.length) throw new Error("Lease fixture already occupied");
      await conn.query(
        "INSERT INTO users(id,openId,email,passwordHash) VALUES (?,'lease-guard-fixture','lease-guard@example.test','fixture-hash')",
        [id],
      );
      owns = true;
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 4,
      });
      vi.stubEnv("PUBLIC_APP_URL", "https://fixture.example.test");
    });
    /** Восстанавливает по одной готовой записи email-outbox и отмены billing-профиля. */
    beforeEach(async () => {
      await conn.query("DELETE FROM access_email_outbox WHERE userId=?", [id]);
      await conn.query("DELETE FROM billing_profiles WHERE userId=?", [id]);
      await conn.query(
        "INSERT INTO access_email_outbox(eventKey,userId,email,kind,payload) VALUES ('stale-lease-mail',?,'lease-guard@example.test','club-access',JSON_OBJECT())",
        [id],
      );
      await conn.query(
        "INSERT INTO billing_profiles(profileKey,userId,domain,subscriptionId,profileId,email,amountMinor,cancelRequestedAt,nextAttemptAt) VALUES ('stale-lease-profile',?,'fixture.payform.ru','123','456','lease-guard@example.test',79000,NOW(),NOW())",
        [id],
      );
    });
    /** Закрывает пул и только при успешном владении fixture удаляет собственные строки и пользователя. */
    afterAll(async () => {
      await pool?.end();
      if (owns) {
        await conn.query("DELETE FROM access_email_outbox WHERE userId=?", [
          id,
        ]);
        await conn.query("DELETE FROM billing_profiles WHERE userId=?", [id]);
        await conn.query(
          "DELETE FROM users WHERE id=? AND openId='lease-guard-fixture'",
          [id],
        );
      }
      await conn?.end();
      vi.unstubAllEnvs();
    });

    /** Переназначенный другому worker lease запрещает отправку и последующее изменение записи. */
    it.each(["mail", "cancellation"] as const)(
      "does not perform %s after another worker takes its lease",
      async (kind) => {
        await check(kind, "reassigned");
      },
    );
    /** Просроченный lease запрещает внешний эффект и не меняет чужое новое расписание. */
    it.each(["mail", "cancellation"] as const)(
      "does not perform %s with an expired lease",
      async (kind) => {
        await check(kind, "expired");
      },
    );
    /** Разрешает claim, затем блокирует чтение пользователя и меняет lease до финальной проверки внешней отправки. */
    async function check(
      kind: "mail" | "cancellation",
      change: "reassigned" | "expired",
    ) {
      const table =
        kind === "mail" ? "access_email_outbox" : "billing_profiles";
      const control = await mysql.createConnection({
        uri: testDatabaseUrl!,
        timezone: "Z",
      });
      let calls = 0,
        pending: Promise<void> | undefined;
      try {
        // Real MySQL barrier: allow the claim transaction, then hold the subsequent
        // user read. No mocked business/SQL results and no arbitrary sleeps.
        await control.query("LOCK TABLES users WRITE");
        const database = drizzle(pool);
        /** Считает попытки внешнего эффекта без SMTP или платёжного провайдера. */
        const send = async () => {
          calls++;
          return true;
        };
        pending =
          kind === "mail"
            ? processAccessEmails(database, send, id)
            : processCancellations(database, send, id);
        await expect
          .poll(
            async () => {
              const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT leaseId FROM ${table} WHERE userId=?`,
                [id],
              );
              return Boolean(rows[0]?.leaseId);
            },
            { timeout: 3000, interval: 20 },
          )
          .toBe(true);
        await conn.query(
          `UPDATE ${table} SET leaseId=${change === "reassigned" ? "'replacement-worker'" : "leaseId"},leaseUntil=${change === "expired" ? "DATE_SUB(NOW(),INTERVAL 1 MINUTE)" : "DATE_ADD(NOW(),INTERVAL 5 MINUTE)"},nextAttemptAt=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE userId=?`,
          [id],
        );
        const [before] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM ${table} WHERE userId=?`,
          [id],
        );
        await control.query("UNLOCK TABLES");
        await pending;
        const [after] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM ${table} WHERE userId=?`,
          [id],
        );
        expect(calls).toBe(0);
        expect(after).toEqual(before);
      } finally {
        await control.query("UNLOCK TABLES");
        await pending?.catch(() => {});
        await control.end();
      }
    }
  },
);
