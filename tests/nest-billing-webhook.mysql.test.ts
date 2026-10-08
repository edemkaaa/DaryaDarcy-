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

describe.skipIf(!testDatabaseUrl)(
  "signed native Prodamus ingress through disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
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
    async function clearFixture() {
      for (const table of [
        "billing_receipts",
        "billing_profiles",
        "password_tokens",
        "access_email_outbox",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId=94301`);
      await conn.query("DELETE FROM users WHERE id=94301");
    }
    beforeEach(async () => {
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", encryptionKey);
      await clearFixture();
      await conn.query(
        "INSERT INTO users (id,openId,email) VALUES (94301,'native-billing-fixture','native-billing@example.invalid')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,email,sum) VALUES (94301,'club-94301-native-fixture','native-billing@example.invalid','790')",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) await clearFixture();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
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
    it("grants one paid period and one durable access mail across sequential and concurrent HTTP replays", async () => {
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
    });
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
    it("rejects unsigned ingress without durable effects", async () => {
      const before = await state();
      expect((await notify({}, secret, true)).status).toBe(400);
      expect(await state()).toEqual(before);
    });
    it("rejects an ordinary-key signed demo before granting actual SQL access", async () => {
      const before = await state();
      const reply = await notify({ demo_mode: "1" });
      expect(await state()).toEqual(before);
      expect(reply.status).toBe(400);
      expect(await reply.text()).toBe("demo payment not accepted");
    });
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
  },
);
