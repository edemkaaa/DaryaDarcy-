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
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { getDb } from "../apps/backend/src/db";

const key = "c".repeat(64); // Synthetic, never a provider credential.
const order = "club-test-94321-83be933e-a277-41f3-801d-45771c12b051";
const email = "test-club@example.invalid";
describe.skipIf(!testDatabaseUrl)(
  "dev-only Prodamus club through native HTTP and SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const client = () =>
      createTRPCProxyClient<AppRouter>({
        links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
      });
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("PRODAMUS_SECRET", "");
      vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 13).toString("base64"),
      );
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    async function cleanup() {
      for (const table of [
        "billing_receipts",
        "billing_profiles",
        "password_tokens",
        "access_email_outbox",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId=94321`);
      await conn.query("DELETE FROM users WHERE id=94321");
    }
    beforeEach(async () => {
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
      vi.stubEnv("PRODAMUS_TEST_PAYFORM_URL", "https://testpage1.payform.ru");
      vi.stubEnv("PRODAMUS_TEST_SECRET", key);
      vi.stubEnv("PRODAMUS_TEST_DEMO_SIGN", "false");
      vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,email) VALUES(94321,'prodamus-test-fixture',?)",
        [email],
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,sum) VALUES(94321,?,?,'790')",
        [order, email],
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) await cleanup();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
    async function state() {
      const [payments] = await conn.query<RowDataPacket[]>(
        "SELECT orderId,status,expiresAt FROM club_payments WHERE userId=94321 ORDER BY orderId",
      );
      const [effects] = await conn.query<RowDataPacket[]>(`SELECT
      (SELECT COUNT(*) FROM billing_receipts WHERE userId=94321) receipts,
      (SELECT COUNT(*) FROM billing_profiles WHERE userId=94321) profiles,
      (SELECT COUNT(*) FROM access_email_outbox WHERE userId=94321) mails`);
      return { payments, effects };
    }
    function notification(
      changes: Record<string, unknown> = {},
      secret = key,
      path = "/api/prodamus/test/webhook",
    ) {
      const body = {
        currency: "rub",
        customer_email: email,
        demo_mode: "1",
        domain: "testpage1.payform.ru",
        order_id: "94321001",
        order_num: order,
        payment_status: "success",
        sum: "790.00",
        ...changes,
      };
      // Independent provider encoder; never uses production signing helpers.
      function ordered(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(ordered);
        if (value && typeof value === "object")
          return Object.fromEntries(
            Object.entries(value)
              .sort()
              .map(([k, v]) => [k, ordered(v)]),
          );
        return value == null ? "" : String(value);
      }
      const bytes = JSON.stringify(ordered(body)).replace(/\//g, "\\/");
      return fetch(base + path, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", secret).update(bytes).digest("hex"),
        },
      });
    }
    it("creates only a saved monthly demo order and a signed one-off redirect, never a session or access", async () => {
      const response = await client().club.createCheckout.mutate({ email });
      expect(response.user).toBeNull();
      const url = new URL(response.url);
      expect(url.origin).toBe("https://testpage1.payform.ru");
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        demo_mode: "1",
        sum: "790.00",
        currency: "rub",
        customer_email: email,
        payments_limit: "1",
        "products[0][price]": "790.00",
        urlSuccess: "https://daryadarcy.dev.reeskeen.ru/club?paid=1",
        urlReturn: "https://daryadarcy.dev.reeskeen.ru/club",
      });
      for (const name of [
        "subscription",
        "sys",
        "urlNotification",
        "save_payment_method",
        "payment_method",
        "available_payment_methods",
        "installments_disabled",
      ])
        expect(url.searchParams.has(name)).toBe(false);
      const id = url.searchParams.get("order_id");
      expect(id).toMatch(/^club-test-94321-[a-f0-9-]{36}$/);
      const rows = await state();
      expect(rows.payments).toHaveLength(2);
      expect(
        rows.payments.every(
          (row) => row.status === "pending" && row.expiresAt === null,
        ),
      ).toBe(true);
      expect(rows.effects).toEqual([{ receipts: 0, profiles: 0, mails: 0 }]);
    });
    const products = [
      {
        name: "Клуб Darcy — ТЕСТ, 30 дней без автосписаний",
        price: "790.00",
        quantity: "1",
        sum: "790.00",
      },
    ];
    const foreign = {
      currency: "eur",
      currency_sum: "10.01",
      products,
      payment_type: "Open banking EU (Revolute, Monzo и другие банки EU)",
      payment_init: "manual",
      callbackType: "json",
      attempt: "1",
      currency_commission_sum: "1.00",
      commission: "10",
      commission_sum: "79.00",
    };
    it.each([
      ["eur", "10.01", "Open banking EU"],
      ["usd", "11.20", "International card"],
      ["kzt", "4500.00", "Kazakhstan card"],
      ["byn", "32.50", "Belarus card"],
    ])(
      "settles the signed RUB order using %s payment without inventing an exchange rate",
      async (currency, currency_sum, payment_type) => {
        expect(
          (
            await notification({
              ...foreign,
              currency,
              currency_sum,
              payment_type,
            })
          ).status,
        ).toBe(200);
        const paid = await state();
        expect(paid.payments).toEqual([
          {
            orderId: order,
            status: "paid",
            expiresAt: new Date("2026-11-08T00:00:00Z"),
          },
        ]);
        expect(paid.effects).toEqual([{ receipts: 1, profiles: 0, mails: 1 }]);
        expect(
          (
            await notification({
              ...foreign,
              currency,
              currency_sum,
              payment_type,
              attempt: "2",
            })
          ).status,
        ).toBe(200);
        expect(await state()).toEqual(paid);
      },
    );
    it.each(["Карта РФ", "СБП", "Т-Банк", "Оплата по счёту", "Рассрочка"])(
      "accepts a full signed RUB order regardless of method %s",
      async (payment_type) => {
        expect((await notification({ payment_type })).status).toBe(200);
        expect((await state()).effects).toEqual([
          { receipts: 1, profiles: 0, mails: 1 },
        ]);
      },
    );
    it.each<Record<string, unknown>>([
      { currency: "btc" },
      { currency_sum: undefined },
      { currency_sum: "0" },
      { currency_sum: "-10.01" },
      { currency_sum: "1e3" },
      { currency_sum: "10.001" },
      { currency_sum: { value: "10.01" } },
      { products: undefined },
      { products: [{ ...products[0], price: "1.00" }] },
      { products: [{ ...products[0], price: { value: "790.00" } }] },
      { products: [{ ...products[0], quantity: "2" }] },
      { products: [{ ...products[0], sum: "1.00" }] },
      { products: [{ ...products[0], name: "Another product" }] },
      { products: [products[0], products[0]] },
      { sum: "10.01" },
      { subscription: "99" },
      { demo_mode: "0" },
      { customer_email: "other@example.invalid" },
      { domain: "live.payform.ru" },
    ])(
      "refuses malformed or mismatched foreign payment %j without effects",
      async (changes) => {
        const before = await state();
        expect((await notification({ ...foreign, ...changes })).status).toBe(
          400,
        );
        expect(await state()).toEqual(before);
      },
    );
    it("rejects reuse of a foreign receipt with another currency or foreign amount", async () => {
      expect((await notification(foreign)).status).toBe(200);
      const paid = await state();
      for (const changes of [
        { currency: "usd" },
        { currency_sum: "10.02" },
        { currency: "rub" },
      ])
        expect((await notification({ ...foreign, ...changes })).status).toBe(
          400,
        );
      expect(await state()).toEqual(paid);
    });
    it("accepts signed JSON numeric monetary fields without accepting structured or imprecise amounts", async () => {
      expect(
        (
          await notification({
            ...foreign,
            currency_sum: 10.01,
            products: [{ ...products[0], price: 790, sum: 790, quantity: 1 }],
          })
        ).status,
      ).toBe(200);
      expect((await state()).effects).toEqual([
        { receipts: 1, profiles: 0, mails: 1 },
      ]);
    });
    it("grants exactly 30 days through the saved order, with durable access mail and idempotent HTTP replay", async () => {
      const first = await notification();
      expect(first.status).toBe(200);
      expect(await first.text()).toBe("success");
      expect(first.headers.get("set-cookie")).toBeNull();
      const duplicates = await Promise.all(
        Array.from({ length: 5 }, () => notification()),
      );
      for (const result of duplicates) expect(result.status).toBe(200);
      expect(await state()).toEqual({
        payments: [
          {
            orderId: order,
            status: "paid",
            expiresAt: new Date("2026-11-08T00:00:00Z"),
          },
        ],
        effects: [{ receipts: 1, profiles: 0, mails: 1 }],
      });
    });
    it.each<Record<string, string>>([
      { demo_mode: "0" },
      { domain: "live.payform.ru" },
      { sum: "1.00" },
      { customer_email: "other@example.invalid" },
      { order_num: "club-94321-live" },
      { subscription: "99" },
      { payment_init: "auto" },
    ])(
      "refuses mismatched/non-demo/recurring proof %j without granting",
      async (changes) => {
        const before = await state();
        expect((await notification(changes)).status).toBe(400);
        expect(await state()).toEqual(before);
      },
    );
    it("refuses a wrong key and retains the production demo boundary", async () => {
      const before = await state();
      expect((await notification({}, "d".repeat(64))).status).toBe(400);
      vi.stubEnv("PRODAMUS_SECRET", key);
      expect(
        (await notification({}, key, "/api/prodamus/webhook")).status,
      ).toBe(400);
      expect(await state()).toEqual(before);
    });
    it.each([
      ["PRODAMUS_TEST_ENABLED", "false"],
      ["PRODAMUS_TEST_ENABLED", "yes"],
      ["PRODAMUS_TEST_PAYFORM_URL", "https://live.payform.ru"],
      ["PUBLIC_APP_URL", "https://daryadarcy.com"],
      ["PRODAMUS_TEST_SECRET", ""],
      ["YOOKASSA_TEST_ENABLED", "true"],
      ["YOOKASSA_TEST_ENABLED", "yes"],
      ["PRODAMUS_TEST_DEMO_SIGN", "yes"],
    ])(
      "refuses invalid dev configuration %s without a new saved order",
      async (name, value) => {
        vi.stubEnv(name, value);
        const before = await state();
        await expect(
          client().club.createCheckout.mutate({ email }),
        ).rejects.toMatchObject({ data: { code: "PRECONDITION_FAILED" } });
        expect((await notification()).status).toBe(503);
        expect(await state()).toEqual(before);
      },
    );
    it("refuses six-month checkout rather than enabling subscription or charging a different price", async () => {
      const before = await state();
      await expect(
        client().club.createCheckout.mutate({ email, plan: "semiannual" }),
      ).rejects.toMatchObject({ data: { code: "PRECONDITION_FAILED" } });
      expect(await state()).toEqual(before);
    });
    it("refuses a durable YooKassa intent without a provider switch or new test order", async () => {
      const before = await state();
      const response = await fetch(base + "/api/trpc/club.createCheckout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "83be933e-a277-41f3-801d-45771c12b051",
        },
        body: JSON.stringify({ json: { email } }),
      });
      expect(response.status).toBe(412);
      expect(await state()).toEqual(before);
    });
    it("accepts a demo-suffixed signed PHP form and still grants just one period", async () => {
      const fields = {
        currency: "rub",
        customer_email: email,
        demo_mode: "1",
        domain: "testpage1.payform.ru",
        order_id: "94321001",
        order_num: order,
        payment_status: "success",
        sum: "790.00",
      };
      const bytes = JSON.stringify(fields);
      const response = await fetch(base + "/api/prodamus/test/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Sign: createHmac("sha256", key + "demo")
            .update(bytes)
            .digest("hex"),
        },
        body: new URLSearchParams(fields).toString(),
      });
      expect(response.status).toBe(200);
      expect((await state()).payments).toEqual([
        {
          orderId: order,
          status: "paid",
          expiresAt: new Date("2026-11-08T00:00:00Z"),
        },
      ]);
    });
    it("rolls back access and receipt on outbox failure, then accepts a clean provider retry", async () => {
      const before = await state();
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      expect((await notification()).status).toBe(500);
      expect(await state()).toEqual(before);
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 13).toString("base64"),
      );
      expect((await notification()).status).toBe(200);
      expect((await state()).effects).toEqual([
        { receipts: 1, profiles: 0, mails: 1 },
      ]);
    });
  },
);
