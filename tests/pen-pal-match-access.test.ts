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
  affectedRows: 1,
}));
vi.mock("mysql2/promise", () => ({
  default: { /** Подменяет только mysql2 transport наблюдаемым query, оставляя настоящий Drizzle и репозитории. */ createPool: () => ({ /** Не регистрирует реальные события пула в изолированном SQL-double. */ on() {}, query: transport.query }) },
}));
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";

// Real local HTTP/router/Drizzle; only session lookup and SQL transport are
// doubled. This does not certify actual MySQL locking or production sessions.
let application: INestApplication;
let base: string;
let actorId: number;
/** Создаёт настоящий tRPC HTTP-клиент для текущего loopback приложения. */
const client = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
  });
/** Выделяет изменяющие SQL-операторы, чтобы доказывать отсутствие записи при отказе доступа. */
const writes = () =>
  transport.statements.filter(({ sql }) => /^(delete|update|insert)/.test(sql));
/** Поднимает Nest с включённым Pen Pals и тестовым actor вместо поиска настоящей сессии. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  vi.stubEnv("ENABLE_PEN_PALS", "true");
  application = await createBackendApplication();
  vi.spyOn(application.get(SessionService), "optionalUser").mockImplementation(
    async () =>
      ({
        id: actorId,
        role: "user",
        openId: "pen-pal-unit-" + actorId,
        sessionVersion: 0,
        blockedAt: null,
      }) as User,
  );
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
/** Сбрасывает actor и SQL-ответы профилей, участников и заявки, сохраняя порядок исполняемых запросов. */
beforeEach(() => {
  actorId = 3;
  transport.exists = true;
  transport.inactiveProfile = 0;
  transport.missingProfile = 0;
  transport.blockedUser = 0;
  transport.deadline = "2099-01-01 00:00:00";
  transport.mutualAt = null;
  transport.affectedRows = 1;
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
                "pen-pal-unit-" + params[0],
                0,
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
        return [{ affectedRows: transport.affectedRows, insertId: 92 }, []];
      },
    );
});
/** Очищает историю подмен между независимыми сценариями доступа. */
afterEach(() => vi.clearAllMocks());
/** Закрывает приложение и возвращает spy и окружение после набора. */
afterAll(async () => {
  await application?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Запрещает постороннему принять или удалить заявку двух других участников до любого изменяющего SQL. */
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

/** Не создаёт заявку при неактивном профиле любой из сторон. */
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
/** Не подтверждает заявку при отсутствующем профиле любой из сторон. */
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
/** Не возобновляет истёкшую неподтверждённую заявку через request или accept. */
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
/** Повтор запроса сохраняет исходный дедлайн согласия вместо его продления. */
it("request retry retains the original deadline instead of extending consent", async () => {
  actorId = 1;
  expect(
    await client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).toEqual({ matchId: 91 });
  expect(writes().some(({ sql }) => sql.includes("`confirmDeadline`"))).toBe(
    false,
  );
});
/** Проверяет порядок блокировок пользователей, профилей и заявки и использование актуального согласия в update. */
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
/** Не считает уже взаимно подтверждённую пару просроченной по старому сроку первичного согласия. */
it("already mutual matches remain valid after their original confirmation deadline", async () => {
  actorId = 2;
  transport.deadline = "2000-01-01 00:00:00";
  transport.mutualAt = "1999-12-31 00:00:00";
  expect(
    await client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).toEqual({ ok: true });
});
/** Сохраняет проверку срока в предикате финального SQL подтверждения. */
it("expiry remains a predicate of the final confirmation SQL", async () => {
  actorId = 2;
  await client().penPals.respondMatch.mutate({ matchId: 91, accept: true });
  expect(writes()[0].sql).toMatch(/`confirmDeadline` > CURRENT_TIMESTAMP/);
});
/** Не подтверждает успех при affectedRows=0 и проверяет rollback истёкшей к записи заявки. */
it("expiry refusal at the write is not acknowledged as a successful confirmation", async () => {
  actorId = 2;
  transport.affectedRows = 0;
  await expect(
    client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  expect(transport.statements.at(-1)?.sql).toBe("rollback");
});
/** Отклоняет неверный идентификатор цели до SQL. */
it.each([0, -1, 1.5, 2147483648])(
  "request rejects invalid target %s before SQL",
  async (targetUserId) => {
    await expect(
      client().penPals.requestMatch.mutate({ targetUserId }),
    ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    expect(transport.statements).toEqual([]);
  },
);
/** Блокировка аккаунта после аутентификации запрещает создание заявки при повторной проверке. */
it("account block detected after authentication prevents match creation", async () => {
  actorId = 1;
  transport.blockedUser = 1;
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(writes()).toEqual([]);
});

/** Новая заявка фиксирует только согласие инициатора после блокировки обоих действующих профилей. */
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
/** Не разрешает заявку самому себе. */
it("request cannot match the actor with themselves", async () => {
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 3 }),
  ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
  expect(writes()).toEqual([]);
});
/** Отсутствие любого профиля приводит к отказу и rollback без записи. */
it.each([1, 2])("request refuses missing profile %s", async (id) => {
  actorId = 1;
  transport.missingProfile = id;
  await expect(
    client().penPals.requestMatch.mutate({ targetUserId: 2 }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(writes()).toEqual([]);
  expect(transport.statements.at(-1)?.sql).toBe("rollback");
});
/** Не подтверждает заявку, если любой профиль стал неактивным. */
it.each([1, 2])("accept refuses inactive profile %s", async (id) => {
  actorId = 2;
  transport.inactiveProfile = id;
  await expect(
    client().penPals.respondMatch.mutate({ matchId: 91, accept: true }),
  ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  expect(writes()).toEqual([]);
});
/** Неизвестная заявка возвращает объектный 404 без изменения данных. */
it("unknown match is an object-level 404, not an infrastructure error", async () => {
  transport.exists = false;
  await expect(
    client().penPals.respondMatch.mutate({ matchId: 91, accept: false }),
  ).rejects.toMatchObject({
    data: { code: "NOT_FOUND", httpStatus: 404 },
  });
  expect(writes()).toEqual([]);
});
/** Разрешает участнику отказ с повторной проверкой его участия непосредственно в DELETE. */
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
/** Отклоняет повреждённый matchId до SQL. */
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
