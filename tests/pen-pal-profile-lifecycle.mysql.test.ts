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
import { closeDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { processScheduledAccountDeletions } from "../apps/backend/src/identity/account-retention";
import {
  PEN_PAL_ADULT_CONSENT_LABEL,
  PEN_PAL_CONSENT_VERSION,
} from "../packages/shared/src/pen-pals";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

// Captured real actors/router/SQL and actual HTTP/JWT. No external integrations.
describe.skipIf(!testDatabaseUrl)(
  "Pen Pals profile actor and consent lifecycle",
  () => {
    const owner = 991101,
      neighbor = 991102;
    const input = {
      fullName: "New synthetic name",
      interests: ["Сад", "Книги"],
      address: "New synthetic postal address",
      adultConsent: true as const,
    };
    let conn: Connection,
      app: Awaited<ReturnType<typeof createBackendApplication>>,
      base: string,
      token: string;
    async function cleanup() {
      await conn.query(
        "DELETE FROM pen_pal_matches WHERE userLowId IN (?,?) OR userHighId IN (?,?)",
        [owner, neighbor, owner, neighbor],
      );
      for (const table of [
        "pen_pal_shown",
        "pen_pal_profiles",
        "user_consent_events",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId IN (?,?)`, [
          owner,
          neighbor,
        ]);
      await conn.query("DELETE FROM users WHERE id IN (?,?)", [
        owner,
        neighbor,
      ]);
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "pen-pal-profile-lifecycle-only-signing-secret-32",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true");
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("pen-profile-lifecycle-owner", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      vi.stubEnv("ENABLE_PEN_PALS", "true");
      await conn.query("DROP TRIGGER IF EXISTS pen_profile_consent_refusal");
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,name,email,lastSignedIn) VALUES (?,'pen-profile-lifecycle-owner','Owner','pen-lifecycle-owner@example.test',NOW()),(?,'pen-profile-lifecycle-neighbor','Neighbor','pen-lifecycle-neighbor@example.test',NOW())",
        [owner, neighbor],
      );
      for (const id of [owner, neighbor])
        await conn.query(
          "INSERT INTO pen_pal_profiles(userId,fullName,city,interests,address,adultConsentAt,consentVersion,active) VALUES (?,'Original synthetic name','Synthetic',JSON_ARRAY('Сад','Книги'),'Original synthetic postal address',NOW(),?,TRUE)",
          [id, PEN_PAL_CONSENT_VERSION],
        );
      await conn.query(
        "INSERT INTO pen_pal_matches(userLowId,userHighId,initiatedBy,userLowConfirmed,userHighConfirmed,confirmDeadline) VALUES (?,?,?,TRUE,FALSE,DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [owner, neighbor, owner],
      );
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await conn.query("DROP TRIGGER IF EXISTS pen_profile_consent_refusal");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) await cleanup();
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    async function capturedCaller() {
      return appRouter.createCaller({
        user: (await getUserByOpenId("pen-profile-lifecycle-owner"))!,
        req: {},
        res: {},
      } as TrpcContext);
    }
    const snapshot = async () => {
      const [users] = await conn.query<RowDataPacket[]>(
        "SELECT id,openId,email,sessionVersion,blockedAt,accountDeletionRequestedAt FROM users WHERE id IN (?,?) ORDER BY id",
        [owner, neighbor],
      );
      const [profiles] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM pen_pal_profiles WHERE userId IN (?,?) ORDER BY userId",
        [owner, neighbor],
      );
      const [matches] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM pen_pal_matches WHERE userLowId=? ORDER BY id",
        [owner],
      );
      const [consents] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM user_consent_events WHERE userId IN (?,?) ORDER BY id",
        [owner, neighbor],
      );
      return { users, profiles, matches, consents };
    };
    const http = (operation: "upsert" | "remove", bearer = token) =>
      fetch(base + "/api/trpc/penPals." + operation, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(bearer ? { authorization: "Bearer " + bearer } : {}),
        },
        body: JSON.stringify({ json: operation === "upsert" ? input : null }),
        signal: AbortSignal.timeout(10000),
      });
    it.each(["upsert", "remove"] as const)(
      "%s rechecks the actor after a real SQL owner-lock wait",
      async (operation) => {
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
          pending = http(operation);
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
          await control.query(
            "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=?",
            [owner],
          );
          await control.commit();
          const before = await snapshot();
          expect((await pending).status).toBe(401);
          expect(await snapshot()).toEqual(before);
        } finally {
          await control.rollback();
          await control.end();
          await pending
            ?.then((response) => response.body?.cancel())
            .catch(() => {});
        }
      },
    );
    it.each(["upsert", "remove"] as const)(
      "%s refuses a context after session revocation",
      async (operation) => {
        const caller = await capturedCaller();
        await conn.query(
          "UPDATE users SET sessionVersion=sessionVersion+1 WHERE id=?",
          [owner],
        );
        const before = await snapshot();
        await expect(
          operation === "upsert"
            ? caller.penPals.upsert(input)
            : caller.penPals.remove(),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        expect(await snapshot()).toEqual(before);
      },
    );
    it.each([
      { operation: "upsert", change: "blocked", code: "FORBIDDEN" },
      { operation: "remove", change: "blocked", code: "FORBIDDEN" },
      { operation: "upsert", change: "identity", code: "UNAUTHORIZED" },
      { operation: "remove", change: "identity", code: "UNAUTHORIZED" },
      { operation: "upsert", change: "retired", code: "UNAUTHORIZED" },
      { operation: "remove", change: "retired", code: "UNAUTHORIZED" },
    ] as const)(
      "$operation refuses an actor after $change",
      async ({ operation, change, code }) => {
        const caller = await capturedCaller();
        if (change === "blocked")
          await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=?", [
            owner,
          ]);
        else if (change === "identity")
          await conn.query(
            "UPDATE users SET openId='pen-profile-replaced-identity' WHERE id=?",
            [owner],
          );
        else {
          await conn.query(
            "UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=?",
            [owner],
          );
          expect(await processScheduledAccountDeletions()).toBe(1);
        }
        const before = await snapshot();
        await expect(
          operation === "upsert"
            ? caller.penPals.upsert(input)
            : caller.penPals.remove(),
        ).rejects.toMatchObject({ code });
        expect(await snapshot()).toEqual(before);
      },
    );
    it.each(["new", "existing", "withdrawal"] as const)(
      "rolls back the %s profile operation if recording consent fails",
      async (mode) => {
        if (mode === "new")
          await conn.query("DELETE FROM pen_pal_profiles WHERE userId=?", [
            owner,
          ]);
        const before = await snapshot();
        await conn.query(
          `CREATE TRIGGER pen_profile_consent_refusal BEFORE INSERT ON user_consent_events FOR EACH ROW BEGIN IF NEW.userId=${owner} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic consent persistence failure'; END IF; END`,
        );
        const response = await http(
          mode === "withdrawal" ? "remove" : "upsert",
        );
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain(
          "synthetic consent persistence failure",
        );
        expect(await snapshot()).toEqual(before);
      },
    );
    it.each(["new", "existing"] as const)(
      "saves a current user's %s profile and matching consent through HTTP",
      async (mode) => {
        if (mode === "new") {
          await conn.query("DELETE FROM pen_pal_profiles WHERE userId=?", [
            owner,
          ]);
          await conn.query("DELETE FROM pen_pal_matches WHERE userLowId=?", [
            owner,
          ]);
        }
        const before = await snapshot();
        const response = await http("upsert");
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          result: {
            data: {
              json: {
                fullName: input.fullName,
                interests: input.interests,
                address: input.address,
              },
            },
          },
        });
        const [profiles] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM pen_pal_profiles WHERE userId=?",
          [owner],
        );
        const [events] = await conn.query<RowDataPacket[]>(
          "SELECT userId,consentKey,status,consentVersion,consentText FROM user_consent_events WHERE userId=?",
          [owner],
        );
        expect(profiles[0]).toMatchObject({
          fullName: input.fullName,
          address: input.address,
          interests: input.interests,
          active: 1,
          consentVersion: PEN_PAL_CONSENT_VERSION,
        });
        expect(events).toEqual([
          {
            userId: owner,
            consentKey: "pen_pals_adult",
            status: "granted",
            consentVersion: PEN_PAL_CONSENT_VERSION,
            consentText: PEN_PAL_ADULT_CONSENT_LABEL,
          },
        ]);
        expect((await snapshot()).users).toEqual(before.users);
        expect(
          (await snapshot()).profiles.find((row) => row.userId === neighbor),
        ).toEqual(before.profiles.find((row) => row.userId === neighbor));
      },
    );
    it.each(["active", "pendingDeletion"] as const)(
      "withdraws %s consent and matches even while discovery is disabled",
      async (state) => {
        if (state === "pendingDeletion")
          await conn.query(
            "UPDATE users SET accountDeletionRequestedAt=NOW() WHERE id=?",
            [owner],
          );
        const before = await snapshot();
        vi.stubEnv("ENABLE_PEN_PALS", "false");
        const response = await http("remove");
        expect(response.status).toBe(200);
        const [profiles] = await conn.query<RowDataPacket[]>(
          "SELECT active FROM pen_pal_profiles WHERE userId=?",
          [owner],
        );
        const [events] = await conn.query<RowDataPacket[]>(
          "SELECT status FROM user_consent_events WHERE userId=?",
          [owner],
        );
        expect(profiles[0].active).toBe(0);
        expect(events).toEqual([{ status: "revoked" }]);
        expect((await snapshot()).matches).toEqual([]);
      },
    );
    it("does not save a profile while the feature is disabled", async () => {
      vi.stubEnv("ENABLE_PEN_PALS", "false");
      const before = await snapshot();
      expect((await http("upsert")).status).toBe(403);
      expect(await snapshot()).toEqual(before);
    });
    it.each(["upsert", "remove"] as const)(
      "rejects guest %s without changes",
      async (operation) => {
        const before = await snapshot();
        expect((await http(operation, "")).status).toBe(401);
        expect(await snapshot()).toEqual(before);
      },
    );
  },
);
