import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { requestClubCancellation } from "../apps/backend/src/billing/cancellation";

const realFetch = globalThis.fetch;
const key = "23456789-1234-4123-8123-123456789abc";
const id = "2419a771-000f-5000-9000-1edaf29243f2";
describe.skipIf(!testDatabaseUrl)(
  "YooKassa native checkout and settlement",
  () => {
    let app: INestApplication;
    let base: string;
    let conn: Connection;
    let creates = 0;
    let sent: {
      metadata: { order_id: string };
      amount: { value: string; currency: string };
    };
    let providerStatus: "pending" | "succeeded" | "canceled";
    let override: Record<string, unknown>;
    let uncertain: boolean;
    let lookupUnavailable: boolean;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "true");
      vi.stubEnv("YOOKASSA_SHOP_ID", "123456");
      vi.stubEnv("YOOKASSA_SECRET_KEY", "test_synthetic-not-a-real-secret");
      vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
      vi.stubEnv("PRODAMUS_SECRET", "");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      await conn.query(
        "INSERT IGNORE INTO users (id,openId,email) VALUES (780,'yoo-checkout','yoo-checkout@example.test')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
      for (const table of [
        "billing_checkout_intents",
        "billing_receipts",
        "billing_profiles",
        "password_tokens",
        "access_email_outbox",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId=780`);
      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=780");
      creates = 0;
      providerStatus = "pending";
      override = {};
      uncertain = false;
      lookupUnavailable = false;
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "true");
      vi.stubGlobal(
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
          const target = String(url);
          if (!target.startsWith("https://api.yookassa.ru/"))
            return realFetch(url, init);
          if (target.endsWith("/me"))
            return Response.json({
              account_id: "123456",
              test: true,
              payment_methods: ["bank_card"],
            });
          if (init?.method !== "POST" && lookupUnavailable)
            return Response.json({ error: "unknown" }, { status: 500 });
          if (init?.method === "POST") {
            creates++;
            sent = JSON.parse(String(init.body));
            if (uncertain)
              return Response.json({ error: "unknown" }, { status: 500 });
          }
          return Response.json({
            id,
            status: providerStatus,
            paid: providerStatus === "succeeded",
            test: true,
            amount: sent.amount,
            recipient: { account_id: "123456" },
            metadata: sent.metadata,
            ...(providerStatus === "pending"
              ? {
                  confirmation: {
                    type: "redirect",
                    confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${id}`,
                  },
                }
              : {}),
            ...override,
          });
        },
      );
    });
    afterAll(async () => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      await app?.close();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const checkout = (intentKey: string | null = key, plan = "monthly") =>
      realFetch(`${base}/api/trpc/club.createCheckout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(intentKey ? { "Idempotency-Key": intentKey } : {}),
        },
        body: JSON.stringify({
          json: { email: "yoo-checkout@example.test", plan },
        }),
      });
    const webhook = (objectId = id) =>
      realFetch(`${base}/api/yookassa/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "notification",
          event: "payment.succeeded",
          object: { id: objectId, status: "succeeded", paid: true },
        }),
      });
    async function state() {
      const [payments] = await conn.query<RowDataPacket[]>(
        "SELECT status,expiresAt FROM club_payments WHERE userId=780",
      );
      const [outbox] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM access_email_outbox WHERE userId=780",
      );
      const [receipts] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM billing_receipts WHERE userId=780",
      );
      return { payments, emails: outbox[0].n, receipts: receipts[0].n };
    }
    it("creates a pending test payment, never a login or access grant", async () => {
      const response = await checkout();
      expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.json();
      expect(body.result.data.json).toEqual({
        url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${id}`,
        user: null,
      });
      expect((await state()).payments[0].status).toBe("pending");
      expect((await state()).emails).toBe(0);
    });
    it("the same checkout key reuses a known payment instead of posting again", async () => {
      expect((await checkout()).status).toBe(200);
      expect((await checkout()).status).toBe(200);
      expect(creates).toBe(1);
      expect((await state()).payments).toHaveLength(1);
    });
    it("a forged succeeded body cannot grant while the provider reports pending", async () => {
      expect((await checkout()).status).toBe(200);
      expect((await webhook()).status).toBe(503);
      expect((await state()).payments[0].status).toBe("pending");
      expect((await state()).receipts).toBe(0);
    });
    it("verified succeeded grants one period and one outbox event under parallel replay", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      const replies = await Promise.all(
        Array.from({ length: 3 }, () => webhook()),
      );
      expect(replies.map((response) => response.status)).toEqual([
        200, 200, 200,
      ]);
      const result = await state();
      expect(result.receipts).toBe(1);
      expect(result.emails).toBe(1);
      expect(result.payments[0].expiresAt.toISOString()).toBe(
        "2026-11-06T00:00:00.000Z",
      );
    });
    it("a webhook before provider binding is retriable, not acknowledged or trusted", async () => {
      expect((await webhook()).status).toBe(503);
      expect(creates).toBe(0);
      expect((await state()).receipts).toBe(0);
    });
    it("unknown creation retains the intent and repeats the stored request", async () => {
      uncertain = true;
      expect((await checkout()).status).toBe(503);
      const originalOrder = sent.metadata.order_id;
      uncertain = false;
      expect((await checkout()).status).toBe(200);
      expect(sent.metadata.order_id).toBe(originalOrder);
      expect((await state()).payments).toHaveLength(1);
    });
    it("test checkout refuses a missing key before creating a payment", async () => {
      expect((await checkout(null)).status).toBe(400);
      expect(creates).toBe(0);
      expect((await state()).payments).toHaveLength(0);
    });
    it.each([
      ["live payment", { test: false }],
      ["another shop", { recipient: { account_id: "654321" } }],
      ["wrong amount", { amount: { value: "0.01", currency: "RUB" } }],
      ["wrong currency", { amount: { value: "790.00", currency: "USD" } }],
      ["another order", { metadata: { order_id: "yk-club-unbound" } }],
      ["not paid", { paid: false }],
      ["another payment", { id: "3419a771-000f-5000-9000-1edaf29243f2" }],
    ])(
      "rejects fetched %s without granting access",
      async (_label, invalid) => {
        expect((await checkout()).status).toBe(200);
        providerStatus = "succeeded";
        override = invalid;
        expect((await webhook()).status).toBe(503);
        const result = await state();
        expect(result).toMatchObject({ receipts: 0, emails: 0 });
        expect(result.payments[0].status).toBe("pending");
      },
    );
    it("does not acknowledge a provider lookup outage; a later retry settles", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      lookupUnavailable = true;
      expect((await webhook()).status).toBe(503);
      expect((await state()).receipts).toBe(0);
      lookupUnavailable = false;
      expect((await webhook()).status).toBe(200);
      expect((await state()).receipts).toBe(1);
    });
    it("a blocked recipient cannot receive access after checkout", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=780");
      expect((await webhook()).status).toBe(503);
      expect(await state()).toMatchObject({ receipts: 0, emails: 0 });
    });
    it("outbox failure rolls back the receipt and access, then safely recovers", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      expect((await webhook()).status).toBe(503);
      const failed = await state();
      expect(failed).toMatchObject({ receipts: 0, emails: 0 });
      expect(failed.payments[0].status).toBe("pending");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      expect((await webhook()).status).toBe(200);
      expect(await state()).toMatchObject({ receipts: 1, emails: 1 });
    });
    it("a verified cancellation closes only the pending order, never grants", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "canceled";
      expect((await webhook()).status).toBe(200);
      expect(await state()).toMatchObject({ receipts: 0, emails: 0 });
      expect((await state()).payments[0].status).toBe("failed");
      expect((await checkout()).status).toBe(400);
      expect(creates).toBe(1);
    });
    it("a browser-style GET to the callback cannot settle a payment", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      expect(
        (
          await realFetch(
            `${base}/api/yookassa/webhook?payment_id=${id}&status=succeeded`,
          )
        ).status,
      ).toBe(404);
      expect(await state()).toMatchObject({ receipts: 0, emails: 0 });
    });
    it("oversized and malformed notifications are rejected before verification", async () => {
      for (const [body, status] of [
        [JSON.stringify({ data: "x".repeat(65536) }), 413],
        ["{broken", 400],
      ] as const) {
        const response = await realFetch(`${base}/api/yookassa/webhook`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        expect(response.status).toBe(status);
      }
      expect(await state()).toMatchObject({ receipts: 0, emails: 0 });
    });
    it("disabled test mode cannot acknowledge or settle a test callback", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
      expect((await webhook()).status).toBe(503);
      expect(await state()).toMatchObject({ receipts: 0, emails: 0 });
    });
    it("a six-month test purchase grants 180 days with no recurring profile", async () => {
      expect((await checkout(key, "semiannual")).status).toBe(200);
      providerStatus = "succeeded";
      expect((await webhook()).status).toBe(200);
      expect((await state()).payments[0].expiresAt.toISOString()).toBe(
        "2027-04-05T00:00:00.000Z",
      );
      const [profiles] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM billing_profiles WHERE userId=780",
      );
      expect(profiles[0].n).toBe(0);
    });
    it("a proved one-off payment can close renewal controls without calling Prodamus or reducing access", async () => {
      expect((await checkout()).status).toBe(200);
      providerStatus = "succeeded";
      expect((await webhook()).status).toBe(200);
      const send = vi.fn(async () => true);
      const result = await requestClubCancellation((await getDb())!, 780, send);
      expect(result).toEqual({
        confirmed: true,
        expiresAt: new Date("2026-11-06T00:00:00Z"),
      });
      expect(send).not.toHaveBeenCalled();
      expect((await state()).payments[0].expiresAt.toISOString()).toBe(
        "2026-11-06T00:00:00.000Z",
      );
    });
    it("a yookassa-looking order without persisted receipt and binding cannot claim renewal cancellation", async () => {
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (780,'yk-club-fake','paid','2026-11-06 00:00:00')",
      );
      await expect(
        requestClubCancellation((await getDb())!, 780, async () => true),
      ).rejects.toThrow("profile");
    });
  },
);
