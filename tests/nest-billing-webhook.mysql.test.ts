import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";

const secret = "native-billing-synthetic-club-key";
const encryptionKey = Buffer.alloc(32, 11).toString("base64");
const payment = {
  currency: "rub",
  customer_email: "native-billing@example.invalid",
  domain: "native-billing.payform.ru",
  order_id: "94301001",
  order_num: "club-94301-native-fixture",
  payment_status: "success",
  subscription: { id: "99", profile_id: "144" },
  sum: "790.00",
};
const canonical =
  '{"currency":"rub","customer_email":"native-billing@example.invalid","domain":"native-billing.payform.ru","order_id":"94301001","order_num":"club-94301-native-fixture","payment_status":"success","subscription":{"id":"99","profile_id":"144"},"sum":"790.00"}';

/** Проверяет подписанные HTTP-уведомления первоначальной оплаты, продления и отмены на отдельной SQL-базе. */
describe.skipIf(!testDatabaseUrl)(
  "signed native Prodamus ingress through disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const cancellationTrigger = "native_billing_cancel_failure";
    /** Настраивает синтетические ключи разных назначений и фиксированное время; запускает локальный API без фоновых отправителей. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("PRODAMUS_SECRET", secret);
      vi.stubEnv("PRODAMUS_SHOP_SECRET", "native-billing-synthetic-shop-key");
      vi.stubEnv(
        "PRODAMUS_SUBSCRIPTION_SECRET",
        "native-billing-synthetic-renewal-key",
      );
      vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://native-billing.payform.ru");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "99");
      vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
      app = await createBackendApplication();
      // Factory/listener deliberately does not activate mail or payment workers.
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Удаляет платежи, профили, квитанции и письма только двух собственных пользователей. */
    async function clearFixture() {
      for (const table of [
        "billing_receipts",
        "billing_profiles",
        "password_tokens",
        "access_email_outbox",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId IN (94301,94302)`);
      await conn.query("DELETE FROM users WHERE id IN (94301,94302)");
    }
    /** Возвращает ключ шифрования и создаёт исходный ожидающий заказ и соседний аккаунт. */
    beforeEach(async () => {
      await conn.query(`DROP TRIGGER IF EXISTS ${cancellationTrigger}`);
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", encryptionKey);
      await clearFixture();
      await conn.query(
        "INSERT INTO users (id,openId,email) VALUES (94301,'native-billing-fixture','native-billing@example.invalid'),(94302,'native-billing-other-fixture','other-owner@example.invalid')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,email,sum) VALUES (94301,'club-94301-native-fixture','native-billing@example.invalid','790')",
      );
    });
    /** Удаляет собственный отказной триггер и данные, закрывает приложение и SQL-пул и возвращает время. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await conn.query(`DROP TRIGGER IF EXISTS ${cancellationTrigger}`);
        await clearFixture();
      }
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
    /** Читает сроки заказов и количество durable-эффектов для проверки однократного settlement. */
    async function state() {
      const [orders] = await conn.query<RowDataPacket[]>(
        "SELECT orderId,status,expiresAt FROM club_payments WHERE userId=94301 ORDER BY orderId",
      );
      const [effects] = await conn.query<RowDataPacket[]>(`SELECT
      (SELECT COUNT(*) FROM billing_receipts WHERE userId=94301) receipts,
      (SELECT COUNT(*) FROM billing_profiles WHERE userId=94301) profiles,
      (SELECT COUNT(*) FROM access_email_outbox WHERE userId=94301) mails,
      (SELECT COUNT(*) FROM password_tokens WHERE userId=94301) tokens`);
      return { orders, effects };
    }
    /** Читает полные строки обоих пользователей и связанных таблиц, чтобы обнаружить не только добавления, но и скрытые изменения. */
    async function guardedState() {
      // Complete durable rows catch silent edits as well as extra entitlements.
      const tables = [
        ["users", "id", "id"],
        ["club_payments", "userId", "id"],
        ["billing_receipts", "userId", "paymentKey"],
        ["billing_profiles", "userId", "profileKey"],
        ["access_email_outbox", "userId", "id"],
        ["password_tokens", "userId", "id"],
      ] as const;
      const result: Record<string, RowDataPacket[]> = {};
      for (const [table, owner, order] of tables) {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT * FROM ${table} WHERE ${owner} IN (94301,94302) ORDER BY ${order}`,
        );
        result[table] = rows;
      }
      return result;
    }
    /** Подписывает уведомление независимой канонической фикстурой и отправляет его настоящим HTTP. */
    function notify(
      changes: Record<string, unknown> = {},
      key = secret,
      unsigned = false,
    ) {
      const body = { ...payment, ...changes };
      // Independent literal canonical base; all changed scalar keys are already
      // strings. Nested subscription stays the hand-ordered fixture above.
      const signedBytes = Object.keys(changes).length
        ? JSON.stringify(
            Object.fromEntries(
              Object.entries(body).sort(([a], [b]) =>
                a < b ? -1 : a > b ? 1 : 0,
              ),
            ),
          )
        : canonical;
      return fetch(`${base}/api/prodamus/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(unsigned
            ? {}
            : {
                Sign: createHmac("sha256", key)
                  .update(signedBytes)
                  .digest("hex"),
              }),
        },
        body: JSON.stringify(body),
      });
    }
    /** Проверяет один оплаченный период, письмо и контакт в пустой карточке при последовательных и конкурентных повторах webhook. */
    it("grants one paid period and one durable access mail across sequential and concurrent HTTP replays", async () => {
      await conn.query(
        "UPDATE club_payments SET contactPhone='+79991234567' WHERE orderId='club-94301-native-fixture'",
      );
      const first = await notify();
      expect(first.status).toBe(200);
      expect(await first.text()).toBe("success");
      expect(first.headers.get("set-cookie")).toBeNull();
      const replay = await notify();
      expect(replay.status).toBe(200);
      expect(await replay.text()).toBe("success");
      const replies = await Promise.all(
        Array.from({ length: 6 }, () => notify()),
      );
      for (const reply of replies) {
        expect(reply.status).toBe(200);
        expect(await reply.text()).toBe("success");
      }
      expect(await state()).toEqual({
        orders: [
          {
            orderId: "club-94301-native-fixture",
            status: "paid",
            expiresAt: new Date("2026-11-08T00:00:00Z"),
          },
        ],
        effects: [{ receipts: 1, profiles: 1, mails: 1, tokens: 1 }],
      });
      const [contacts] = await conn.query<RowDataPacket[]>(
        "SELECT id,contactPhone,phone FROM users WHERE id IN (94301,94302) ORDER BY id",
      );
      expect(contacts).toEqual([
        { id: 94301, contactPhone: "+79991234567", phone: null },
        { id: 94302, contactPhone: null, phone: null },
      ]);
    });
    /** Проверяет отказ неверной привязки продавца, суммы, адресата, заказа или ключа без durable-эффектов. */
    it.each([
      {
        name: "merchant",
        changes: { domain: "other.payform.ru" },
        key: secret,
      },
      { name: "saved amount", changes: { sum: "0.01" }, key: secret },
      {
        name: "recipient",
        changes: { customer_email: "other@example.invalid" },
        key: secret,
      },
      {
        name: "saved order",
        changes: { order_num: "club-94301-unknown" },
        key: secret,
      },
      {
        name: "selected club key",
        changes: {},
        key: "native-billing-synthetic-shop-key",
      },
    ])(
      "rejects wrong $name without granting or queuing anything",
      async ({ changes, key }) => {
        const before = await state();
        const reply = await notify(changes, key);
        expect(reply.status).toBe(422);
        expect(await reply.text()).toBe("payment binding invalid");
        expect(await state()).toEqual(before);
      },
    );
    /** Проверяет отклонение неподписанного уведомления до любых изменений базы. */
    it("rejects unsigned ingress without durable effects", async () => {
      const before = await state();
      expect((await notify({}, secret, true)).status).toBe(400);
      expect(await state()).toEqual(before);
    });
    /** Проверяет границу TEST и LIVE: demo-уведомление с обычным ключом не выдаёт доступ. */
    it("rejects an ordinary-key signed demo before granting actual SQL access", async () => {
      const before = await state();
      const reply = await notify({ demo_mode: "1" });
      expect(await state()).toEqual(before);
      expect(reply.status).toBe(400);
      expect(await reply.text()).toBe("demo payment not accepted");
    });
    /** Проверяет полный откат settlement при невозможности создать зашифрованную ссылку и безопасный повтор после исправления конфигурации. */
    it("rolls back settlement on mail-link failure and accepts a clean HTTP retry", async () => {
      const before = await state();
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      const failed = await notify();
      expect(failed.status).toBe(500);
      expect(await failed.text()).toBe("error");
      expect(await state()).toEqual(before);
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", encryptionKey);
      expect((await notify()).status).toBe(200);
      expect(await state()).toEqual({
        orders: [
          {
            orderId: "club-94301-native-fixture",
            status: "paid",
            expiresAt: new Date("2026-11-08T00:00:00Z"),
          },
        ],
        effects: [{ receipts: 1, profiles: 1, mails: 1, tokens: 1 }],
      });
    });
    /** Проверяет отказ первоначальной оплаты заблокированному получателю и повтор после разблокировки без дублей. */
    it("refuses a blocked initial recipient without durable changes and accepts retry after unblock", async () => {
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=94301");
      const before = await guardedState();
      const refused = await notify();
      expect(refused.status).toBe(422);
      expect(await refused.text()).toBe("payment binding invalid");
      expect(refused.headers.get("set-cookie")).toBeNull();
      expect(await guardedState()).toEqual(before);

      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=94301");
      expect((await notify()).status).toBe(200);
      const accepted = await state();
      expect(accepted.orders).toEqual([
        {
          orderId: "club-94301-native-fixture",
          status: "paid",
          expiresAt: new Date("2026-11-08T00:00:00Z"),
        },
      ]);
      expect(accepted.effects).toEqual([
        { receipts: 1, profiles: 1, mails: 1, tokens: 1 },
      ]);
      const settled = await guardedState();
      expect((await notify()).status).toBe(200);
      expect(await guardedState()).toEqual(settled);
    });
    /** Проверяет отказ продления заблокированному получателю без изменения платёжной истории и последующий допустимый повтор. */
    it("refuses a blocked renewal without changing paid history and accepts retry after unblock", async () => {
      expect((await notify()).status).toBe(200);
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=94301");
      const before = await guardedState();
      const refused = await renewalNotification();
      expect(refused.status).toBe(422);
      expect(await refused.text()).toBe("payment binding invalid");
      expect(refused.headers.get("set-cookie")).toBeNull();
      expect(await guardedState()).toEqual(before);

      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=94301");
      expect((await renewalNotification()).status).toBe(200);
      const accepted = await state();
      expect(accepted.orders.map((order) => order.expiresAt)).toEqual([
        new Date("2026-11-08T00:00:00Z"),
        new Date("2026-12-08T00:00:00Z"),
      ]);
      expect(accepted.effects).toEqual([
        { receipts: 2, profiles: 1, mails: 2, tokens: 2 },
      ]);
      const settled = await guardedState();
      expect((await renewalNotification()).status).toBe(200);
      expect(await guardedState()).toEqual(settled);
    });
    /** Проверяет актуальную блокировку получателя даже перед подтверждением повтора уже записанной квитанции. */
    it("refuses a blocked recipient before acknowledging an existing receipt replay", async () => {
      expect((await notify()).status).toBe(200);
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=94301");
      const before = await guardedState();
      const refused = await notify();
      expect(refused.status).toBe(422);
      expect(await refused.text()).toBe("payment binding invalid");
      expect(refused.headers.get("set-cookie")).toBeNull();
      expect(await guardedState()).toEqual(before);

      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=94301");
      const unblocked = await guardedState();
      expect((await notify()).status).toBe(200);
      expect(await guardedState()).toEqual(unblocked);
    });
    /** Проверяет невозможность присвоить сохранённый recurring-профиль с другим владельцем, адресом или суммой. */
    it.each([
      {
        name: "owner",
        userId: 94302,
        email: "native-billing@example.invalid",
        amount: 79000,
      },
      {
        name: "recipient",
        userId: 94301,
        email: "other@example.invalid",
        amount: 79000,
      },
      {
        name: "amount",
        userId: 94301,
        email: "native-billing@example.invalid",
        amount: 1,
      },
    ])(
      "refuses an initial charge claiming a saved profile with another $name",
      async ({ userId, email, amount }) => {
        // Literal SHA-256 of ["native-billing.payform.ru","99","144"],
        // independent of the production profileKey helper.
        await conn.query(
          "INSERT INTO billing_profiles (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES (?,?,?,?,?,?,?)",
          [
            "3934882d7a96dfa90eb8b17065cef8371c98a90ff58a670d06d5d6e9833ae79d",
            userId,
            "native-billing.payform.ru",
            "99",
            "144",
            email,
            amount,
          ],
        );
        const before = await guardedState();
        const refused = await notify();
        expect(refused.status).toBe(422);
        expect(await refused.text()).toBe("payment binding invalid");
        expect(refused.headers.get("set-cookie")).toBeNull();
        expect(await guardedState()).toEqual(before);
      },
    );
    /** Формирует независимо подписанное уведомление автопродления с отдельным recurring-ключом. */
    function renewalNotification(
      profileId = "144",
      key = "native-billing-synthetic-renewal-key",
    ) {
      // Literal ordered strings, independent of production signing and parsing.
      const bytes = JSON.stringify({
        currency: "rub",
        customer_email: "native-billing@example.invalid",
        domain: "native-billing.payform.ru",
        order_id: "94301002",
        payment_status: "success",
        subscription: {
          action_code: "auto_payment",
          id: "99",
          profile_id: profileId,
        },
        sum: "790.00",
      });
      return fetch(`${base}/api/prodamus/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", key).update(bytes).digest("hex"),
        },
        body: bytes,
      });
    }
    /** Проверяет один период продления при конкурирующих уведомлениях и более позднем повторе. */
    it("grants one renewal period across concurrent and later signed HTTP replays", async () => {
      expect((await notify()).status).toBe(200);
      const replies = await Promise.all(
        Array.from({ length: 6 }, () => renewalNotification()),
      );
      for (const reply of replies) {
        expect(reply.status).toBe(200);
        expect(await reply.text()).toBe("success");
        expect(reply.headers.get("set-cookie")).toBeNull();
      }
      const renewed = await state();
      expect(renewed.orders).toHaveLength(2);
      expect(renewed.orders[0]).toEqual({
        orderId: "club-94301-native-fixture",
        status: "paid",
        expiresAt: new Date("2026-11-08T00:00:00Z"),
      });
      expect(renewed.orders[1]).toMatchObject({
        status: "paid",
        expiresAt: new Date("2026-12-08T00:00:00Z"),
      });
      expect(renewed.orders[1].orderId).toMatch(/^club-renew-/);
      expect(renewed.effects).toEqual([
        { receipts: 2, profiles: 1, mails: 2, tokens: 2 },
      ]);
      vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
      try {
        const replay = await renewalNotification();
        expect(replay.status).toBe(200);
        expect(await replay.text()).toBe("success");
        expect(await state()).toEqual(renewed);
      } finally {
        vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
      }
    });
    /** Проверяет отказ продления неизвестного профиля либо уведомления с ключом первоначальной оплаты. */
    it.each([
      {
        name: "unknown durable profile",
        profileId: "145",
        key: "native-billing-synthetic-renewal-key",
      },
      { name: "initial-payment key", profileId: "144", key: secret },
    ])(
      "refuses renewal with $name without extending access",
      async ({ profileId, key }) => {
        expect((await notify()).status).toBe(200);
        const before = await cancellationState();
        const reply = await renewalNotification(profileId, key);
        expect(reply.status).toBe(422);
        expect(await reply.text()).toBe("payment binding invalid");
        expect(await cancellationState()).toEqual(before);
      },
    );
    /** Проверяет откат продления при отказе ссылки доступа и сохранение возможности чистого повтора. */
    it("rolls back a renewal when its access-link write fails and accepts a clean HTTP retry", async () => {
      expect((await notify()).status).toBe(200);
      const before = await cancellationState();
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      const failed = await renewalNotification();
      expect(failed.status).toBe(500);
      expect(await failed.text()).toBe("error");
      expect(await cancellationState()).toEqual(before);
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", encryptionKey);
      const recovered = await renewalNotification();
      expect(recovered.status).toBe(200);
      expect(await recovered.text()).toBe("success");
      const renewed = await state();
      expect(renewed.orders).toHaveLength(2);
      expect(renewed.orders[1]).toMatchObject({
        status: "paid",
        expiresAt: new Date("2026-12-08T00:00:00Z"),
      });
      expect(renewed.effects).toEqual([
        { receipts: 2, profiles: 1, mails: 2, tokens: 2 },
      ]);
    });
    /** Читает профили отмены и оплаченные периоды вместе с durable-эффектами. */
    async function cancellationState() {
      const [profiles] = await conn.query<RowDataPacket[]>(
        "SELECT domain,subscriptionId,profileId,cancelRequestedAt,cancelledAt,leaseId,leaseUntil FROM billing_profiles WHERE userId=94301 ORDER BY profileKey",
      );
      const [orders] = await conn.query<RowDataPacket[]>(
        "SELECT orderId,status,expiresAt,cancelAtPeriodEnd,cancelledAt FROM club_payments WHERE userId=94301 ORDER BY orderId",
      );
      return { profiles, orders, effects: (await state()).effects };
    }
    /** Формирует независимо подписанное уведомление деактивации recurring-профиля. */
    function cancelNotification(
      profileId = "144",
      key = "native-billing-synthetic-renewal-key",
    ) {
      // Literal ordered strings are independent of the production signer/parser.
      const bytes = JSON.stringify({
        domain: "native-billing.payform.ru",
        subscription: {
          action_code: "deactivation",
          id: "99",
          profile_id: profileId,
        },
      });
      return fetch(`${base}/api/prodamus/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", key).update(bytes).digest("hex"),
        },
        body: bytes,
      });
    }
    /** Проверяет SQL-подтверждение отмены, снятие lease, сохранение оплаченного срока и безопасные повторы уведомления. */
    it("acknowledges cancellation only after SQL confirmation, preserves expiry and safely acknowledges replays", async () => {
      expect((await notify()).status).toBe(200);
      // A synthetic outstanding worker lease must not survive confirmation.
      await conn.query(
        "UPDATE billing_profiles SET leaseId=?,leaseUntil=? WHERE userId=?",
        [
          "native-cancel-fixture-lease",
          new Date("2026-10-09T00:01:00Z"),
          94301,
        ],
      );
      expect((await cancellationState()).profiles[0]).toMatchObject({
        leaseId: "native-cancel-fixture-lease",
        leaseUntil: new Date("2026-10-09T00:01:00Z"),
      });
      const reply = await cancelNotification();
      expect(reply.status).toBe(200);
      expect(await reply.text()).toBe("cancelled");
      expect(reply.headers.get("set-cookie")).toBeNull();
      const confirmed = await cancellationState();
      expect(confirmed).toEqual({
        profiles: [
          {
            domain: "native-billing.payform.ru",
            subscriptionId: "99",
            profileId: "144",
            cancelRequestedAt: new Date("2026-10-09T00:00:00Z"),
            cancelledAt: new Date("2026-10-09T00:00:00Z"),
            leaseId: null,
            leaseUntil: null,
          },
        ],
        orders: [
          {
            orderId: "club-94301-native-fixture",
            status: "paid",
            expiresAt: new Date("2026-11-08T00:00:00Z"),
            cancelAtPeriodEnd: 1,
            cancelledAt: new Date("2026-10-09T00:00:00Z"),
          },
        ],
        effects: [{ receipts: 1, profiles: 1, mails: 1, tokens: 1 }],
      });
      expect((await cancelNotification()).status).toBe(200);
      expect(await cancellationState()).toEqual(confirmed);
    });
    /** Проверяет, что закрытие старого recurring-профиля не отменяет новый не привязанный к нему заказ. */
    it("does not mark a new unbound order cancelled when an older profile closes", async () => {
      expect((await notify()).status).toBe(200);
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,email,sum,status,expiresAt) VALUES (94301,'club-94301-unbound',?,'790','paid','2026-12-08')",
        [payment.customer_email],
      );
      expect((await cancelNotification()).status).toBe(200);
      const [unbound] = await conn.query<RowDataPacket[]>(
        "SELECT cancelAtPeriodEnd FROM club_payments WHERE orderId='club-94301-unbound'",
      );
      expect(unbound).toEqual([{ cancelAtPeriodEnd: 0 }]);
      expect((await cancellationState()).profiles[0].cancelledAt).toBeInstanceOf(Date);
    });
    /** Проверяет отказ отмены неизвестного профиля или неверного назначения подписи без изменения доступа. */
    it.each([
      {
        name: "unrecognized durable profile",
        profileId: "145",
        key: "native-billing-synthetic-renewal-key",
      },
      {
        name: "initial-payment key instead of recurring key",
        profileId: "144",
        key: secret,
      },
    ])(
      "refuses cancellation with $name without changing paid access",
      async ({ profileId, key }) => {
        expect((await notify()).status).toBe(200);
        const before = await cancellationState();
        const reply = await cancelNotification(profileId, key);
        expect(reply.status).toBe(422);
        expect(await reply.text()).toBe("profile binding invalid");
        expect(await cancellationState()).toEqual(before);
      },
    );
    /** Проверяет общий откат подтверждения профиля при отказе обновления заказа и последующий чистый повтор. */
    it("rolls back profile confirmation when paid-order cancellation fails, then accepts a clean HTTP retry", async () => {
      expect((await notify()).status).toBe(200);
      const before = await cancellationState();
      await conn.query(`CREATE TRIGGER ${cancellationTrigger} BEFORE UPDATE ON club_payments FOR EACH ROW
        BEGIN IF NEW.userId=94301 AND NEW.cancelAtPeriodEnd=1 THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic cancellation write failure';
        END IF; END`);
      const failed = await cancelNotification();
      expect(failed.status).toBe(500);
      expect(await failed.text()).toBe("error");
      expect(await cancellationState()).toEqual(before);
      await conn.query(`DROP TRIGGER ${cancellationTrigger}`);
      expect((await cancelNotification()).status).toBe(200);
      const recovered = await cancellationState();
      expect(recovered.profiles[0].cancelledAt).toEqual(
        new Date("2026-10-09T00:00:00Z"),
      );
      expect(recovered.orders[0]).toMatchObject({
        status: "paid",
        expiresAt: new Date("2026-11-08T00:00:00Z"),
        cancelAtPeriodEnd: 1,
      });
      expect(recovered.effects).toEqual(before.effects);
    });
  },
);
