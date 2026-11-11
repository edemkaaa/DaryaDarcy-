import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type {
  Connection,
  Pool,
  PoolConnection,
  RowDataPacket,
} from "mysql2/promise";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { closeDb, getDb } from "../apps/backend/src/database/connection";
import { hashPassword } from "../apps/backend/src/_core/password";
import { sdk } from "../apps/backend/src/_core/sdk";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";

describe.skipIf(!testDatabaseUrl)(
  "HTTP failures and recovery with a saturated application pool",
  () => {
    let app: INestApplication,
      conn: Connection,
      pool: Pool,
      base: string,
      token: string;
    const email = "pool-pressure@example.test",
      password = "owned-pressure-password";
    const deferred = () => {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    };
    beforeAll(async () => {
      vi.stubEnv("API_DB_BURST_QUEUE_ENABLED", "false");
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "owned-pool-pressure-session-secret-32-chars");
      vi.stubEnv("API_COORDINATION_MODE", "local");
      vi.stubEnv("API_REPLICA_COUNT", "1");
      vi.stubEnv("ADMIN_TOTP_SECRET", "");
      await conn.query(
        "INSERT INTO users (id,openId,email,passwordHash,role) VALUES (98840,'pool-pressure',?,?,'admin')",
        [email, await hashPassword(password)],
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,target,status,published,source) VALUES (98840,'Existing pressure fixture',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE,'pressure-existing')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("pool-pressure", {
        sessionVersion: 0,
      });
      pool = ((await getDb()) as unknown as { $client: Pool }).$client;
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      await app?.close();
      if (conn) {
        await conn.query(
          "DELETE FROM post_creation_requests WHERE actorUserId=98840",
        );
        await conn.query(
          "DELETE FROM posts WHERE source IN ('pressure-existing','pressure-created')",
        );
        await conn.query("DELETE FROM users WHERE id=98840");
        await conn.end();
      }
      await closeDb();
      vi.unstubAllEnvs();
    });
    async function saturate() {
      const held: PoolConnection[] = [];
      try {
        for (let i = 0; i < 10; i++) held.push(await pool.getConnection());
      } catch (error) {
        held.forEach((connection) => connection.release());
        throw error;
      }
      const queued = Array.from({ length: 10 }, () =>
        pool.getConnection().then((connection) => connection.release()),
      );
      return async () => {
        held.forEach((connection) => connection.release());
        await Promise.all(queued);
      };
    }
    const headers = () => ({ authorization: `Bearer ${token}` });
    const rpc = (
      method: string,
      input?: unknown,
      authenticated = false,
      mutation = false,
    ) =>
      fetch(
        `${base}/api/trpc/${method}${mutation || input === undefined ? "" : `?input=${encodeURIComponent(superjson.stringify(input))}`}`,
        {
          method: mutation ? "POST" : "GET",
          headers: {
            "content-type": "application/json",
            ...(authenticated ? headers() : {}),
          },
          ...(mutation ? { body: superjson.stringify(input) } : {}),
          signal: AbortSignal.timeout(4000),
        },
      );
    async function expectUnavailable(response: Response, trpc: boolean) {
      expect(response.headers.get("set-cookie")).toBeNull();
      const body = await response.text();
      expect(body).not.toMatch(/Queue limit|SELECT|INSERT|passwordHash|stack/);
      expect(response.status).toBe(503);
      if (trpc)
        expect(superjson.deserialize(JSON.parse(body).error)).toMatchObject({
          data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 },
        });
      expect(body).not.toContain('"user":null');
    }

    it("keeps REST session failure distinct from guest and recovers the same token", async () => {
      const release = await saturate();
      try {
        await expectUnavailable(
          await fetch(base + "/api/auth/me", {
            headers: headers(),
            signal: AbortSignal.timeout(4000),
          }),
          false,
        );
      } finally {
        await release();
      }
      expect(
        await (
          await fetch(base + "/api/auth/me", { headers: headers() })
        ).json(),
      ).toMatchObject({ user: { id: 98840 } });
    });
    it("keeps tRPC session failure distinct from guest and recovers the same token", async () => {
      const release = await saturate();
      try {
        await expectUnavailable(await rpc("auth.me", undefined, true), true);
      } finally {
        await release();
      }
      expect((await rpc("auth.me", undefined, true)).status).toBe(200);
    });
    it.each(["local", "mysql"])(
      "reports temporary login failure with %s coordination without issuing cookies",
      async (mode) => {
        vi.stubEnv("API_COORDINATION_MODE", mode);
        const login = () =>
          fetch(base + "/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password }),
            signal: AbortSignal.timeout(4000),
          });
        const release = await saturate();
        try {
          await expectUnavailable(await login(), false);
        } finally {
          await release();
          vi.stubEnv("API_COORDINATION_MODE", "local");
        }
        const recovered = await login();
        expect(recovered.status).toBe(200);
        expect(await recovered.json()).toMatchObject({ user: { id: 98840 } });
        expect(recovered.headers.get("set-cookie")).toContain("HttpOnly");
      },
    );
    it("does not turn failed public list reads into a successful empty page", async () => {
      const release = await saturate();
      try {
        await expectUnavailable(
          await rpc("feed.listPaginated", { limit: 12 }),
          true,
        );
      } finally {
        await release();
      }
      const result = superjson.deserialize<{ posts: { id: number }[] }>(
        (await (await rpc("feed.listPaginated", { limit: 12 })).json()).result
          .data,
      );
      expect(result.posts.some((post) => post.id === 98840)).toBe(true);
    });
    it("fails a write after authentication without success or partial rows, then safely replays the same intent", async () => {
      const service = app.get(ContentWriteService);
      const original = service.createPost.bind(service);
      const entered = deferred(),
        resume = deferred();
      const pause = vi
        .spyOn(service, "createPost")
        .mockImplementationOnce(async (...args) => {
          entered.resolve();
          await resume.promise;
          return original(...args);
        });
      const input = {
        text: "New pressure fixture",
        photos: [],
        tags: [],
        source: "pressure-created",
        status: "draft",
        idempotencyKey: "pressure-create-intent-0001",
      };
      const pending = rpc("admin.createPost", input, true, true);
      let release: (() => Promise<void>) | undefined;
      try {
        await entered.promise;
        release = await saturate();
        resume.resolve();
        await expectUnavailable(await pending, true);
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM posts WHERE source='pressure-created'",
            )
          )[0],
        ).toEqual([]);
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT requestKey FROM post_creation_requests WHERE actorUserId=98840",
            )
          )[0],
        ).toEqual([]);
      } finally {
        resume.resolve();
        await release?.();
        await pending;
        pause.mockRestore();
      }
      const first = await rpc("admin.createPost", input, true, true);
      expect(first.status).toBe(200);
      const receipt = await first.json();
      expect(
        await (await rpc("admin.createPost", input, true, true)).json(),
      ).toEqual(receipt);
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT id FROM posts WHERE source='pressure-created'",
          )
        )[0],
      ).toHaveLength(1);
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT text FROM posts WHERE id=98840",
          )
        )[0],
      ).toEqual([{ text: "Existing pressure fixture" }]);
    });
  },
);
