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
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// This global "latest" read needs its own fresh disposable database: do not run
// alongside SQL suites publishing unrelated posts into the same fixture schema.
// Explicit opt-in keeps the ordinary parallel SQL run from sharing that dataset.
describe.skipIf(
  !testDatabaseUrl || process.env.BACKEND_LATEST_ACCEPTANCE !== "1",
)("latest notification through real HTTP, JWT and SQL", () => {
  let conn: Connection;
  let app: INestApplication;
  let base: string;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    const [baseline] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM posts",
    );
    expect(
      Number(baseline[0].count),
      "latest acceptance requires a fresh content dataset",
    ).toBe(0);
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "latest-http-synthetic-secret-32");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  async function cleanup() {
    await conn.query("DELETE FROM posts WHERE id BETWEEN 8450 AND 8459");
    await conn.query(
      "DELETE FROM club_payments WHERE orderId='latest-http-subscription'",
    );
    await conn.query("DELETE FROM users WHERE id=8450");
  }
  beforeEach(async () => {
    await cleanup();
    await conn.query(
      "INSERT INTO users (id,openId,email,role,sessionVersion) VALUES (8450,'latest-http-8450','latest@example.invalid','user',2)",
    );
    await conn.query(`INSERT INTO posts (id,text,photos,tags,target,published,status,createdAt,publishedAt) VALUES
      (8450,'Public announcement','[]','[]','feed',TRUE,'published','2020-01-01','2020-02-01'),
      (8451,'Private announcement','[]','[]','club',TRUE,'published','2020-01-02','2020-02-02'),
      (8452,'Draft must stay hidden','[]','[]','both',TRUE,'draft','2020-01-03','2020-03-03'),
      (8453,'Scheduled must stay hidden','[]','[]','both',TRUE,'scheduled','2020-01-04','2020-03-04'),
      (8454,'Unpublished must stay hidden','[]','[]','both',FALSE,'published','2020-01-05','2020-03-05')`);
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
    vi.unstubAllEnvs();
  });
  function client(authenticated = true) {
    const token = authenticated
      ? sdk.createSessionToken("latest-http-8450", { sessionVersion: 2 })
      : undefined;
    return createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: `${base}/api/trpc`,
          transformer: superjson,
          headers: async () =>
            authenticated
              ? {
                  Authorization: `Bearer ${await token}`,
                }
              : {},
        }),
      ],
    });
  }
  const publicOnly = {
    feedId: 8450,
    feedText: "Public announcement",
    clubId: null,
    clubText: "",
  };
  const withClub = {
    feedId: 8450,
    feedText: "Public announcement",
    clubId: 8451,
    clubText: "Private announcement",
  };
  async function subscription(
    status: "paid" | "pending" | "failed",
    expiry: "future" | "past" | "none",
    cancelled = false,
  ) {
    await conn.query(
      `INSERT INTO club_payments (userId,orderId,status,expiresAt,cancelAtPeriodEnd,cancelledAt)
      VALUES (8450,'latest-http-subscription',?,${expiry === "none" ? "NULL" : expiry === "future" ? "DATE_ADD(NOW(), INTERVAL 1 DAY)" : "DATE_SUB(NOW(), INTERVAL 1 DAY)"},?,${cancelled ? "NOW()" : "NULL"})`,
      [status, cancelled],
    );
  }
  it("exposes only the published public announcement to guests", async () => {
    expect(await client(false).notifications.latest.query()).toEqual(
      publicOnly,
    );
  });
  it("does not treat an authenticated account as a club subscription", async () => {
    expect(await client().notifications.latest.query()).toEqual(publicOnly);
  });
  it.each([
    {
      name: "paid unexpired",
      status: "paid",
      expiry: "future",
      cancelled: false,
      allowed: true,
    },
    {
      name: "paid expired",
      status: "paid",
      expiry: "past",
      cancelled: false,
      allowed: false,
    },
    {
      name: "pending unexpired",
      status: "pending",
      expiry: "future",
      cancelled: false,
      allowed: false,
    },
    {
      name: "failed unexpired",
      status: "failed",
      expiry: "future",
      cancelled: false,
      allowed: false,
    },
    {
      name: "paid without expiry",
      status: "paid",
      expiry: "none",
      cancelled: false,
      allowed: false,
    },
    {
      name: "cancelled at period end but unexpired",
      status: "paid",
      expiry: "future",
      cancelled: true,
      allowed: true,
    },
  ] as const)("honors persisted entitlement: $name", async (fixture) => {
    await subscription(fixture.status, fixture.expiry, fixture.cancelled);
    expect(await client().notifications.latest.query()).toEqual(
      fixture.allowed ? withClub : publicOnly,
    );
  });
  it.each(["admin", "moderator"])(
    "preserves %s club access without payment",
    async (role) => {
      await conn.query("UPDATE users SET role=? WHERE id=8450", [role]);
      expect(await client().notifications.latest.query()).toEqual(withClub);
    },
  );
  it("rechecks expiry on the next request using the same JWT", async () => {
    await subscription("paid", "future");
    const session = client();
    expect(await session.notifications.latest.query()).toEqual(withClub);
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE orderId='latest-http-subscription'",
    );
    expect(await session.notifications.latest.query()).toEqual(publicOnly);
  });
  it("shows a both-target publication in each authorized channel", async () => {
    await subscription("paid", "future");
    await conn.query(
      "INSERT INTO posts (id,text,photos,tags,target,publishedAt) VALUES (8455,'Shared announcement','[]','[]','both','2020-04-01')",
    );
    expect(await client().notifications.latest.query()).toEqual({
      feedId: 8455,
      feedText: "Shared announcement",
      clubId: 8455,
      clubText: "Shared announcement",
    });
    expect(await client(false).notifications.latest.query()).toEqual({
      feedId: 8455,
      feedText: "Shared announcement",
      clubId: null,
      clubText: "",
    });
  });
  it("orders by publication date with creation fallback, not ID or sort order", async () => {
    await conn.query(`INSERT INTO posts (id,text,photos,tags,target,sortOrder,createdAt,publishedAt) VALUES
      (8455,'Newer creation but older publication','[]','[]','feed',-100,'2020-06-01','2020-01-01'),
      (8456,'Creation fallback','[]','[]','feed',100,'2020-05-01',NULL)`);
    expect(await client(false).notifications.latest.query()).toEqual({
      feedId: 8456,
      feedText: "Creation fallback",
      clubId: null,
      clubText: "",
    });
    await conn.query("UPDATE posts SET publishedAt='2020-07-01' WHERE id=8450");
    expect(await client(false).notifications.latest.query()).toEqual(
      publicOnly,
    );
  });
  it("keeps null IDs and empty text when no visible publication exists", async () => {
    await conn.query(
      "UPDATE posts SET published=FALSE WHERE id IN (8450,8451)",
    );
    await subscription("paid", "future");
    expect(await client().notifications.latest.query()).toEqual({
      feedId: null,
      feedText: "",
      clubId: null,
      clubText: "",
    });
  });
});
