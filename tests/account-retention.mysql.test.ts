import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { getDb } from "../apps/backend/src/db";
import { processScheduledAccountDeletions } from "../apps/backend/src/platform-db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import { WORKER_OPERATIONS, type WorkerOperations } from "../apps/backend/src/workers/worker-operations";

describe.skipIf(!testDatabaseUrl)("account retention on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "retention-http-synthetic-secret-32");
    await conn.query(`CREATE TABLE IF NOT EXISTS pen_pal_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL UNIQUE,fullName VARCHAR(128),
      city VARCHAR(128) NOT NULL,interests JSON NOT NULL,address TEXT NOT NULL,
      adultConsentAt TIMESTAMP NULL,consentVersion VARCHAR(32),active BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await conn.query(`CREATE TABLE IF NOT EXISTS pen_pal_matches (
      id INT AUTO_INCREMENT PRIMARY KEY,userLowId INT NOT NULL,userHighId INT NOT NULL,
      initiatedBy INT NOT NULL,userLowConfirmed BOOLEAN DEFAULT FALSE,userHighConfirmed BOOLEAN DEFAULT FALSE,
      mutualConfirmedAt TIMESTAMP NULL,confirmDeadline TIMESTAMP NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(userLowId,userHighId)
    ) ENGINE=InnoDB`);
    await conn.query(`CREATE TABLE IF NOT EXISTS pen_pal_shown (
      id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,matchUserId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(userId,matchUserId)
    ) ENGINE=InnoDB`);
    await conn.query(`CREATE TABLE IF NOT EXISTS push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,token VARCHAR(256) NOT NULL UNIQUE,userId INT NULL,
      platform VARCHAR(16),enabled BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM pen_pal_matches WHERE userLowId=92101");
    await conn.query("DELETE FROM pen_pal_shown WHERE userId=92101 OR matchUserId=92101");
    for (const table of ["club_payments", "pen_pal_profiles", "post_comments", "likes", "saved_posts", "push_tokens"])
      await conn.query(`DELETE FROM ${table} WHERE userId BETWEEN 92101 AND 92104`);
    await conn.query("DELETE FROM comment_reports WHERE reporterUserId=92101");
    await conn.query("DELETE FROM users WHERE id BETWEEN 92101 AND 92104");
    await conn.query(`INSERT INTO users (id,openId,name,email,passwordHash,accountDeletionRequestedAt) VALUES
      (92101,'retention-fixture','Fixture name','retention@example.test','fixture-hash',DATE_SUB(NOW(),INTERVAL 31 DAY)),
      (92102,'retention-neighbor','Neighbor name','neighbor@example.test','neighbor-hash',NULL)`);
    await conn.query(`INSERT INTO pen_pal_profiles (userId,fullName,city,interests,address,active)
      VALUES (92101,'Fixture name','Fixture city',JSON_ARRAY('fixture interest'),'Fixture address',TRUE)`);
    await conn.query(`INSERT INTO pen_pal_matches (userLowId,userHighId,initiatedBy,confirmDeadline)
      VALUES (92101,92102,92101,DATE_ADD(NOW(),INTERVAL 1 DAY))`);
    await conn.query("INSERT INTO pen_pal_shown (userId,matchUserId) VALUES (92101,92102),(92102,92101)");
    await conn.query("INSERT INTO post_comments (postId,userId,text,photos) VALUES (92100,92101,'Fixture personal text',JSON_ARRAY('https://example.test/photo'))");
    await conn.query("INSERT INTO likes (userId,postId) VALUES (92101,92100)");
    await conn.query("INSERT INTO saved_posts (userId,postId) VALUES (92101,92100)");
    // This fixture tests token removal, not delivery; keep it out of the other
    // concurrently running suite's global push audiences.
    await conn.query("INSERT INTO push_tokens (token,userId,enabled) VALUES ('retention-fixture-token',92101,FALSE)");
    await conn.query("INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (92100,92101,'Fixture report')");
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await conn?.query("DELETE FROM push_tokens WHERE token='retention-fixture-token'");
    await conn?.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id BETWEEN 92101 AND 92104");
    await conn?.end();
    const database = await getDb();
    await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  async function snapshot() {
    const [[user], [profile], [comments], [matches], [shown], [activity]] = await Promise.all([
      conn.query<RowDataPacket[]>("SELECT openId,name,email,passwordHash,accountDeletionRequestedAt FROM users WHERE id=92101"),
      conn.query<RowDataPacket[]>("SELECT fullName,city,interests,address,active FROM pen_pal_profiles WHERE userId=92101"),
      conn.query<RowDataPacket[]>("SELECT text,photos FROM post_comments WHERE userId=92101"),
      conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM pen_pal_matches WHERE userLowId=92101"),
      conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM pen_pal_shown WHERE userId=92101 OR matchUserId=92101"),
      conn.query<RowDataPacket[]>(`SELECT
        (SELECT COUNT(*) FROM likes WHERE userId=92101) likes,
        (SELECT COUNT(*) FROM saved_posts WHERE userId=92101) saves,
        (SELECT COUNT(*) FROM push_tokens WHERE userId=92101) pushes,
        (SELECT COUNT(*) FROM comment_reports WHERE reporterUserId=92101) reports`),
    ]);
    return { user, profile, comments, matches, shown, activity };
  }
  it("rolls back every scrub operation when the final account update fails", async () => {
    const before = await snapshot();
    await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
      BEGIN IF OLD.id=92101 AND NEW.email IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture final cleanup failure'; END IF; END`);
    try {
      await expect(processScheduledAccountDeletions()).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally { await conn.query("DROP TRIGGER backend_test_retention_failure"); }
  });
  it("completes eligible scrubbing once and retains the discussion structure", async () => {
    expect(await processScheduledAccountDeletions()).toBe(1);
    const state = await snapshot();
    expect(state.user[0]).toMatchObject({ name: "Удалённый аккаунт", email: null, passwordHash: null, accountDeletionRequestedAt: null });
    expect(state.profile[0]).toMatchObject({ fullName: "Удалённый аккаунт", city: "Удалённый аккаунт", address: "Удалённый аккаунт", active: 0 });
    expect(state.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
    expect(state.matches).toEqual([{ n: 0 }]);
    expect(state.shown).toEqual([{ n: 0 }]);
    expect(state.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);
    expect(await processScheduledAccountDeletions()).toBe(0);
  });
  it.each(["active", "expired-in-grace", "recent-request", "no-request"])("preserves %s accounts", async condition => {
    if (condition === "active" || condition === "expired-in-grace")
      await conn.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt)
        VALUES (92101,'retention-fixture-paid','paid',${condition === "active" ? "DATE_ADD(NOW(),INTERVAL 1 DAY)" : "DATE_SUB(NOW(),INTERVAL 29 DAY)"})`);
    if (condition === "recent-request") await conn.query("UPDATE users SET accountDeletionRequestedAt=NOW() WHERE id=92101");
    if (condition === "no-request") await conn.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=92101");
    const before = await snapshot();
    expect(await processScheduledAccountDeletions()).toBe(0);
    expect(await snapshot()).toEqual(before);
  });
  it("two workers count an eligible account only once", async () => {
    const result = await Promise.all([processScheduledAccountDeletions(), processScheduledAccountDeletions()]);
    expect(result.reduce((sum, count) => sum + count, 0)).toBe(1);
  });
  it("rechecks a renewal committed while cleanup waits for the billing owner lock", async () => {
    const guard = await openContentTestDatabase();
    let running: Promise<number> | undefined;
    const before = await snapshot();
    try {
      await guard.beginTransaction();
      await guard.query("SELECT id FROM users WHERE id=92101 FOR UPDATE");
      running = processScheduledAccountDeletions();
      // Observe the real lock wait; no arbitrary delay or mocked repository.
      await vi.waitFor(async () => {
        const [waiting] = await conn.query<RowDataPacket[]>(`SELECT 1 FROM performance_schema.data_lock_waits w
          JOIN performance_schema.data_locks b ON b.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID
          WHERE b.OBJECT_SCHEMA=DATABASE() AND b.OBJECT_NAME='users' AND b.LOCK_DATA='92101'`);
        expect(waiting.length).toBeGreaterThan(0);
      }, { timeout: 3000, interval: 20 });
      await guard.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt)
        VALUES (92101,'retention-fixture-renewal','paid',DATE_ADD(NOW(),INTERVAL 31 DAY))`);
      await guard.commit();
      expect(await running).toBe(0);
      expect(await snapshot()).toEqual(before);
    } finally {
      await guard.rollback();
      await running;
      await guard.end();
    }
  });

  // Global maintenance is opt-in and must run alone on a fresh disposable DB.
  describe.skipIf(process.env.BACKEND_RETENTION_WORKER_ACCEPTANCE !== "1")(
    "native maintenance lifecycle and HTTP deletion requests",
    () => {
      it.each(["recent-request", "eligible", "active-club", "club-grace"])(
        "preserves existing retention rules for %s",
        async condition => {
          await conn.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=92101");
          const [neighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
          const app = await createBackendApplication();
          let jobs: WorkerJobs | undefined;
          try {
            jobs = app.get<WorkerJobs>(WorkerJobs);
            await app.listen(0, "127.0.0.1");
            const port = (app.getHttpServer().address() as AddressInfo).port;
            const client = createTRPCProxyClient<AppRouter>({ links: [httpLink({
              url: `http://127.0.0.1:${port}/api/trpc`, transformer: superjson,
              headers: async () => ({ Authorization: `Bearer ${await sdk.createSessionToken("retention-fixture", { sessionVersion: 0 })}` }),
            })] });
            expect(await client.profileExtras.requestAccountDeletion.mutate()).toEqual({ ok: true });
            const requested = await snapshot();
            expect(requested.user[0]).toMatchObject({ email: "retention@example.test", accountDeletionRequestedAt: expect.any(Date) });
            if (condition !== "recent-request")
              await conn.query("UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=92101");
            if (condition === "active-club" || condition === "club-grace")
              await conn.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES
                (92101,'retention-worker-paid','paid',${condition === "active-club" ? "DATE_ADD(NOW(),INTERVAL 1 DAY)" : "DATE_SUB(NOW(),INTERVAL 29 DAY)"})`);
            const before = await snapshot();
            const operations = app.get<WorkerOperations>(WORKER_OPERATIONS);
            // Only unrelated effects are doubled. The maintenance callback keeps
            // the canonical real SQL implementation; no mail/provider/backup runs.
            vi.spyOn(operations, "publishDueScheduledPosts").mockResolvedValue([]);
            vi.spyOn(operations, "getDb").mockResolvedValue(null);
            vi.spyOn(operations, "processPendingShopDeliveryEmails").mockResolvedValue(undefined);
            vi.spyOn(operations, "runMysqlBackupIfDue").mockResolvedValue(undefined);
            const maintain = operations.runDataRetentionMaintenance;
            let completed = false;
            vi.spyOn(operations, "runDataRetentionMaintenance").mockImplementation(async () => {
              await maintain();
              completed = true;
            });
            jobs.start();
            // Completion barrier, not evidence of scrubbing; persisted rows below
            // must independently distinguish real cleanup from a successful no-op.
            await vi.waitFor(() => expect(completed).toBe(true), { timeout: 3000 });
            if (condition === "eligible") {
              const state = await snapshot();
              expect(state.user[0]).toMatchObject({ name: "Удалённый аккаунт", email: null, passwordHash: null, accountDeletionRequestedAt: null });
              expect(state.profile[0]).toMatchObject({ active: 0, address: "Удалённый аккаунт" });
              expect(state.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
              expect(state.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);
            } else expect(await snapshot()).toEqual(before);
            const [afterNeighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
            expect(afterNeighbors).toEqual(neighbors);
          } finally {
            await Promise.all((jobs?.stop() ?? []).map(job => job.settled));
            await app.close();
          }
        },
      );
      it("recovers atomic account cleanup on the next maintenance tick after a SQL failure", async () => {
        const before = await snapshot();
        const [neighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
        const app = await createBackendApplication();
        let jobs: WorkerJobs | undefined;
        try {
          jobs = app.get<WorkerJobs>(WorkerJobs);
          await app.listen(0, "127.0.0.1");
          const operations = app.get<WorkerOperations>(WORKER_OPERATIONS);
          vi.spyOn(operations, "publishDueScheduledPosts").mockResolvedValue([]);
          vi.spyOn(operations, "getDb").mockResolvedValue(null);
          vi.spyOn(operations, "processPendingShopDeliveryEmails").mockResolvedValue(undefined);
          vi.spyOn(operations, "runMysqlBackupIfDue").mockResolvedValue(undefined);
          const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
          const maintain = operations.runDataRetentionMaintenance;
          const outcomes: string[] = [];
          vi.spyOn(operations, "runDataRetentionMaintenance").mockImplementation(async () => {
            try {
              await maintain();
              outcomes.push("success");
            } catch (error) {
              outcomes.push("failure");
              throw error;
            }
          });
          await conn.query(`CREATE TRIGGER backend_test_retention_failure BEFORE UPDATE ON users FOR EACH ROW
            BEGIN IF OLD.id=92101 AND NEW.email IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic retention private SQL detail'; END IF; END`);
          // Advance scheduler intervals only; real SQL, clocks and waiting
          // remain untouched. No five-minute wall-clock delay or new retry policy.
          vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
          jobs.start();
          await vi.waitFor(() => expect(outcomes).toEqual(["failure"]), { timeout: 3000 });
          expect(await snapshot()).toEqual(before);
          expect(warnings.mock.calls).toEqual([["[workers] maintenance failed"]]);

          await conn.query("DROP TRIGGER backend_test_retention_failure");
          await vi.advanceTimersByTimeAsync(300_000);
          await vi.waitFor(() => expect(outcomes).toEqual(["failure", "success"]), { timeout: 3000 });
          const scrubbed = await snapshot();
          expect(scrubbed.user[0]).toMatchObject({ email: null, passwordHash: null, accountDeletionRequestedAt: null });
          expect(scrubbed.profile[0]).toMatchObject({ active: 0, address: "Удалённый аккаунт" });
          expect(scrubbed.comments).toEqual([{ text: "Комментарий удалён", photos: null }]);
          expect(scrubbed.matches).toEqual([{ n: 0 }]);
          expect(scrubbed.shown).toEqual([{ n: 0 }]);
          expect(scrubbed.activity).toEqual([{ likes: 0, saves: 0, pushes: 0, reports: 0 }]);

          await vi.advanceTimersByTimeAsync(300_000);
          await vi.waitFor(() => expect(outcomes).toEqual(["failure", "success", "success"]), { timeout: 3000 });
          expect(await snapshot()).toEqual(scrubbed);
          const [afterNeighbors] = await conn.query<RowDataPacket[]>("SELECT * FROM users WHERE id=92102");
          expect(afterNeighbors).toEqual(neighbors);
          expect(warnings.mock.calls).toEqual([["[workers] maintenance failed"]]);
        } finally {
          await Promise.all((jobs?.stop() ?? []).map(job => job.settled));
          vi.useRealTimers();
          await app.close();
          await conn.query("DROP TRIGGER IF EXISTS backend_test_retention_failure");
        }
      });
    },
  );
});
