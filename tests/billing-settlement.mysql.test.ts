import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { fulfillPaidOrder } from "../apps/backend/src/prodamus";

/** Проверяет атомарное подтверждение платежей, доступ, контактный номер и очередь писем на одноразовой MySQL. */
describe.skipIf(!testDatabaseUrl)(
  "billing settlement on disposable MySQL",
  () => {
    let conn: Connection;
    /** Создаёт тестового пользователя, ключ шифрования ссылок и фиксированное время для точного срока подписки. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
      await conn.query(
        "INSERT IGNORE INTO users (id,openId,email) VALUES (777,'billing-test','member@example.test')",
      );
    });
    /** Очищает платежное состояние пользователя и создаёт два независимых неоплаченных заказа. */
    beforeEach(async () => {
      await conn.query("DELETE FROM billing_receipts WHERE userId=777");
      await conn.query("DELETE FROM billing_profiles WHERE userId=777");
      await conn.query("DELETE FROM password_tokens WHERE userId=777");
      await conn.query("DELETE FROM access_email_outbox WHERE userId=777");
      await conn.query("DELETE FROM club_payments WHERE userId=777");
      await conn.query(
        "UPDATE users SET contactPhone=NULL,phone=NULL,blockedAt=NULL,accountDeletionRequestedAt=NULL WHERE id=777",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,email,sum) VALUES (777,'club-777-a','member@example.test','790'),(777,'club-777-b','member@example.test','790')",
      );
    });
    /** Возвращает настоящие часы, удаляет собственные платежи и пользователя, затем закрывает драйвер и окружение. */
    afterAll(async () => {
      vi.useRealTimers();
      if (conn) {
        for (const table of ["billing_receipts", "billing_profiles", "password_tokens", "access_email_outbox", "club_payments"])
          await conn.query(`DELETE FROM ${table} WHERE userId=777`);
        await conn.query("DELETE FROM users WHERE id=777 AND openId='billing-test'");
      }
      await conn?.end();
      const database = await getDb();
      // The application owns this connection; tests close its actual driver, not a test-only production method.
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Читает максимальное окончание только оплаченных периодов тестового пользователя. */
    async function latestExpiry() {
      const [rows] = await conn.query<mysqlRows>(
        "SELECT MAX(expiresAt) AS expiry FROM club_payments WHERE userId=777 AND status='paid'",
      );
      return rows[0].expiry?.toISOString();
    }
    /** Строит синтетическое доказательство провайдера с отдельным paymentId и неизменной идентичностью магазина. */
    const proof = (paymentId: string) => ({
      paymentId,
      domain: "daryadarcy-club.payform.ru",
      email: "member@example.test",
      currency: "rub",
    });
    /** Подтверждает выбранный тестовый заказ согласованной суммой и доказательством провайдера. */
    const pay = (orderId: string) =>
      fulfillPaidOrder(orderId, {
        email: "member@example.test",
        sum: "790",
        userId: 777,
        proof: proof(orderId),
      });
    /** Читает отдельно контактный номер и поле телефонной идентичности, чтобы исключить смешение назначения. */
    async function contact() {
      const [rows] = await conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT contactPhone,phone FROM users WHERE id=777",
      );
      return rows[0];
    }
    /** Пустой contactPhone заполняется номером заказа только после подтверждения, поле phone не меняется. */
    it.each([null, "", "   "])(
      "fills an empty existing contact only after settlement (%j)",
      async (empty) => {
        await conn.query("UPDATE users SET contactPhone=? WHERE id=777", [
          empty,
        ]);
        await conn.query(
          "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
        );
        expect((await contact()).contactPhone).toBe(empty);
        expect(await pay("club-777-a")).toBe("club");
        expect(await contact()).toEqual({
          contactPhone: "+79991234567",
          phone: null,
        });
      },
    );
    /** Подтверждение не перезаписывает уже сохранённый контакт и остальные поля аккаунта. */
    it("preserves an established contact and all identity fields after payment", async () => {
      await conn.query(
        "UPDATE users SET contactPhone='+447700900123' WHERE id=777",
      );
      await conn.query(
        "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
      );
      const [before] = await conn.query("SELECT * FROM users WHERE id=777");
      expect(await pay("club-777-a")).toBe("club");
      const [after] = await conn.query("SELECT * FROM users WHERE id=777");
      expect(after).toEqual(before);
    });
    /** Legacy-заказ без корректного номера оплачивается без выдуманного контакта пользователя. */
    it.each([null, "", "not-a-phone"])(
      "settles a legacy order without inventing a contact (%j)",
      async (saved) => {
        await conn.query(
          "UPDATE club_payments SET contactPhone=? WHERE orderId='club-777-a'",
          [saved],
        );
        expect(await pay("club-777-a")).toBe("club");
        expect(await contact()).toEqual({ contactPhone: null, phone: null });
      },
    );
    /** Несовпадение суммы, email, статуса или блокировка запрещают подтверждение и перенос номера. */
    it.each([
      "UPDATE club_payments SET sum='1' WHERE orderId='club-777-a'",
      "UPDATE club_payments SET email='other@example.test' WHERE orderId='club-777-a'",
      "UPDATE club_payments SET status='failed' WHERE orderId='club-777-a'",
      "UPDATE users SET blockedAt=CURRENT_TIMESTAMP WHERE id=777",
    ])(
      "does not copy contact from a rejected payment (%s)",
      async (mutation) => {
        await conn.query(
          "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
        );
        await conn.query(mutation);
        expect(await pay("club-777-a")).toBeNull();
        expect((await contact()).contactPhone).toBeNull();
      },
    );
    /** Позднее подтверждение платежа не возвращает удаляемому аккаунту очищенный контакт. */
    it("does not restore contact while account deletion is requested", async () => {
      await conn.query(
        "UPDATE users SET accountDeletionRequestedAt=CURRENT_TIMESTAMP WHERE id=777",
      );
      await conn.query(
        "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
      );
      expect(await pay("club-777-a")).toBe("club");
      expect((await contact()).contactPhone).toBeNull();
    });
    /** Поздний первый платёж удаляемого аккаунта создаёт запрос отмены нового профиля, сохраняя подтверждённый период. */
    it("queues cancellation for a new billing profile from a late payment", async () => {
      await conn.query("UPDATE users SET accountDeletionRequestedAt=NOW() WHERE id=777");
      expect(await fulfillPaidOrder("club-777-a", {
        sum: "790",
        proof: { ...proof("late-first-payment"), subscriptionId: "123", profileId: "456" },
      })).toBe("club");
      const [[profile]] = await conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=777",
      );
      expect(profile).toEqual({ cancelRequestedAt: expect.any(Date), cancelledAt: null });
      expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
    });
    /** Два конкурентных платежа заполняют пустой номер единожды и сохраняют оба оплаченных периода. */
    it("concurrent payments fill once without replacing the first committed contact", async () => {
      await conn.query(
        "UPDATE club_payments SET contactPhone=IF(orderId='club-777-a','+79991234567','+447700900123') WHERE userId=777",
      );
      await Promise.all([pay("club-777-a"), pay("club-777-b")]);
      expect(["+79991234567", "+447700900123"]).toContain(
        (await contact()).contactPhone,
      );
      const first = await contact();
      await Promise.all([pay("club-777-a"), pay("club-777-b")]);
      expect(await contact()).toEqual(first);
      expect(await latestExpiry()).toBe("2026-12-01T00:00:00.000Z");
    });
    /** Повтор уже принятого receipt не восстанавливает номер, который пользователь позднее очистил. */
    it("does not repopulate a deliberately cleared contact on receipt replay", async () => {
      await conn.query(
        "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
      );
      expect(await pay("club-777-a")).toBe("club");
      expect((await contact()).contactPhone).toBe("+79991234567");
      await conn.query("UPDATE users SET contactPhone=NULL WHERE id=777");
      expect(await pay("club-777-a")).toBe("club");
      expect((await contact()).contactPhone).toBeNull();
    });
    /** Последовательные повторы одного платежа выдают ровно один оплаченный период. */
    it("sequential replay extends access only once", async () => {
      await pay("club-777-a");
      await pay("club-777-a");
      expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
    });
    /** Конкурентные разные платежи последовательно продлевают доступ без потери одного периода. */
    it("concurrent distinct payments do not lose a paid period", async () => {
      await Promise.all([pay("club-777-a"), pay("club-777-b")]);
      expect(await latestExpiry()).toBe("2026-12-01T00:00:00.000Z");
    });
    /** Двенадцать одновременных callbacks одного заказа не умножают оплаченный доступ. */
    it("concurrent replays grant one period", async () => {
      await Promise.all(Array.from({ length: 12 }, () => pay("club-777-a")));
      expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
    });
    /** Конкурентные подтверждения создают одну запись outbox письма, а не несколько отправок. */
    it("settlement atomically queues exactly one access email", async () => {
      await Promise.all([pay("club-777-a"), pay("club-777-a")]);
      const [rows] = await conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM access_email_outbox WHERE userId=777",
      );
      expect(rows[0].n).toBe(1);
    });
    /** Доказательство провайдера не разрешает подтвердить заказ с суммой, отличающейся от сохранённой. */
    it("a valid signature cannot bypass the saved checkout amount", async () => {
      expect(
        await fulfillPaidOrder("club-777-a", {
          email: "member@example.test",
          sum: "0.01",
          userId: 777,
          proof: proof("a"),
        }),
      ).toBeNull();
      expect(await latestExpiry()).toBeUndefined();
    });
    /** Отсутствие ключа шифрования письма откатывает подтверждение платежа и перенос контактного номера. */
    it("missing link encryption configuration rolls back the payment", async () => {
      await conn.query(
        "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-777-a'",
      );
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      await expect(pay("club-777-a")).rejects.toThrow();
      expect(await latestExpiry()).toBeUndefined();
      expect((await contact()).contactPhone).toBeNull();
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
    });
    /** Один receipt провайдера нельзя привязать ко второму заказу и повторно продлить доступ. */
    it("a provider payment ID cannot pay two different orders", async () => {
      const p = proof("same-provider-payment");
      expect(
        await fulfillPaidOrder("club-777-a", { sum: "790", proof: p }),
      ).toBe("club");
      expect(
        await fulfillPaidOrder("club-777-b", { sum: "790", proof: p }),
      ).toBeNull();
      expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
    });
    /** Для рекуррентного списания недостаточно email или userId без уже проверенного billing-профиля. */
    it("unknown recurring profiles never grant access by email or userId", async () => {
      expect(
        await fulfillPaidOrder("club-renew", {
          sum: "790",
          userId: 777,
          proof: {
            ...proof("renew-1"),
            subscriptionId: "123",
            profileId: "456",
          },
          recurring: true,
        }),
      ).toBeNull();
      expect(await latestExpiry()).toBeUndefined();
    });
    /** Пришедшее продление не превращает pending-запрос отмены в подтверждённую отмену периода. */
    it("an in-flight renewal must not turn a pending cancellation into a confirmed one", async () => {
      const p = {
        ...proof("initial"),
        subscriptionId: "123",
        profileId: "456",
      };
      await fulfillPaidOrder("club-777-a", { sum: "790", proof: p });
      await conn.query(
        "UPDATE billing_profiles SET cancelRequestedAt=NOW() WHERE userId=777",
      );
      await fulfillPaidOrder("club-renew", {
        sum: "790",
        proof: { ...p, paymentId: "renew-pending-cancel" },
        recurring: true,
      });
      const [rows] = await conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT cancelAtPeriodEnd FROM club_payments WHERE userId=777 ORDER BY expiresAt DESC LIMIT 1",
      );
      expect(rows[0].cancelAtPeriodEnd).toBe(0);
    });
    /** Проверенный профиль принимает новое списание единожды даже при десяти callbacks и хранит два receipt. */
    it("verified recurring profiles grant each real charge once, including concurrent callbacks", async () => {
      const p = {
        ...proof("initial"),
        subscriptionId: "123",
        profileId: "456",
      };
      await fulfillPaidOrder("club-777-a", { sum: "790", proof: p });
      await Promise.all(
        Array.from({ length: 10 }, () =>
          fulfillPaidOrder("club-renew", {
            sum: "790",
            proof: { ...p, paymentId: "renew-1" },
            recurring: true,
          }),
        ),
      );
      expect(await latestExpiry()).toBe("2026-12-01T00:00:00.000Z");
      const [rows] = await conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM billing_receipts WHERE userId=777",
      );
      expect(rows[0].n).toBe(2);
    });
  },
);
type mysqlRows = (import("mysql2").RowDataPacket & { expiry: Date | null })[];
