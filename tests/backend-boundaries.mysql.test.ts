import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { registerPasswordRoutes } from "../apps/backend/src/identity/routes";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import {
  cancelProdamusSubscription,
  createProdamusSign,
  handleProdamusWebhook,
} from "../apps/backend/src/prodamus";
import {
  processCancellations,
  requestClubCancellation,
} from "../apps/backend/src/billing/cancellation";
describe.skipIf(!testDatabaseUrl)(
  "local HTTP → MySQL → mail/provider boundaries",
  () => {
    let conn: Connection, server: Server, base: string;
    let providerBody = "provider error",
      lastParameters: Record<string, string> = {};
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      vi.stubEnv("PRODAMUS_SECRET", "http-test-only-key");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "123");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
      vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
      await conn.query("DELETE FROM access_email_outbox WHERE userId=780");
      await conn.query("DELETE FROM password_tokens WHERE userId=780");
      await conn.query("DELETE FROM billing_receipts WHERE userId=780");
      await conn.query("DELETE FROM billing_profiles WHERE userId=780");
      await conn.query("DELETE FROM club_payments WHERE userId=780");
      await conn.query("DELETE FROM users WHERE id=780");
      await conn.query(
        "INSERT INTO users (id,openId,email) VALUES (780,'http-test','http@example.test')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,email,sum) VALUES (780,'club-780-http','http@example.test','790')",
      );
      const app = express();
      app.post(
        "/api/prodamus/webhook",
        express.raw({ type: () => true }),
        handleProdamusWebhook,
      );
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));
      registerPasswordRoutes(app);
      app.post("/rest/setActivity/", (req, res) => {
        lastParameters = req.body;
        res.send(providerBody);
      });
      server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      vi.stubEnv("PRODAMUS_PAYFORM_URL", base);
      vi.stubEnv("PUBLIC_APP_URL", base);
    });
    afterAll(async () => {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const body = {
      order_num: "club-780-http",
      order_id: "http-provider-1",
      domain: "127.0.0.1",
      currency: "rub",
      sum: "790.00",
      payment_status: "success",
      customer_email: "http@example.test",
      subscription: { id: "123", profile_id: "999" },
    };
    const post = (path: string, data: unknown, sign?: string) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sign ? { sign } : {}),
        },
        body: JSON.stringify(data),
      });
    it("signed concurrent callbacks persist one charge and one access email", async () => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          post(
            "/api/prodamus/webhook",
            body,
            createProdamusSign(body, "http-test-only-key"),
          ),
        ),
      );
      expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
      const [receipts] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM billing_receipts WHERE userId=780",
      );
      expect(receipts[0].n).toBe(1);
      const [outbox] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM access_email_outbox WHERE userId=780",
      );
      expect(outbox[0].n).toBe(1);
    });
    it("access email completes a one-time password without creating a session", async () => {
      let message = "";
      // Workers can defer locked rows; emulate the next scheduler tick until mail arrives.
      await vi.waitFor(
        async () => {
          if (!message)
            await processAccessEmails(
              (await getDb())!,
              async (mail) => {
                message = mail.text;
                return true;
              },
              780,
            );
          expect(message).not.toBe("");
        },
        { timeout: 3000, interval: 20 },
      );
      const token = new URL(message.match(/http:\/\/\S+/)![0]).hash.slice(7);
      const page = await fetch(`${base}/api/auth/password`);
      expect(page.headers.get("referrer-policy")).toBe("no-referrer");
      expect(page.headers.get("cache-control")).toBe("no-store");
      const complete = await post("/api/auth/password/complete", {
        token,
        password: "http-password-123",
      });
      expect(complete.status).toBe(200);
      expect(complete.headers.get("set-cookie")).toBeNull();
      expect(
        (
          await post("/api/auth/password/complete", {
            token,
            password: "different-password",
          })
        ).status,
      ).toBe(400);
    });
    it("unknown and real password requests have identical public responses", async () => {
      const known = await post("/api/auth/password/request", {
        email: "http@example.test",
      });
      const unknown = await post("/api/auth/password/request", {
        email: "nobody@example.test",
      });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(await known.json()).toEqual(await unknown.json());
    });
    it("HTTP 200 with an error body is not a successful cancellation", async () => {
      const database = (await getDb())!;
      providerBody = "subscription not found";
      expect(
        (
          await requestClubCancellation(
            database,
            780,
            cancelProdamusSubscription,
          )
        ).confirmed,
      ).toBe(false);
      expect(lastParameters).toMatchObject({
        profile: "999",
        subscription: "123",
        active_user: "0",
      });
      const { signature, ...unsigned } = lastParameters;
      expect(signature).toBe(
        createProdamusSign(unsigned, "http-test-only-key"),
      );
      providerBody = "success";
      await conn.query(
        "UPDATE billing_profiles SET nextAttemptAt=NOW() WHERE userId=780",
      );
      await processCancellations(database, cancelProdamusSubscription, 780);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT cancelledAt FROM billing_profiles WHERE userId=780",
      );
      expect(rows[0].cancelledAt).not.toBeNull();
    });
    it("signed cancellation requires the stored profile, not only its email", async () => {
      const bad = {
        ...body,
        subscription: {
          ...body.subscription,
          profile_id: "888",
          action_code: "deactivation",
        },
      };
      expect(
        (
          await post(
            "/api/prodamus/webhook",
            bad,
            createProdamusSign(bad, "http-test-only-key"),
          )
        ).status,
      ).toBe(422);
      const good = {
        ...body,
        subscription: { ...body.subscription, action_code: "deactivation" },
      };
      expect(
        (
          await post(
            "/api/prodamus/webhook",
            good,
            createProdamusSign(good, "http-test-only-key"),
          )
        ).status,
      ).toBe(200);
    });
  },
);
