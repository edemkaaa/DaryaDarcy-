import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import { sdk } from "../apps/backend/src/_core/sdk";
import {
  cancelProdamusSubscription,
  createProdamusSign,
} from "../apps/backend/src/prodamus";
import {
  processCancellations,
  requestClubCancellation,
} from "../apps/backend/src/billing/cancellation";
describe.skipIf(!testDatabaseUrl)(
  "local HTTP → MySQL → mail/provider boundaries",
  () => {
    let conn: Connection,
      provider: Server,
      application: INestApplication,
      base: string;
    let providerBody = "provider error",
      lastParameters: Record<string, string> = {};
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "password-http-fixture-secret-32-characters");
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
      await conn.query(
        "INSERT IGNORE INTO users (id,openId,role) VALUES (792,'password-http-staff','moderator')",
      );
      await conn.query(
        "UPDATE users SET role='moderator',blockedAt=NULL WHERE id=792",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=792");
      const app = express();
      app.use(express.urlencoded({ extended: false }));
      app.post("/rest/setActivity/", (req, res) => {
        lastParameters = req.body;
        res.send(providerBody);
      });
      provider = await new Promise<Server>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
      });
      vi.stubEnv(
        "PRODAMUS_PAYFORM_URL",
        `http://127.0.0.1:${(provider.address() as AddressInfo).port}`,
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      vi.stubEnv("PUBLIC_APP_URL", base);
    });
    afterAll(async () => {
      await application?.close();
      await new Promise<void>((resolve) => provider?.close(() => resolve()));
      if (conn) {
        for (const table of ["access_email_outbox", "password_tokens", "billing_receipts", "billing_profiles", "club_payments"])
          await conn.query(`DELETE FROM ${table} WHERE userId=780`);
        await conn.query("DELETE FROM users WHERE id=780 AND openId='http-test'");
      }
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
      const page = await fetch(`${base}/api/auth/password`, { redirect: "manual" });
      expect(page.status).toBe(303);
      expect(page.headers.get("location")).toBe(`${base}/password`);
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
    it("queues a staff resend through the native password service and audits its author", async () => {
      const token = await sdk.createSessionToken("password-http-staff", {
        sessionVersion: 0,
      });
      const response = await fetch(`${base}/api/admin/access-email/resend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: 780 }),
      });
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ queued: true });
      expect(response.headers.get("cache-control")).toBe("no-store");
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT action,targetId FROM admin_audit_log WHERE actorUserId=792",
      );
      expect(audit).toEqual([{ action: "resend_club_access", targetId: 780 }]);
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=792");
      const blocked = await fetch(`${base}/api/admin/access-email/resend`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: 780 }),
      });
      expect(blocked.status).toBe(403);
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
