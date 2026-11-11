import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import {
  createClubPayment,
  ensureUserByEmail,
  getDb,
  getUserByEmail,
} from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// Own disposable SQL, real HTTP/JWT; no provider requests, emails or SMS.
describe.skipIf(!testDatabaseUrl)(
  "unverified checkout contact in the user card",
  () => {
    let conn: Connection, app: INestApplication, base: string, token: string;
    const email = "user-contact-owner@example.invalid";
    const otherEmail = "user-contact-other@example.invalid";
    const freshEmail = "user-contact-fresh@example.invalid";
    const original = "+447700900123";
    const phone = "+79991234567";
    const rows = async (sql: string, args: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(sql, args))[0];
    const client = (bearer?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
          }),
        ],
      });
    const create = (
      bearer?: string,
      contactPhone = "8 (999) 123-45-67",
      recipient = email,
    ) =>
      client(bearer).club.createCheckout.mutate({
        email: recipient,
        contactPhone,
      });
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS owned_contact_payment_failure");
      const users = await rows("SELECT id FROM users WHERE email IN (?,?,?)", [
        email,
        otherEmail,
        freshEmail,
      ]);
      for (const { id } of users) {
        await conn.query("DELETE FROM club_payments WHERE userId=?", [id]);
        await conn.query("DELETE FROM users WHERE id=?", [id]);
      }
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "user-contact-synthetic-session-key");
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
      vi.stubEnv("PRODAMUS_TEST_PAYFORM_URL", "https://testpage1.payform.ru");
      vi.stubEnv("PRODAMUS_TEST_SECRET", "c".repeat(64));
      vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    }, 45_000);
    beforeEach(async () => {
      // Independent checkout scenarios must not share a rate-limit window.
      vi.setSystemTime(Date.now() + 16 * 60_000);
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,email,passwordHash,role,contactPhone) VALUES(989701,'user-contact-owner',?,'unchanged-hash','admin',?),(989702,'user-contact-other',?,'other-hash','user',NULL)",
        [email, original, otherEmail],
      );
      token = await sdk.createSessionToken("user-contact-owner", {
        sessionVersion: 0,
      });
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.useRealTimers();
      vi.unstubAllEnvs();
    });
    function liveCheckout() {
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "false");
      vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
      vi.stubEnv("PRODAMUS_SECRET", "synthetic-merchant-key");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "123");
    }
    it.each(["TEST", "LIVE"])(
      "stores a new guest contact only on the unpaid order (%s)",
      async (mode) => {
        if (mode === "LIVE") liveCheckout();
        const result = await create(undefined, "8 (999) 123-45-67", freshEmail);
        expect(result.user).toBeNull();
        expect(
          await rows(
            "SELECT email,contactPhone,phone,passwordHash FROM users WHERE email=?",
            [freshEmail],
          ),
        ).toEqual([
          {
            email: freshEmail,
            contactPhone: null,
            phone: null,
            passwordHash: null,
          },
        ]);
        expect(
          await rows(
            "SELECT email,contactPhone FROM club_payments WHERE email=?",
            [freshEmail],
          ),
        ).toEqual([{ email: freshEmail, contactPhone: phone }]);
        expect(new URL(result.url).searchParams.has("customer_phone")).toBe(
          false,
        );
      },
    );
    it.each([email, otherEmail])(
      "a guest cannot overwrite an existing user's contact (%s)",
      async (recipient) => {
        const before = await rows("SELECT * FROM users WHERE email=?", [
          recipient,
        ]);
        await create(undefined, phone, recipient);
        expect(
          await rows("SELECT * FROM users WHERE email=?", [recipient]),
        ).toEqual(before);
        expect(
          await rows("SELECT contactPhone FROM club_payments WHERE email=?", [
            recipient,
          ]),
        ).toEqual([{ contactPhone: phone }]);
      },
    );
    it.each(["TEST", "LIVE"])(
      "updates only the authenticated owner contact and keeps credentials and roles (%s)",
      async (mode) => {
        if (mode === "LIVE") liveCheckout();
        const before = await rows(
          "SELECT email,phone,passwordHash,role,sessionVersion FROM users ORDER BY id",
        );
        await create(token);
        expect(
          await rows("SELECT contactPhone FROM users WHERE id=989701"),
        ).toEqual([{ contactPhone: phone }]);
        expect(
          await rows("SELECT contactPhone FROM users WHERE id=989702"),
        ).toEqual([{ contactPhone: null }]);
        expect(
          await rows(
            "SELECT email,phone,passwordHash,role,sessionVersion FROM users ORDER BY id",
          ),
        ).toEqual(before);
      },
    );
    it("rejects changing the contact of a different email even with an authenticated session", async () => {
      await expect(create(token, phone, otherEmail)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      });
      const actor = (await getUserByEmail(email))!;
      await expect(
        createClubPayment({
          userId: 989702,
          email: otherEmail,
          orderId: `fixture-${randomUUID()}`,
          contactPhone: phone,
          contactActor: actor,
          sum: "790.00",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        await rows("SELECT contactPhone FROM users WHERE id=989702"),
      ).toEqual([{ contactPhone: null }]);
    });
    it("does not expose the contact in public session responses, but returns it to admin members", async () => {
      await create(token);
      const me = await fetch(base + "/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(me.status).toBe(200);
      expect((await me.json()).user).not.toHaveProperty("contactPhone");
      const page = await client(token).admin.membersPage.query({
        userId: 989701,
      });
      expect(page.items[0]).toMatchObject({ email, contactPhone: phone });
      const ordinaryToken = await sdk.createSessionToken("user-contact-other", {
        sessionVersion: 0,
      });
      await expect(
        client(ordinaryToken).admin.membersPage.query({ userId: 989701 }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    });
    it("rolls back the authenticated contact when payment insertion fails", async () => {
      await conn.query(`CREATE TRIGGER owned_contact_payment_failure BEFORE INSERT ON club_payments FOR EACH ROW
      BEGIN IF NEW.userId=989701 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic contact payment failure'; END IF; END`);
      await expect(create(token)).rejects.toThrow();
      expect(
        await rows("SELECT contactPhone FROM users WHERE id=989701"),
      ).toEqual([{ contactPhone: original }]);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=989701"),
      ).toEqual([]);
    });
    it("allows a guest order to use the same unverified contact as another account", async () => {
      await create(token);
      await create(undefined, phone, freshEmail);
      expect(
        await rows("SELECT email FROM users WHERE contactPhone=?", [phone]),
      ).toEqual([{ email }]);
      expect(
        await rows("SELECT contactPhone FROM club_payments WHERE email=?", [freshEmail]),
      ).toEqual([{ contactPhone: phone }]);
    });
    it("creates one recipient for concurrent email resolution without a contact", async () => {
      await Promise.all([
        ensureUserByEmail(freshEmail),
        ensureUserByEmail(freshEmail),
      ]);
      expect(
        await rows("SELECT contactPhone FROM users WHERE email=?", [
          freshEmail,
        ]),
      ).toEqual([{ contactPhone: null }]);
    });
    it.each([
      "blockedAt=CURRENT_TIMESTAMP",
      "accountDeletionRequestedAt=CURRENT_TIMESTAMP",
      "sessionVersion=1",
    ])(
      "rejects a stale authenticated actor before changing contact (%s)",
      async (mutation) => {
        const actor = (await getUserByEmail(email))!;
        await conn.query(`UPDATE users SET ${mutation} WHERE id=989701`);
        await expect(
          createClubPayment({
            userId: actor.id,
            email,
            orderId: `fixture-${randomUUID()}`,
            contactPhone: phone,
            contactActor: actor,
            sum: "790.00",
          }),
        ).rejects.toMatchObject({
          code: mutation === "sessionVersion=1" ? "UNAUTHORIZED" : "FORBIDDEN",
        });
        expect(
          await rows("SELECT contactPhone FROM users WHERE id=989701"),
        ).toEqual([{ contactPhone: original }]);
      },
    );
  },
);
