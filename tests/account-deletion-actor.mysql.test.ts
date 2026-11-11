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
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { closeDb } from "../apps/backend/src/database/connection";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { processScheduledAccountDeletions } from "../apps/backend/src/identity/account-retention";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

// Actual local HTTP/JWT/SQL. No workers, external mail, payments or object storage.
describe.skipIf(!testDatabaseUrl)(
  "account deletion actor and replay guards",
  () => {
    const owner = 989701,
      neighbor = 989702;
    let conn: Connection,
      app: Awaited<ReturnType<typeof createBackendApplication>>,
      base: string,
      token: string;
    const cleanup = async () => {
      await conn.query("DELETE FROM billing_profiles WHERE userId IN (?,?)", [owner, neighbor]);
      await conn.query("DELETE FROM users WHERE id IN (?,?)", [owner, neighbor]);
    };
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "account-deletion-fixture-signing-secret-32");
      vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true");
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("deletion-actor-fixture", {
        sessionVersion: 2,
      });
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,name,email,sessionVersion,lastSignedIn) VALUES (?,'deletion-actor-fixture','Owner','deletion-owner@example.test',2,NOW()),(?,'deletion-neighbor-fixture','Neighbor','deletion-neighbor@example.test',0,NOW())",
        [owner, neighbor],
      );
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      await app?.close();
      if (conn) await cleanup();
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    const request = (bearer = token) =>
      fetch(base + "/api/trpc/profileExtras.requestAccountDeletion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { Authorization: "Bearer " + bearer } : {}),
        },
        body: JSON.stringify({ json: null }),
        signal: AbortSignal.timeout(10000),
      });
    const read = async () =>
      (
        await conn.query<RowDataPacket[]>(
          "SELECT id,openId,name,email,sessionVersion,blockedAt,accountDeletionRequestedAt FROM users WHERE id IN (?,?) ORDER BY id",
          [owner, neighbor],
        )
      )[0];

    it.each([
      {
        change: "epoch",
        update: "sessionVersion=sessionVersion+1",
        status: 401,
      },
      { change: "block", update: "blockedAt=NOW()", status: 403 },
      {
        change: "identity",
        update: "openId='deletion-replaced-fixture'",
        status: 401,
      },
    ])(
      "refuses an in-flight deletion after $change changes",
      async ({ update, status }) => {
        const control = await mysql.createConnection({
          uri: testDatabaseUrl!,
          timezone: "Z",
        });
        let pending: Promise<Response> | undefined;
        try {
          await control.beginTransaction();
          await control.query("SELECT id FROM users WHERE id=? FOR UPDATE", [
            owner,
          ]);
          pending = request();
          await expect
            .poll(
              async () => {
                const [waiting] = await conn.query<RowDataPacket[]>(
                  "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                  [control.threadId],
                );
                return waiting[0].n;
              },
              { timeout: 5000, interval: 30 },
            )
            .toBeGreaterThan(0);
          await control.query(`UPDATE users SET ${update} WHERE id=?`, [owner]);
          await control.commit();
          const before = await read();
          expect((await pending).status).toBe(status);
          expect(await read()).toEqual(before);
          expect(before[0].accountDeletionRequestedAt).toBeNull();
        } finally {
          await control.rollback();
          await control.end();
          await pending
            ?.then((response) => response.body?.cancel())
            .catch(() => {});
        }
      },
    );
    it("preserves the first deletion date on replay instead of postponing retention", async () => {
      await conn.query(
        "UPDATE users SET accountDeletionRequestedAt='2026-10-30 10:00:00' WHERE id=?",
        [owner],
      );
      const before = await read();
      expect((await request()).status).toBe(200);
      expect(await read()).toEqual(before);
    });
    it("does not mark an already retired account for deletion again", async () => {
      let enter!: () => void, release!: () => void;
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const service = app.get(ProfileService),
        original = service.requestAccountDeletion.bind(service);
      vi.spyOn(service, "requestAccountDeletion").mockImplementation(
        async (...args) => {
          enter();
          await gate;
          return original(...args);
        },
      );
      const pending = request();
      try {
        await entered;
        await conn.query(
          "UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=?",
          [owner],
        );
        expect(await processScheduledAccountDeletions()).toBe(1);
        const before = await read();
        expect(before[0]).toMatchObject({
          email: null,
          sessionVersion: 3,
          accountDeletionRequestedAt: null,
        });
        release();
        expect((await pending).status).toBe(401);
        expect(await read()).toEqual(before);
      } finally {
        release();
        await pending
          .then((response) => response.body?.cancel())
          .catch(() => {});
      }
    });
    it("records a current user's request while preserving the account and neighbor", async () => {
      const before = await read();
      const response = await request();
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        result: { data: { json: { ok: true } } },
      });
      expect(await read()).toEqual([
        { ...before[0], accountDeletionRequestedAt: expect.any(Date) },
        before[1],
      ]);
    });
    it("queues only the owner's active billing profile and preserves the retry schedule", async () => {
      await conn.query(`INSERT INTO billing_profiles
        (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor,cancelledAt)
        VALUES ('deletion-active',?,'fixture.payform.ru','123','1','deletion-owner@example.test',79000,NULL),
        ('deletion-closed',?,'fixture.payform.ru','123','2','deletion-owner@example.test',79000,NOW()),
        ('deletion-neighbor',?,'fixture.payform.ru','123','3','deletion-neighbor@example.test',79000,NULL)`,
        [owner, owner, neighbor]);
      expect((await request()).status).toBe(200);
      const [profiles] = await conn.query<RowDataPacket[]>(
        "SELECT profileKey,cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId IN (?,?) ORDER BY profileKey",
        [owner, neighbor],
      );
      expect(profiles).toEqual([
        { profileKey: "deletion-active", cancelRequestedAt: expect.any(Date), cancelledAt: null },
        { profileKey: "deletion-closed", cancelRequestedAt: null, cancelledAt: expect.any(Date) },
        { profileKey: "deletion-neighbor", cancelRequestedAt: null, cancelledAt: null },
      ]);
      await conn.query("UPDATE billing_profiles SET nextAttemptAt='2026-11-30 10:00:00' WHERE profileKey='deletion-active'");
      const before = await read();
      expect((await request()).status).toBe(200);
      expect(await read()).toEqual(before);
      const [[retry]] = await conn.query<RowDataPacket[]>(
        "SELECT cancelRequestedAt,nextAttemptAt FROM billing_profiles WHERE profileKey='deletion-active'",
      );
      expect(retry).toEqual({
        cancelRequestedAt: profiles[0].cancelRequestedAt,
        nextAttemptAt: new Date("2026-11-30T10:00:00Z"),
      });
    });
    it("rejects a guest without changing either account", async () => {
      const before = await read();
      expect((await request("")).status).toBe(401);
      expect(await read()).toEqual(before);
    });
  },
);
