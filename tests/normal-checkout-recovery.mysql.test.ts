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
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb, getUserById } from "../apps/backend/src/db";
import { createNormalCheckout } from "../apps/backend/src/billing/normal-checkout";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Real HTTP/JWT/SQL; checkout only builds synthetic links, never visits a provider.
describe.skipIf(!testDatabaseUrl)("normal checkout intent recovery", () => {
  let conn: Connection, app: INestApplication, base: string, bearer: string;
  const key = "ac7cb3a4-8c2e-4c87-9595-b2f5ec5b5201";
  const input = { idempotencyKey: key, plan: "monthly" };
  async function rows(query: string, values: unknown[] = []) {
    const [data] = await conn.query<RowDataPacket[]>(query, values);
    return data;
  }
  async function request(
    method: "createNormalCheckout" | "normalCheckoutStatus",
    value: unknown = input,
    token: string | null = bearer,
    extraHeaders: Record<string, string> = {},
  ) {
    const query = method === "normalCheckoutStatus";
    const encoded = superjson.stringify(value);
    const response = await fetch(
      `${base}/api/trpc/club.${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
      {
        method: query ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extraHeaders,
        },
        ...(query ? {} : { body: encoded }),
      },
    );
    const body = await response.json();
    return {
      code: response.status,
      data: body.result
        ? superjson.deserialize<Record<string, unknown>>(body.result.data)
        : body.error?.json?.data?.code,
      cookie: response.headers.get("set-cookie"),
      cacheControl: response.headers.get("cache-control"),
    };
  }
  async function cleanup() {
    if ((await rows("SHOW TABLES LIKE 'normal_checkout_requests'")).length)
      await conn.query(
        "DELETE FROM normal_checkout_requests WHERE actorUserId IN (9140,9141)",
      );
    await conn.query(
      "DELETE FROM billing_receipts WHERE userId IN (9140,9141)",
    );
    await conn.query("DELETE FROM club_payments WHERE userId IN (9140,9141)");
  }
  beforeAll(async () => {
    conn = await openTestDatabase();
    // This suite deliberately removes ledger guards/tables. Keep other users
    // of the same disposable ledger outside those fault-injection windows.
    expect((await rows("SELECT GET_LOCK('backend_test_normal_checkout',30) AS held"))[0].held).toBe(1);
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "normal-checkout-synthetic-session-key");
    vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
    vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
    vi.stubEnv("PRODAMUS_SECRET", "synthetic-merchant-key");
    vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "123");
    vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
    vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
    vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "true");
    await conn.query(
      "INSERT INTO users (id,openId,email,passwordHash,role) VALUES (9140,'normal-checkout-member','normal-checkout@example.test','unchanged-password-hash','user'),(9141,'normal-checkout-other','normal-checkout-other@example.test','other-password-hash','user')",
    );
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    bearer = await sdk.createSessionToken("normal-checkout-member", {
      sessionVersion: 0,
    });
  }, 45_000);
  beforeEach(async () => {
    await cleanup();
    await conn.query(
      "UPDATE users SET blockedAt=NULL,sessionVersion=0,email='normal-checkout@example.test' WHERE id=9140",
    );
    vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "true");
    vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
    vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
    vi.stubEnv("PRODAMUS_SECRET", "synthetic-merchant-key");
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await cleanup();
      await conn.query("DELETE FROM users WHERE id IN (9140,9141)");
      await conn.query("SELECT RELEASE_LOCK('backend_test_normal_checkout')");
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  it("replays one committed checkout without another pending order or identity effect", async () => {
    const identity = await rows(
      "SELECT id,openId,email,passwordHash,role,sessionVersion FROM users WHERE id=9140",
    );
    const first = await request("createNormalCheckout");
    expect(first.code).toBe(200);
    expect(first.data).toMatchObject({
      state: "pending",
      orderId: expect.stringMatching(/^club-9140-/),
    });
    const again = await request("createNormalCheckout");
    expect(again).toEqual(first);
    expect(first.cookie).toBeNull();
    const url = new URL(first.data.url);
    expect(url.hostname).toBe("fixture.payform.ru");
    expect(url.searchParams.get("order_id")).toBe(first.data.orderId);
    expect(url.searchParams.get("subscription")).toBe("123");
    expect(
      await rows(
        "SELECT status,paidAt,expiresAt FROM club_payments WHERE userId=9140",
      ),
    ).toEqual([{ status: "pending", paidAt: null, expiresAt: null }]);
    expect(
      await rows(
        "SELECT orderId FROM normal_checkout_requests WHERE actorUserId=9140",
      ),
    ).toEqual([{ orderId: first.data.orderId }]);
    expect(
      await rows(
        "SELECT id,openId,email,passwordHash,role,sessionVersion FROM users WHERE id=9140",
      ),
    ).toEqual(identity);
    expect(
      await rows("SELECT userId FROM access_email_outbox WHERE userId=9140"),
    ).toEqual([]);
    expect(
      await rows("SELECT userId FROM password_tokens WHERE userId=9140"),
    ).toEqual([]);
  });
  it("serializes concurrent identical intentions into one order and link", async () => {
    const replies = await Promise.all(
      Array.from({ length: 12 }, () => request("createNormalCheckout")),
    );
    expect(replies.map((r) => r.code)).toEqual(Array(12).fill(200));
    expect(new Set(replies.map((r) => r.data.orderId)).size).toBe(1);
    expect(new Set(replies.map((r) => r.data.url)).size).toBe(1);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("refuses a changed plan under the original key without a second order", async () => {
    expect((await request("createNormalCheckout")).code).toBe(200);
    expect(
      await request("createNormalCheckout", { ...input, plan: "semiannual" }),
    ).toMatchObject({ code: 409, data: "CONFLICT" });
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("fails closed when disabled or TEST mode is selected", async () => {
    vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "false");
    expect((await request("createNormalCheckout")).code).toBe(412);
    vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "true");
    vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
    expect((await request("createNormalCheckout")).code).toBe(412);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(0);
  });
  it("preserves the order when signing configuration changes", async () => {
    expect((await request("createNormalCheckout")).code).toBe(200);
    vi.stubEnv("PRODAMUS_SECRET", "changed-synthetic-key");
    expect((await request("createNormalCheckout")).code).toBe(412);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("reads pending and notRecorded without issuing a payment link", async () => {
    expect(
      await request("normalCheckoutStatus", { idempotencyKey: key }),
    ).toMatchObject({ code: 200, data: { state: "notRecorded" } });
    const created = await request("createNormalCheckout");
    vi.stubEnv("PRODAMUS_SECRET", "changed-synthetic-key");
    expect(
      await request("normalCheckoutStatus", { idempotencyKey: key }),
    ).toMatchObject({
      code: 200,
      data: { state: "pending", orderId: created.data.orderId },
    });
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).not.toHaveProperty("url");
  });
  it("reports failed orders on create and status without recreating them", async () => {
    const created = await request("createNormalCheckout");
    await conn.query(
      "UPDATE club_payments SET status='failed' WHERE orderId=?",
      [created.data.orderId],
    );
    expect(await request("createNormalCheckout")).toMatchObject({
      code: 200,
      data: { state: "failed", orderId: created.data.orderId },
    });
    expect(
      await request("normalCheckoutStatus", { idempotencyKey: key }),
    ).toMatchObject({
      code: 200,
      data: { state: "failed", orderId: created.data.orderId },
    });
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("requires an order-specific receipt and returns that order's expiry", async () => {
    const created = await request("createNormalCheckout");
    await conn.query(
      "UPDATE club_payments SET status='paid',paidAt='2026-10-14 10:00:00',expiresAt='2026-11-14 10:00:00' WHERE orderId=?",
      [created.data.orderId],
    );
    expect((await request("createNormalCheckout")).code).toBe(500);
    await conn.query(
      "INSERT INTO billing_receipts (paymentKey,userId,orderId,payloadHash,amountMinor) SELECT ?,9140,orderId,?,amountMinor FROM normal_checkout_requests WHERE actorUserId=9140",
      ["a".repeat(64), "b".repeat(64)],
    );
    vi.stubEnv("PRODAMUS_SECRET", "changed-synthetic-key");
    const expected = {
      state: "succeeded",
      orderId: created.data.orderId,
      expiresAt: new Date("2026-11-14T10:00:00Z"),
    };
    expect((await request("createNormalCheckout")).data).toEqual(expected);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).toEqual(expected);
  });
  it("fails closed when the ledger lacks its unique request guard", async () => {
    await conn.query("ALTER TABLE normal_checkout_requests DROP PRIMARY KEY");
    try {
      expect((await request("createNormalCheckout")).code).toBe(500);
      expect(
        (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
      ).toBe(500);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
      ).toHaveLength(0);
    } finally {
      await conn.query(
        "ALTER TABLE normal_checkout_requests ADD PRIMARY KEY (requestKey)",
      );
    }
  });
  it("fails closed on a deleted order instead of recreating it", async () => {
    await request("createNormalCheckout");
    await conn.query("DELETE FROM club_payments WHERE userId=9140");
    expect((await request("createNormalCheckout")).code).toBe(500);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(0);
  });
  it("isolates identical raw keys across accounts and denies unauthenticated access", async () => {
    const first = await request("createNormalCheckout");
    const other = await sdk.createSessionToken("normal-checkout-other", {
      sessionVersion: 0,
    });
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key }, other))
        .data,
    ).toEqual({ state: "notRecorded" });
    const second = await request("createNormalCheckout", input, other);
    expect(second.code).toBe(200);
    expect(second.data.orderId).not.toBe(first.data.orderId);
    expect((await request("createNormalCheckout", input, null)).code).toBe(401);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key }, null))
        .code,
    ).toBe(401);
  });
  it("rejects malformed durable evidence even when the pending order exists", async () => {
    await request("createNormalCheckout");
    await conn.query(
      "UPDATE normal_checkout_requests SET checkoutUrlHash='broken' WHERE actorUserId=9140",
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
    expect((await request("createNormalCheckout")).code).toBe(500);
  });
  it("does not report success when the stored order email no longer matches its intent", async () => {
    const created = await request("createNormalCheckout");
    await conn.query(
      "UPDATE club_payments SET email='wrong@example.test',status='paid',paidAt=NOW(),expiresAt=DATE_ADD(NOW(),INTERVAL 1 MONTH) WHERE orderId=?",
      [created.data.orderId],
    );
    await conn.query(
      "INSERT INTO billing_receipts (paymentKey,userId,orderId,payloadHash,amountMinor) SELECT ?,9140,orderId,?,amountMinor FROM normal_checkout_requests WHERE actorUserId=9140",
      ["a".repeat(64), "b".repeat(64)],
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
    expect((await request("createNormalCheckout")).code).toBe(500);
  });
  it("recovers a committed checkout when the client discards the HTTP acknowledgement", async () => {
    const response = await fetch(`${base}/api/trpc/club.createNormalCheckout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: superjson.stringify(input),
    });
    expect(response.status).toBe(200);
    await response.body?.cancel(); // No client state/result is retained.
    const status = await request("normalCheckoutStatus", {
      idempotencyKey: key,
    });
    expect(status.data.state).toBe("pending");
    expect(status.cacheControl).toContain("no-store");
    const retry = await request("createNormalCheckout");
    expect(retry.data.orderId).toBe(status.data.orderId);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toEqual([{ orderId: status.data.orderId }]);
  });
  it("rolls back the order when committing the durable ledger fails", async () => {
    await conn.query(
      "CREATE TRIGGER owned_normal_checkout_failure BEFORE INSERT ON normal_checkout_requests FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned synthetic ledger failure'",
    );
    try {
      expect((await request("createNormalCheckout")).code).toBe(500);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
      ).toHaveLength(0);
      expect(
        (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
      ).toEqual({ state: "notRecorded" });
    } finally {
      await conn.query("DROP TRIGGER owned_normal_checkout_failure");
    }
    expect((await request("createNormalCheckout")).code).toBe(200);
  });
  // Bundling plus two independent server processes needs more than the default 5s.
  it("preserves the original intention across independent compiled server processes", async () => {
    const directory = mkdtempSync(resolve(".tmp-normal-checkout-"));
    const entry = join(directory, "application.mjs");
    try {
      await build({
        stdin: {
          loader: "ts",
          resolveDir: process.cwd(),
          contents: `
        import {createBackendApplication} from './apps/backend/src/_core/application';
        import {sdk} from './apps/backend/src/_core/sdk';
        import {getDb} from './apps/backend/src/db';
        import {createTRPCProxyClient,httpLink} from '@trpc/client';
        import superjson from 'superjson';
        const app=await createBackendApplication();
        try {
          await app.listen(0,'127.0.0.1');
          const token=await sdk.createSessionToken('normal-checkout-member',{sessionVersion:0});
          const club=createTRPCProxyClient({links:[httpLink({url:'http://127.0.0.1:'+app.getHttpServer().address().port+'/api/trpc',transformer:superjson,headers:{Authorization:'Bearer '+token}})]}).club;
          const checkout=await club.createNormalCheckout.mutate(${JSON.stringify(input)});
          const status=await club.normalCheckoutStatus.query({idempotencyKey:${JSON.stringify(key)}});
          console.log('NORMAL_RESULT:'+JSON.stringify({checkout,status}));
        } finally {await app.close();const db=await getDb();await db?.$client.end();}
      `,
        },
        platform: "node",
        packages: "external",
        bundle: true,
        format: "esm",
        outfile: entry,
      });
      const run = () => {
        const output = execFileSync(process.execPath, [entry], {
          cwd: tmpdir(),
          encoding: "utf8",
          timeout: 10000,
          env: {
            NODE_ENV: "production",
            DATABASE_URL: testDatabaseUrl!,
            JWT_SECRET: "compiled-normal-synthetic-secret",
            PUBLIC_APP_URL: "https://club.example.test",
            PRODAMUS_PAYFORM_URL: "https://fixture.payform.ru",
            PRODAMUS_SECRET: "synthetic-merchant-key",
            PRODAMUS_SUBSCRIPTION_ID: "123",
            PRODAMUS_TEST_ENABLED: "false",
            YOOKASSA_TEST_ENABLED: "false",
            NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
          },
        });
        const line = output
          .split("\n")
          .find((value) => value.startsWith("NORMAL_RESULT:"));
        expect(line).toBeDefined();
        return JSON.parse(line!.slice("NORMAL_RESULT:".length));
      };
      const first = run();
      expect(run()).toEqual(first);
      expect(first.status).toEqual({
        state: "pending",
        orderId: first.checkout.orderId,
      });
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
      ).toHaveLength(1);
    } finally {
      rmSync(entry, { force: true });
      rmdirSync(directory);
    }
  }, 30_000);
  it("rejects TEST headers, blocked/revoked sessions, and client-controlled identity", async () => {
    expect(
      (
        await request("createNormalCheckout", input, bearer, {
          "idempotency-key": key,
        })
      ).code,
    ).toBe(412);
    expect(
      (
        await request("createNormalCheckout", {
          ...input,
          email: "other@example.test",
        })
      ).code,
    ).toBe(400);
    await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=9140");
    // Existing optional authentication suppresses blocked identities before routing.
    expect((await request("createNormalCheckout")).code).toBe(401);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(401);
    await conn.query(
      "UPDATE users SET blockedAt=NULL,sessionVersion=1 WHERE id=9140",
    );
    expect((await request("createNormalCheckout")).code).toBe(401);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(401);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(0);
  });
  it("conflicts on changed account email but still reads the original order", async () => {
    const first = await request("createNormalCheckout");
    await conn.query(
      "UPDATE users SET email='changed@example.test' WHERE id=9140",
    );
    expect((await request("createNormalCheckout")).code).toBe(409);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).toEqual({ state: "pending", orderId: first.data.orderId });
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("preserves the non-recurring semiannual checkout contract", async () => {
    const first = await request("createNormalCheckout", {
      ...input,
      plan: "semiannual",
    });
    expect(first.code).toBe(200);
    const url = new URL(first.data.url);
    expect(first.data.orderId).toMatch(/^club6m-9140-/);
    expect(url.searchParams.has("subscription")).toBe(false);
    expect(
      await request("createNormalCheckout", { ...input, plan: "semiannual" }),
    ).toEqual(first);
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).toEqual({ state: "pending", orderId: first.data.orderId });
  });
  it("fails closed for an absent ledger and restores only the owned fixture", async () => {
    await conn.query(
      "RENAME TABLE normal_checkout_requests TO owned_hidden_normal_checkout_requests",
    );
    try {
      expect((await request("createNormalCheckout")).code).toBe(500);
      expect(
        (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
      ).toBe(500);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
      ).toHaveLength(0);
    } finally {
      await conn.query(
        "RENAME TABLE owned_hidden_normal_checkout_requests TO normal_checkout_requests",
      );
    }
  });
  it("does not mistake another paid order for this purchase", async () => {
    const first = await request("createNormalCheckout");
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,email,sum,status,paidAt,expiresAt) VALUES (9140,'club-9140-other-paid','normal-checkout@example.test','790','paid',NOW(),'2030-01-01 00:00:00')",
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).toEqual({ state: "pending", orderId: first.data.orderId });
    expect((await request("createNormalCheckout")).data).toEqual(first.data);
  });
  it("rejects invalid keys and strict status inputs before writing", async () => {
    for (const invalid of [
      key.toUpperCase(),
      "not-a-key",
      key.replace("4c87", "1c87"),
    ]) {
      expect(
        (await request("createNormalCheckout", { idempotencyKey: invalid }))
          .code,
      ).toBe(400);
      expect(
        (await request("normalCheckoutStatus", { idempotencyKey: invalid }))
          .code,
      ).toBe(400);
    }
    expect((await request("normalCheckoutStatus", input)).code).toBe(400);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(0);
  });
  it("rechecks a revoked identity inside the transaction rather than trusting the actor snapshot", async () => {
    const actor = await getUserById(9140);
    expect(actor).toBeDefined();
    await conn.beginTransaction();
    try {
      await conn.query("SELECT id FROM users WHERE id=9140 FOR UPDATE");
      const pending = createNormalCheckout(
        actor!,
        { ...input, plan: "monthly" },
        undefined,
      );
      const assertion = expect(pending).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=9140");
      await conn.commit();
      await assertion;
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
      ).toHaveLength(0);
    } finally {
      await conn.rollback();
    }
  });
  it("does not accept malformed canonical receipt evidence", async () => {
    const created = await request("createNormalCheckout");
    await conn.query(
      "UPDATE club_payments SET status='paid',paidAt=NOW(),expiresAt=DATE_ADD(NOW(),INTERVAL 1 MONTH) WHERE orderId=?",
      [created.data.orderId],
    );
    await conn.query(
      "INSERT INTO billing_receipts (paymentKey,userId,orderId,payloadHash,amountMinor) SELECT 'broken',9140,orderId,'broken',amountMinor FROM normal_checkout_requests WHERE actorUserId=9140",
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
  });
  it("reads status in TEST mode without converting a normal intent", async () => {
    const first = await request("createNormalCheckout");
    for (const mode of ["true", "malformed"]) {
      vi.stubEnv("YOOKASSA_TEST_ENABLED", mode);
      expect((await request("createNormalCheckout")).code).toBe(412);
      expect(
        (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
      ).toEqual({ state: "pending", orderId: first.data.orderId });
    }
    vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "false");
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(412);
    expect(
      await rows("SELECT orderId FROM club_payments WHERE userId=9140"),
    ).toHaveLength(1);
  });
  it("checks receipt ownership and amount independently of a paid row", async () => {
    const created = await request("createNormalCheckout");
    await conn.query(
      "UPDATE club_payments SET status='paid',paidAt=NOW(),expiresAt='2025-01-01 00:00:00' WHERE orderId=?",
      [created.data.orderId],
    );
    await conn.query(
      "INSERT INTO billing_receipts (paymentKey,userId,orderId,payloadHash,amountMinor) SELECT ?,9141,orderId,?,amountMinor FROM normal_checkout_requests WHERE actorUserId=9140",
      ["a".repeat(64), "b".repeat(64)],
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
    await conn.query(
      "UPDATE billing_receipts SET userId=9140,amountMinor=1 WHERE orderId=?",
      [created.data.orderId],
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).code,
    ).toBe(500);
    await conn.query(
      "UPDATE billing_receipts r JOIN normal_checkout_requests n ON n.orderId=r.orderId SET r.amountMinor=n.amountMinor WHERE r.orderId=?",
      [created.data.orderId],
    );
    expect(
      (await request("normalCheckoutStatus", { idempotencyKey: key })).data,
    ).toEqual({
      state: "succeeded",
      orderId: created.data.orderId,
      expiresAt: new Date("2025-01-01T00:00:00Z"),
    });
  });
});
