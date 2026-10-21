import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  it,
  describe,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { deactivatePenPalProfileV2 } from "../apps/backend/src/platform-db";
import type { AppRouter } from "../apps/backend/src/routers";

// Requires a separately owned disposable backend_test with the fresh schema.
// No external storage, notifications, mail or payment providers are used.
describe.skipIf(!testDatabaseUrl)(
  "Pen Pals HTTP/JWT/MySQL authorization and lifecycle",
  () => {
    const ids = [98371, 98372, 98373];
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    let ownsFixtures = false;
    const clients = new Map<
      number,
      ReturnType<typeof createTRPCProxyClient<AppRouter>>
    >();
    const matches = async () => {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM pen_pal_matches WHERE userLowId IN (?,?,?) OR userHighId IN (?,?,?) ORDER BY id",
        [...ids, ...ids],
      );
      return rows;
    };
    const request = (actor = ids[0], target = ids[1]) =>
      clients.get(actor)!.penPals.requestMatch.mutate({ targetUserId: target });
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Do not initialize old/partial schemas or delete someone else's fixtures.
      await conn.query("SELECT id,active FROM pen_pal_profiles LIMIT 0");
      const [occupied] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id IN (?,?,?)",
        ids,
      );
      if (occupied.length || (await matches()).length)
        throw new Error("Pen Pal fixture IDs already occupied");
      await conn.query(
        "INSERT INTO users(id,openId,role,sessionVersion) VALUES (?, 'pen-pal-sec-a','user',0),(?,'pen-pal-sec-b','user',0),(?,'pen-pal-sec-c','user',0)",
        ids,
      );
      ownsFixtures = true;
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("ENABLE_PEN_PALS", "true");
      vi.stubEnv("JWT_SECRET", "pen-pal-sql-fixture-secret-32-characters");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      for (const [index, id] of ids.entries()) {
        const token = await sdk.createSessionToken(
          `pen-pal-sec-${["a", "b", "c"][index]}`,
          { sessionVersion: 0 },
        );
        clients.set(
          id,
          createTRPCProxyClient<AppRouter>({
            links: [
              httpLink({
                url: base + "/api/trpc",
                transformer: superjson,
                headers: { authorization: `Bearer ${token}` },
              }),
            ],
          }),
        );
      }
    });
    beforeEach(async () => {
      await conn.query(
        "DELETE FROM pen_pal_matches WHERE userLowId IN (?,?,?) OR userHighId IN (?,?,?)",
        [...ids, ...ids],
      );
      await conn.query(
        "UPDATE users SET blockedAt=NULL WHERE id IN (?,?,?)",
        ids,
      );
      for (const id of ids)
        await conn.query(
          "INSERT INTO pen_pal_profiles(userId,fullName,city,interests,address,active) VALUES (?,'Synthetic','Synthetic',JSON_ARRAY('Книги','Сад'),'Synthetic address',TRUE) ON DUPLICATE KEY UPDATE active=TRUE",
          [id],
        );
    });
    afterAll(async () => {
      await app?.close();
      if (ownsFixtures) {
        await conn.query(
          "DELETE FROM pen_pal_matches WHERE userLowId IN (?,?,?) OR userHighId IN (?,?,?)",
          [...ids, ...ids],
        );
        await conn.query(
          "DELETE FROM pen_pal_profiles WHERE userId IN (?,?,?)",
          ids,
        );
        await conn.query(
          "DELETE FROM users WHERE id IN (?,?,?) AND openId IN ('pen-pal-sec-a','pen-pal-sec-b','pen-pal-sec-c')",
          ids,
        );
      }
      await conn?.end();
      vi.unstubAllEnvs();
    });
    it.each([false, true])(
      "outsider accept=%s cannot change A–B's match",
      async (accept) => {
        const { matchId } = await request();
        const before = await matches();
        await expect(
          clients.get(ids[2])!.penPals.respondMatch.mutate({ matchId, accept }),
        ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
        expect(await matches()).toEqual(before);
      },
    );
    it.each([0, 1])(
      "participant %s can decline their own match",
      async (index) => {
        const { matchId } = await request();
        await clients
          .get(ids[index])!
          .penPals.respondMatch.mutate({ matchId, accept: false });
        expect(await matches()).toEqual([]);
      },
    );
    it.each([0, 1])(
      "inactive profile %s cannot create a match",
      async (index) => {
        await conn.query(
          "UPDATE pen_pal_profiles SET active=FALSE WHERE userId=?",
          [ids[index]],
        );
        await expect(request()).rejects.toMatchObject({
          data: { code: "NOT_FOUND" },
        });
        expect(await matches()).toEqual([]);
      },
    );
    it.each(["accept", "request"])(
      "expired match cannot be revived via %s",
      async (action) => {
        const { matchId } = await request();
        await conn.query(
          "UPDATE pen_pal_matches SET confirmDeadline='2000-01-01' WHERE id=?",
          [matchId],
        );
        const before = await matches();
        await expect(
          action === "accept"
            ? clients
                .get(ids[1])!
                .penPals.respondMatch.mutate({ matchId, accept: true })
            : request(ids[1], ids[0]),
        ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
        expect(await matches()).toEqual(before);
      },
    );
    it("parallel reciprocal requests create one pair without losing mutual consent", async () => {
      const replies = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          index % 2 ? request() : request(ids[1], ids[0]),
        ),
      );
      expect(new Set(replies.map((reply) => reply.matchId)).size).toBe(1);
      const rows = await matches();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userLowConfirmed: 1,
        userHighConfirmed: 1,
      });
      expect(rows[0].mutualConfirmedAt).not.toBeNull();
    });
    it("retries do not extend the confirmation deadline", async () => {
      await request();
      const before = await matches();
      await request();
      expect(await matches()).toEqual(before);
    });
    it("deactivation racing acceptance leaves no match for an inactive profile", async () => {
      const { matchId } = await request();
      const outcomes = await Promise.allSettled([
        clients
          .get(ids[1])!
          .penPals.respondMatch.mutate({ matchId, accept: true }),
        deactivatePenPalProfileV2(ids[0]),
      ]);
      expect(outcomes[1].status).toBe("fulfilled");
      if (outcomes[0].status === "rejected")
        expect(outcomes[0].reason).toMatchObject({
          data: { code: "NOT_FOUND" },
        });
      expect(await matches()).toEqual([]);
    });
  },
);
