import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";
import {
  getDb,
  listAdminMembers,
  listAdminPayments,
} from "../apps/backend/src/db";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)(
  "admin membership read projections on disposable MySQL",
  () => {
    let connection: Connection;
    let application: INestApplication;
    let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;

    beforeAll(async () => {
      connection = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "synthetic-admin-read-jwt-secret-32");
      await connection.query(`INSERT INTO users (id,openId,email,name,role,createdAt,passwordHash) VALUES
      (92520,'admin-read-owner',NULL,NULL,'admin','2025-01-01','synthetic-not-a-password'),
      (92521,'admin-read-member','admin-read-member@example.test','Member','user','2025-02-01','synthetic-not-a-password'),
      (92522,'admin-read-empty',NULL,NULL,'moderator','2025-03-01','synthetic-not-a-password')`);
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      const port = (application.getHttpServer().address() as AddressInfo).port;
      const token = await sdk.createSessionToken("admin-read-owner", {
        sessionVersion: 0,
      });
      client = createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `http://127.0.0.1:${port}/api/trpc`,
            transformer: superjson,
            headers: { Authorization: `Bearer ${token}` },
          }),
        ],
      });
    });
    beforeEach(async () => {
      await connection.query(
        "DELETE FROM club_payments WHERE userId IN (92520,92521,92522)",
      );
      await connection.query(
        "UPDATE users SET blockedAt=NULL,blockedReason=NULL WHERE id=92521",
      );
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      await application?.close();
      if (connection) {
        await connection.query(
          "DELETE FROM club_payments WHERE userId IN (92520,92521,92522)",
        );
        await connection.query(
          "DELETE FROM users WHERE id IN (92520,92521,92522)",
        );
        await connection.end();
      }
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });

    it("returns the same safe member fields and newest-account order over native HTTP", async () => {
      await connection.query(
        "UPDATE users SET blockedAt='2025-04-01',blockedReason='synthetic reason' WHERE id=92521",
      );
      const members = (await client.admin.members.query()).filter((row) =>
        [92520, 92521, 92522].includes(row.id),
      );
      expect(members.map((row) => row.id)).toEqual([92522, 92521, 92520]);
      expect(members[0]).toEqual({
        id: 92522,
        email: null,
        name: null,
        role: "moderator",
        createdAt: new Date("2025-03-01T00:00:00Z"),
        blockedAt: null,
        blockedReason: null,
        clubExpiresAt: null,
      });
      expect(members[1]).toEqual({
        id: 92521,
        email: "admin-read-member@example.test",
        name: "Member",
        role: "user",
        createdAt: new Date("2025-02-01T00:00:00Z"),
        blockedAt: new Date("2025-04-01T00:00:00Z"),
        blockedReason: "synthetic reason",
        clubExpiresAt: null,
      });
      expect(
        members.every(
          (row) =>
            !Object.hasOwn(row, "passwordHash") &&
            !Object.hasOwn(row, "openId"),
        ),
      ).toBe(true);
    });

    it("uses only the latest future paid expiry rather than later pending or failed rows", async () => {
      await connection.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES
      (92521,'admin-read-paid-late','paid','2028-02-01'),
      (92521,'admin-read-paid-early','paid','2028-01-01'),
      (92521,'admin-read-pending','pending','2029-01-01'),
      (92521,'admin-read-failed','failed','2029-02-01'),
      (92521,'admin-read-paid-null','paid',NULL),
      (92522,'admin-read-expired','paid','2025-01-01')`);
      // Only the read-time clock is fixed; database/projection code is real.
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2027-01-01T00:00:00Z").getTime(),
      );
      const members = await listAdminMembers();
      expect(members.find((row) => row.id === 92521)?.clubExpiresAt).toEqual(
        new Date("2028-02-01T00:00:00Z"),
      );
      expect(members.find((row) => row.id === 92522)?.clubExpiresAt).toBeNull();
    });

    it("does not report an expiry exactly at now or a paid row without expiry as current access", async () => {
      await connection.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES
      (92521,'admin-read-boundary','paid','2027-01-01'),
      (92521,'admin-read-null','paid',NULL)`);
      vi.spyOn(Date, "now").mockReturnValue(
        new Date("2027-01-01T00:00:00Z").getTime(),
      );
      expect(
        (await listAdminMembers()).find((row) => row.id === 92521)
          ?.clubExpiresAt,
      ).toBeNull();
    });

    it("preserves payment history statuses, newest-first ordering and the default 50-row limit", async () => {
      for (let index = 0; index < 52; index++) {
        await connection.query(
          `INSERT INTO club_payments
        (userId,orderId,email,sum,status,createdAt,paidAt,expiresAt,cancelAtPeriodEnd,cancelledAt)
        VALUES (92521,?,'admin-read-member@example.test','123.45',?,?,NULL,NULL,TRUE,'2025-06-01')`,
          [
            `admin-read-history-${index}`,
            ["pending", "paid", "failed"][index % 3],
            new Date(Date.UTC(2030, 0, 1, 0, 0, index)),
          ],
        );
      }
      const history = await client.admin.payments.query();
      expect(history).toHaveLength(50);
      expect(history.map((row) => row.orderId)).toEqual(
        Array.from(
          { length: 50 },
          (_, index) => `admin-read-history-${51 - index}`,
        ),
      );
      expect(history.slice(0, 3).map((row) => row.status)).toEqual([
        "pending",
        "failed",
        "paid",
      ]);
      expect(history[0]).toMatchObject({
        userId: 92521,
        email: "admin-read-member@example.test",
        sum: "123.45",
        paidAt: null,
        expiresAt: null,
        cancelAtPeriodEnd: true,
        cancelledAt: new Date("2025-06-01T00:00:00Z"),
        createdAt: new Date("2030-01-01T00:00:51Z"),
      });
      expect(Object.keys(history[0]).sort()).toEqual([
        "cancelAtPeriodEnd",
        "cancelledAt",
        "createdAt",
        "email",
        "expiresAt",
        "id",
        "orderId",
        "paidAt",
        "status",
        "sum",
        "updatedAt",
        "userId",
      ]);
      expect((await listAdminPayments(2)).map((row) => row.orderId)).toEqual([
        "admin-read-history-51",
        "admin-read-history-50",
      ]);
      expect(await listAdminPayments(0)).toEqual([]);
    });
  },
);
