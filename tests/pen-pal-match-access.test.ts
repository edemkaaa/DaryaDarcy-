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
  transport.statements = [];
  transport.query
    .mockReset()
    .mockImplementation(
      async ({ sql }: { sql: string }, params: unknown[] = []) => {
        transport.statements.push({ sql, params });
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
                    null,
                    "2099-01-01 00:00:00",
                    "2026-10-21 00:00:00",
                  ],
                ]
              : [],
            [],
          ];
        return [{ affectedRows: 1 }, []];
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
