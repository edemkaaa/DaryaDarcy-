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
import mysql, {
  type Connection,
  type Pool,
  type RowDataPacket,
} from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { closeDb, getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

// Real owned SQL; captured real actors and HTTP/JWT. No external services.
describe.skipIf(!testDatabaseUrl)(
  "Pen Pals match and address access lifecycle",
  () => {
    const owner = 992201,
      peer = 992202,
      other = 992203;
    const operations = ["request", "accept", "decline", "me", "find"] as const;
    type Operation = (typeof operations)[number];
    let conn: Connection,
      app: Awaited<ReturnType<typeof createBackendApplication>>,
      base: string,
      token: string,
      matchId: number;
    async function cleanup() {
      await conn.query(
        "DELETE FROM pen_pal_matches WHERE userLowId IN (?,?,?) OR userHighId IN (?,?,?)",
        [owner, peer, other, owner, peer, other],
      );
      for (const table of [
        "pen_pal_shown",
        "pen_pal_profiles",
        "user_consent_events",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId IN (?,?,?)`, [
          owner,
          peer,
          other,
        ]);
      await conn.query("DELETE FROM users WHERE id IN (?,?,?)", [
        owner,
        peer,
        other,
      ]);
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("ENABLE_PEN_PALS", "true");
      vi.stubEnv("JWT_SECRET", "pen-pal-access-fixture-only-signing-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("pen-access-owner", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS pen_access_shown_refusal");
      await cleanup();
      for (const [id, label] of [
        [owner, "owner"],
        [peer, "peer"],
        [other, "other"],
      ] as const) {
        await conn.query(
          "INSERT INTO users(id,openId,name,email,lastSignedIn) VALUES (?,?,?,?,NOW())",
          [
            id,
            "pen-access-" + label,
            label,
            "pen-access-" + label + "@example.test",
          ],
        );
        await conn.query(
          "INSERT INTO pen_pal_profiles(userId,fullName,city,interests,address,active) VALUES (?,?,'Synthetic city',JSON_ARRAY('Сад','Книги'),?,TRUE)",
          [id, label, "Private synthetic address: " + label],
        );
      }
      const [result] = await conn.query<mysql.ResultSetHeader>(
        "INSERT INTO pen_pal_matches(userLowId,userHighId,initiatedBy,userLowConfirmed,userHighConfirmed,mutualConfirmedAt,confirmDeadline) VALUES (?,?,?,FALSE,TRUE,NULL,DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [owner, peer, peer],
      );
      matchId = result.insertId;
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await conn.query("DROP TRIGGER IF EXISTS pen_access_shown_refusal");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) await cleanup();
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    async function captured(id = "owner") {
      return appRouter.createCaller({
        user: (await getUserByOpenId("pen-access-" + id))!,
        req: {},
        res: {},
      } as TrpcContext);
    }
    async function prepare(operation: Operation) {
      if (operation === "request")
        await conn.query("DELETE FROM pen_pal_matches WHERE id=?", [matchId]);
      if (operation === "find")
        await conn.query(
          "UPDATE pen_pal_matches SET userLowConfirmed=TRUE,mutualConfirmedAt=NOW() WHERE id=?",
          [matchId],
        );
    }
    const run = (
      caller: Awaited<ReturnType<typeof captured>>,
      operation: Operation,
    ) => {
      if (operation === "request")
        return caller.penPals.requestMatch({ targetUserId: peer });
      if (operation === "accept" || operation === "decline")
        return caller.penPals.respondMatch({
          matchId,
          accept: operation === "accept",
        });
      return caller.penPals[operation]();
    };
    const snapshot = async () => {
      const [matches] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM pen_pal_matches WHERE userLowId=? ORDER BY id",
        [owner],
      );
      const [shown] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM pen_pal_shown WHERE userId=? ORDER BY id",
        [owner],
      );
      return { matches, shown };
    };
    const http = (operation: Operation) => {
      const procedure =
        operation === "request"
          ? "requestMatch"
          : operation === "accept" || operation === "decline"
            ? "respondMatch"
            : operation;
      const input =
        operation === "request"
          ? { targetUserId: peer }
          : operation === "accept" || operation === "decline"
            ? { matchId, accept: operation === "accept" }
            : undefined;
      const query = operation === "me";
      return fetch(base + "/api/trpc/penPals." + procedure, {
        method: query ? "GET" : "POST",
        headers: {
          authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        ...(query ? {} : { body: JSON.stringify({ json: input ?? null }) }),
        signal: AbortSignal.timeout(10000),
      });
    };
    for (const operation of operations) {
      it.each(["epoch", "identity", "blocked"] as const)(
        `${operation} rejects an actor after %s changes`,
        async (change) => {
          await prepare(operation);
          const caller = await captured();
          await conn.query(
            `UPDATE users SET ${change === "epoch" ? "sessionVersion=sessionVersion+1" : change === "identity" ? "openId='pen-access-replaced-owner'" : "blockedAt=NOW()"} WHERE id=?`,
            [owner],
          );
          const before = await snapshot();
          await expect(run(caller, operation)).rejects.toMatchObject({
            code: change === "blocked" ? "FORBIDDEN" : "UNAUTHORIZED",
          });
          expect(await snapshot()).toEqual(before);
        },
      );
    }
    it.each(operations)(
      "%s rechecks an actor revoked during SQL lock wait",
      async (operation) => {
        await prepare(operation);
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
                const [rows] = await conn.query<RowDataPacket[]>(
                  "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                  [control.threadId],
                );
                return rows[0].n;
              },
              { timeout: 3000, interval: 30 },
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
    it.each([false, true])(
      "shows the peer address only for mutual=%s",
      async (mutual) => {
        if (mutual)
          await conn.query(
            "UPDATE pen_pal_matches SET userLowConfirmed=TRUE,mutualConfirmedAt=NOW() WHERE id=?",
            [matchId],
          );
        const result = await (await captured()).penPals.find();
        const card = result.matches.find((row) => row.userId === peer);
        expect(card).toBeDefined();
        expect(card!.address).toBe(
          mutual ? "Private synthetic address: peer" : undefined,
        );
      },
    );
    it("does not return the peer address after completed withdrawal", async () => {
      await prepare("find");
      await (await captured("peer")).penPals.remove();
      const result = await (await captured()).penPals.find();
      expect(result.matches.some((row) => row.userId === peer)).toBe(false);
      expect(result.matches.every((row) => row.address === undefined)).toBe(
        true,
      );
    });
    it.each([
      { pauseOn: "match-list", revoke: "withdraw" },
      { pauseOn: "own-profile", revoke: "withdraw" },
      { pauseOn: "match-list", revoke: "block" },
    ])(
      "honors $revoke committed after discovery reads $pauseOn",
      async ({ pauseOn, revoke }) => {
        await prepare("find");
        const caller = await captured(),
          withdrawing = await captured("peer");
        const pool = (
          (await getDb()) as NonNullable<Awaited<ReturnType<typeof getDb>>> & {
            $client: Pool;
          }
        ).$client;
        const connection = await pool.getConnection();
        const original = connection.query.bind(connection);
        vi.spyOn(pool, "getConnection").mockResolvedValueOnce(connection);
        let enter!: () => void,
          release!: () => void,
          paused = false;
        const entered = new Promise<void>((resolve) => {
          enter = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        // Only pause after a real SELECT. No SQL data or writer is replaced.
        vi.spyOn(connection, "query").mockImplementation((async (
          statement: unknown,
          values?: unknown,
        ) => {
          const result = await (
            original as (sql: unknown, values?: unknown) => Promise<unknown>
          )(statement, values);
          const sql =
            typeof statement === "string"
              ? statement
              : ((statement as { sql?: string }).sql ?? "");
          if (
            !paused &&
            /^select/i.test(sql) &&
            !sql.includes("for update") &&
            (pauseOn === "match-list"
              ? sql.includes("from `pen_pal_matches`")
              : sql.includes("from `pen_pal_profiles`") &&
                Array.isArray(values) &&
                values[0] === owner)
          ) {
            paused = true;
            enter();
            await gate;
          }
          return result;
        }) as typeof connection.query);
        const pending = caller.penPals.find();
        try {
          await Promise.race([
            entered,
            pending.then(() => {
              throw new Error("Expected a paused real SQL read");
            }),
          ]);
          if (revoke === "withdraw") await withdrawing.penPals.remove();
          else
            await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=?", [
              peer,
            ]);
          release();
          const result = await pending;
          expect(result.matches.some((row) => row.userId === peer)).toBe(false);
          expect(result.matches.every((row) => row.address === undefined)).toBe(
            true,
          );
        } finally {
          release();
          await pending.catch(() => {});
        }
      },
    );
    it("does not claim discovery succeeded when shown tracking fails", async () => {
      await conn.query("DELETE FROM pen_pal_matches WHERE id=?", [matchId]);
      const before = await snapshot();
      await conn.query(
        `CREATE TRIGGER pen_access_shown_refusal BEFORE INSERT ON pen_pal_shown FOR EACH ROW BEGIN IF NEW.userId=${owner} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic discovery write refusal'; END IF; END`,
      );
      const response = await http("find");
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain(
        "synthetic discovery write refusal",
      );
      expect(await snapshot()).toEqual(before);
    });
  },
);
