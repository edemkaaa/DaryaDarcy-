import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../apps/backend/src/routers";
import type { User } from "../packages/database/src/schema";

const transport = vi.hoisted(() => ({
  query: vi.fn(),
  statements: [] as { sql: string; params: unknown[] }[],
  exists: true,
  inactiveProfile: 0,
  missingProfile: 0,
  blockedUser: 0,
  deadline: "2099-01-01 00:00:00",
  mutualAt: null as string | null,
}));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ on() {}, query: transport.query }) },
}));
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";

// Real local HTTP/router/Drizzle; only session lookup and SQL transport are
// doubled. This does not certify actual MySQL locking or production sessions.
let application: INestApplication;
let base: string;
let actorId: number;
const client = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
  });
const writes = () =>
  transport.statements.filter(({ sql }) => /^(delete|update|insert)/.test(sql));
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  vi.stubEnv("ENABLE_PEN_PALS", "true");
  application = await createBackendApplication();
  vi.spyOn(application.get(SessionService), "optionalUser").mockImplementation(
    async () =>
      ({
        id: actorId,
        role: "user",
        blockedAt: null,
      }) as User,
  );
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
beforeEach(() => {
  actorId = 3;
  transport.exists = true;
  transport.inactiveProfile = 0;
  transport.missingProfile = 0;
  transport.blockedUser = 0;
  transport.deadline = "2099-01-01 00:00:00";
  transport.mutualAt = null;
  transport.statements = [];
  transport.query
    .mockReset()
    .mockImplementation(
      async ({ sql }: { sql: string }, params: unknown[] = []) => {
        transport.statements.push({ sql, params });
        if (sql.includes("from `users`"))
          return [
            [
              [
                params[0],
                transport.blockedUser === params[0]
                  ? "2026-10-21 00:00:00"
                  : null,
              ],
            ],
            [],
          ];
        if (sql.includes("from `pen_pal_profiles`"))
          return [
            transport.missingProfile === params[0]
              ? []
              : [[params[0], transport.inactiveProfile === params[0] ? 0 : 1]],
            [],
          ];
        if (sql.startsWith("select"))
          return [
            transport.exists
              ? [
                  [
                    91,
                    1,
                    2,
                    1,
                    1,
                    0,
                    transport.mutualAt,
                    transport.deadline,
                    "2026-10-21 00:00:00",
                  ],
                ]
              : [],
            [],
          ];
        return [{ affectedRows: 1, insertId: 92 }, []];
      },
    );
});
afterEach(() => vi.clearAllMocks());
afterAll(async () => {
  await application?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([false, true])(
  "outsider cannot respond accept=%s or mutate A–B's match",
  async (accept) => {
    await expect(
      client().penPals.respondMatch.mutate({ matchId: 91, accept }),
    ).rejects.toMatchObject({
      data: { code: "NOT_FOUND", httpStatus: 404 },
    });
    expect(writes()).toEqual([]);
  },
);

it.each([1, 2])(
  "request refuses inactive profile %s without writing",
  async (id) => {
    actorId = 1;
    transport.inactiveProfile = id;
    await expect(
      client().penPals.requestMatch.mutate({ targetUserId: 2 }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    expect(writes()).toEqual([]);
  },
);
it.each([1, 2])(
  "accept refuses missing profile %s without writing",
  async (id) => {
    actorId = 2;
    transport.missingProfile = id;
    await expect(
      client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    expect(writes()).toEqual([]);
  },
);
it.each(["request", "accept"])(
  "%s cannot revive an expired pending match",
  async (action) => {
    actorId = 2;
    transport.deadline = "2000-01-01 00:00:00";
    const result =
      action === "request"
        ? client().penPals.requestMatch.mutate({ targetUserId: 1 })
        : client().penPals.respondMatch.mutate({ matchId: 91, accept: true });
    await expect(result).rejects.toMatchObject({
      data: { code: "CONFLICT", httpStatus: 409 },
    });
    expect(writes()).toEqual([]);
  },
);
it("request retry retains the original deadline instead of extending consent", async () => {
  actorId = 1;
  expect(
    await client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).toEqual({ matchId: 91 });
  expect(writes().some(({ sql }) => sql.includes("`confirmDeadline`"))).toBe(
    false,
  );
});
it("accept uses locked current confirmations and serializes with account/profile changes", async () => {
  actorId = 2;
  expect(
    await client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).toEqual({ ok: true });
  const locks = transport.statements.filter(({ sql }) =>
    sql.endsWith("for update"),
  );
  expect(locks.map(({ sql }) => sql.match(/from `([^`]+)`/)?.[1])).toEqual([
    "users",
    "users",
    "pen_pal_profiles",
    "pen_pal_profiles",
    "pen_pal_matches",
  ]);
  expect(writes()).toHaveLength(1);
  expect(writes()[0].params.slice(0, 2)).toEqual([true, true]);
  expect(transport.statements.at(-1)?.sql).toBe("commit");
});
it("already mutual matches remain valid after their original confirmation deadline", async () => {
  actorId = 2;
  transport.deadline = "2000-01-01 00:00:00";
  transport.mutualAt = "1999-12-31 00:00:00";
  expect(
    await client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).toEqual({ ok: true });
});
it.each([0, -1, 1.5, 2147483648])(
  "request rejects invalid target %s before SQL",
  async (targetUserId) => {
    await expect(
      client().penPals.requestMatch.mutate({ targetUserId }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    expect(transport.statements).toEqual([]);
  },
);
it("account block detected after authentication prevents match creation", async () => {
  actorId = 1;
  transport.blockedUser = 1;
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(writes()).toEqual([]);
});

it("fresh request creates only the initiator's consent after locking both active profiles", async () => {
  actorId = 2;
  transport.exists = false;
  expect(
    await client().penPals.requestMatch.mutate({ targetUserId: 1 }),
  ).toEqual({ matchId: 92 });
  expect(writes()).toHaveLength(1);
  expect(writes()[0].sql).toMatch(/^insert into `pen_pal_matches`/);
  expect(writes()[0].params.slice(0, 5)).toEqual([1, 2, 2, false, true]);
  expect(transport.statements.at(-1)?.sql).toBe("commit");
});
it("request cannot match the actor with themselves", async () => {
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 3 }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  expect(writes()).toEqual([]);
});
it.each([1, 2])("request refuses missing profile %s", async (id) => {
  actorId = 1;
  transport.missingProfile = id;
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(writes()).toEqual([]);
  expect(transport.statements.at(-1)?.sql).toBe("rollback");
});
it.each([1, 2])("accept refuses inactive profile %s", async (id) => {
  actorId = 2;
  transport.inactiveProfile = id;
  await expect(
    client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(writes()).toEqual([]);
});
it("unknown match is an object-level 404, not an infrastructure error", async () => {
  transport.exists = false;
  await expect(
    client().penPals.respondMatch.mutate({ matchId: 91, accept: false }),
  ).rejects.toMatchObject({
    data: { code: "NOT_FOUND", httpStatus: 404 },
  });
  expect(writes()).toEqual([]);
});
it.each([1, 2])(
  "participant %s can reject, with ownership retained in DELETE",
  async (id) => {
    actorId = id;
    expect(
      await client().penPals.respondMatch.mutate({
        matchId: 91,
        accept: false,
      }),
    ).toEqual({ ok: true });
    expect(writes()).toHaveLength(1);
    expect(writes()[0].sql).toMatch(
      /where .*`id` = \?.*`userLowId` = \?.*`userHighId` = \?/,
    );
    expect(writes()[0].params).toEqual([91, id, id]);
  },
);
it.each([0, -1, 1.5])(
  "rejects malformed match ID %s before SQL",
  async (matchId) => {
    await expect(
      client().penPals.respondMatch.mutate({ matchId, accept: false }),
    ).rejects.toMatchObject({
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    });
    expect(transport.statements).toEqual([]);
  },
);
