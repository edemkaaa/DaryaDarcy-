import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { YookassaTestClient } from "../apps/backend/src/billing/yookassa/client";
import {
  YookassaIntentRepository,
  type IntentInput,
} from "../apps/backend/src/billing/yookassa/intents";

const key = "12345678-1234-4123-8123-123456789abc";
const order = "yk-club-12345678-1234-4123-8123-123456789abc";
const client = new YookassaTestClient({
  shopId: "123456",
  secretKey: "test_synthetic-not-a-real-secret",
  returnUrl: "https://daryadarcy.dev.reeskeen.ru/club",
});
/** Проверяет durable TEST-intent YooKassa: immutable request, ограниченное повторение и fencing dispatch lease. */
describe.skipIf(!testDatabaseUrl)(
  "durable YooKassa intents on disposable MySQL",
  () => {
    let conn: Connection;
    let database: MySql2Database;
    let pool: mysql.Pool;
    let repo: YookassaIntentRepository;
    /** Строит согласованный synthetic monthly-intent с фиксированными actor, ценой и provider request-body. */
    const input = (): IntentInput => ({
      intentKey: key,
      userId: 90779,
      email: "yoo@example.test",
      shopId: "123456",
      plan: "monthly",
      amountMinor: 79000,
      accessDays: 30,
      request: client.paymentRequest(order, 79000),
    });
    /** Открывает одноразовую БД, отдельный пул и intent-repository для собственного пользователя. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Dedicated fixture identity; 779 belongs to cancellation tests.
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 12,
      });
      database = drizzle({ client: pool });
      repo = new YookassaIntentRepository(database);
      await conn.query(
        "INSERT IGNORE INTO users (id,openId,email) VALUES (90779,'yookassa-test','yoo@example.test')",
      );
    });
    /** Фиксирует часы и очищает intent и заказы только своего участника. */
    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
      await conn.query(
        "DELETE FROM billing_checkout_intents WHERE userId=90779",
      );
      await conn.query("DELETE FROM club_payments WHERE userId=90779");
      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=90779");
    });
    /** Возвращает часы, удаляет собственные данные и закрывает оба соединения. */
    afterAll(async () => {
      vi.useRealTimers();
      if (conn) {
        await conn.query(
          "DELETE FROM billing_checkout_intents WHERE userId=90779",
        );
        await conn.query("DELETE FROM club_payments WHERE userId=90779");
        await conn.query(
          "DELETE FROM users WHERE id=90779 AND openId='yookassa-test'",
        );
      }
      await conn?.end();
      await pool?.end();
    });
    /** Считает только строки пользователя в разрешённой intent/order таблице. */
    async function count(table: "billing_checkout_intents" | "club_payments") {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE userId=90779`,
      );
      return rows[0].n;
    }
    /** Claim коммитит pending-заказ и неизменное provider-тело до внешнего dispatch. */
    it("persists a pending club order and the immutable request before dispatch", async () => {
      const claimed = await repo.claim(input());
      expect(claimed.leaseId).toBeTruthy();
      expect(claimed.intent.providerPaymentId).toBeNull();
      expect(claimed.intent.requestBody).toEqual(input().request);
      expect(claimed.intent.firstSentAt?.toISOString()).toBe(
        "2026-10-07T00:00:00.000Z",
      );
      expect(await count("club_payments")).toBe(1);
    });
    /** Десять конкурентных claim получают один lease и оставляют один intent и заказ. */
    it("concurrent requests win one dispatch lease and create one pending order", async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 10 }, () => repo.claim(input())),
      );
      expect(
        attempts.filter((attempt) => attempt.status === "fulfilled"),
      ).toHaveLength(1);
      expect(await count("billing_checkout_intents")).toBe(1);
      expect(await count("club_payments")).toBe(1);
    });
    /** Изменение тарифа тем же ключом конфликтует вместо повторения чужого намерения. */
    it("rejects payload changes instead of replaying another purchase", async () => {
      const first = await repo.claim(input());
      await repo.markUnknown(first.intent.intentKeyHash, first.leaseId!);
      await expect(
        repo.claim({ ...input(), plan: "semiannual" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await count("club_payments")).toBe(1);
    });
    /** Новый repository после истечения lease восстанавливает исходную цену и тело вопреки изменившейся конфигурации. */
    it("recovers after restart with the original price/body, not new configuration", async () => {
      await repo.claim(input());
      vi.setSystemTime(new Date("2026-10-07T00:02:00Z"));
      const restarted = new YookassaIntentRepository(database);
      const recovered = await restarted.claim({
        ...input(),
        amountMinor: 90000,
        request: client.paymentRequest(order, 90000),
      });
      expect(recovered.intent.amountMinor).toBe(79000);
      expect(recovered.intent.requestBody).toEqual(
        client.paymentRequest(order, 79000),
      );
      expect(recovered.leaseId).toBeTruthy();
      expect(await count("club_payments")).toBe(1);
    });
    /** После безопасного окна неизвестный create не отправляется повторно и сохраняет один pending-заказ. */
    it("refuses to redispatch an unknown create after the safe window", async () => {
      await repo.claim(input());
      vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
      await expect(repo.claim(input())).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
      expect(await count("club_payments")).toBe(1);
    });
    /** Заблокированный пользователь не создаёт ни intent, ни заказ. */
    it("blacklist rejection leaves no intent or order", async () => {
      await conn.query(
        "UPDATE users SET blockedAt=CURRENT_TIMESTAMP WHERE id=90779",
      );
      await expect(repo.claim(input())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(await count("club_payments")).toBe(0);
      expect(await count("billing_checkout_intents")).toBe(0);
    });
    /** Создаёт synthetic проверяемый pending-ответ провайдера с ожидаемыми суммой, shop и order metadata. */
    const paid = () => ({
      id: "2419a771-000f-5000-9000-1edaf29243f2",
      status: "pending" as const,
      paid: false,
      test: true as const,
      amount: { value: "790.00", currency: "RUB" as const },
      recipient: { account_id: "123456" },
      metadata: { order_id: order },
    });
    /** После binding проверенного paymentId дальнейший recovery возвращает его без нового dispatch lease. */
    it("binds a verified create response and later recovers without another dispatch", async () => {
      const first = await repo.claim(input());
      const bound = await repo.bindPayment(first.intent.intentKeyHash, paid());
      expect(bound.providerPaymentId).toBe(
        "2419a771-000f-5000-9000-1edaf29243f2",
      );
      vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
      const recovered = await repo.claim(input());
      expect(recovered.leaseId).toBeNull();
      expect(recovered.intent.providerPaymentId).toBe(bound.providerPaymentId);
    });
    /** Несовпадение order, суммы или shop отклоняет provider-binding без изменения paymentId. */
    it.each([
      { metadata: { order_id: "yk-club-other" } },
      { amount: { value: "0.01", currency: "RUB" as const } },
      { recipient: { account_id: "999" } },
    ])(
      "rejects a mismatched binding without modifying the intent",
      async (replacement) => {
        const first = await repo.claim(input());
        await expect(
          repo.bindPayment(first.intent.intentKeyHash, {
            ...paid(),
            ...replacement,
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT providerPaymentId FROM billing_checkout_intents WHERE userId=90779",
        );
        expect(rows[0].providerPaymentId).toBeNull();
      },
    );
    /** Поздний markUnknown старого lease не очищает lease восстановленной попытки. */
    it("late failure from an old attempt cannot clear a recovered dispatch lease", async () => {
      const first = await repo.claim(input());
      vi.setSystemTime(new Date("2026-10-07T00:02:00Z"));
      const recovered = await repo.claim(input());
      await repo.markUnknown(first.intent.intentKeyHash, first.leaseId!);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT leaseId,state FROM billing_checkout_intents WHERE userId=90779",
      );
      expect(rows[0].leaseId).toBe(recovered.leaseId);
      expect(rows[0].state).toBe("creating");
    });
  },
);
