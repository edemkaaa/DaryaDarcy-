import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { Request } from "express";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";

describe.skipIf(!testDatabaseUrl)(
  "authenticated activity across final retirement",
  () => {
    let conn: Connection;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "r6-native-activity-fixture-secret-32");
    });
    beforeEach(async () => {
      await conn.query(
        "DELETE FROM users WHERE id=97560 OR openId='r6-activity-fixture'",
      );
      await conn.query(
        "INSERT INTO users(id,openId,role,sessionVersion,lastSignedIn) VALUES (97560,'r6-activity-fixture','admin',0,'2020-01-01')",
      );
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      await conn?.query(
        "DELETE FROM users WHERE id=97560 OR openId='r6-activity-fixture'",
      );
      await conn?.end();
      await (
        (await db.getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function request() {
      return {
        headers: {
          authorization: `Bearer ${await sdk.createSessionToken("r6-activity-fixture", { sessionVersion: 0 })}`,
        },
      } as Request;
    }
    it("never recreates a retired identity between session lookup and activity recording", async () => {
      const native = db.getUserByOpenId;
      let read!: () => void, resume!: () => void;
      const entered = new Promise<void>((resolve) => {
        read = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      const spy = vi
        .spyOn(db, "getUserByOpenId")
        .mockImplementation(async (openId) => {
          const user = await native(openId);
          read();
          await gate;
          return user;
        });
      const pending = sdk.authenticateRequest(await request());
      try {
        await entered;
        await conn.query(
          "UPDATE users SET openId='deleted-97560-1791936000000',sessionVersion=1 WHERE id=97560",
        );
        resume();
        await pending;
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE openId='r6-activity-fixture'",
        );
        expect(rows).toEqual([]);
      } finally {
        resume();
        await pending.catch(() => {});
        spy.mockRestore();
      }
    });
    it("authentication reads without waiting behind a content owner lock", async () => {
      await conn.beginTransaction();
      await conn.query("SELECT id FROM users WHERE id=97560 FOR UPDATE");
      let completed = false;
      const pending = sdk.authenticateRequest(await request()).then((user) => {
        completed = true;
        return user;
      });
      try {
        await vi.waitFor(() => expect(completed).toBe(true), {
          timeout: 1000,
          interval: 20,
        });
      } finally {
        await conn.rollback();
        await pending;
      }
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT lastSignedIn FROM users WHERE id=97560",
      );
      expect(rows[0].lastSignedIn.toISOString()).toBe(
        "2020-01-01T00:00:00.000Z",
      );
    });
  },
);
