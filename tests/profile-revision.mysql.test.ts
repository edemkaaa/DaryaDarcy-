import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
  describe,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { sdk } from "../apps/backend/src/_core/sdk";
import { closeDb } from "../apps/backend/src/db";

/** Проверяет optimistic revision профиля через настоящий HTTP, включая ABA, abort и изменение полномочий перед записью. */
describe.skipIf(!testDatabaseUrl)("atomic profile revisions", () => {
  let conn: Connection,
    app: Awaited<ReturnType<typeof createBackendApplication>>,
    base: string,
    token: string;
  /** Открывает одноразовую БД и локальный API и создаёт тестовую JWT с sessionVersion=3. */
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "profile-revision-disposable-only");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    token = await sdk.createSessionToken("revision-fixture", {
      sessionVersion: 3,
    });
  });
  /** Пересоздаёт собственную строку профиля с исходным именем и revision=0. */
  beforeEach(async () => {
    await conn.query("DELETE FROM users WHERE id=94881");
    await conn.query(
      "INSERT INTO users(id,openId,name,role,sessionVersion) VALUES(94881,'revision-fixture','before','user',3)",
    );
  });
  /** Возвращает методы сервиса после управляемых пауз. */
  afterEach(() => vi.restoreAllMocks());
  /** Закрывает API и пул, удаляет только свой профиль и восстанавливает окружение. */
  afterAll(async () => {
    await app?.close();
    await conn?.query("DELETE FROM users WHERE id=94881");
    await conn?.end();
    await closeDb();
    vi.unstubAllEnvs();
  });
  /** Отправляет profile.update с expectedRevision и необязательным AbortSignal. */
  const save = (
    name: string,
    expectedRevision?: number,
    signal?: AbortSignal,
  ) =>
    fetch(base + "/api/trpc/profile.update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ json: { name, expectedRevision } }),
      signal,
    });
  /** Читает сохранённое имя и epoch сессии для независимой проверки результата. */
  const read = async () =>
    (
      await conn.query<RowDataPacket[]>(
        "SELECT name,sessionVersion FROM users WHERE id=94881",
      )
    )[0][0];
  /** Обновление без expectedRevision отклоняется до изменения имени. */
  it("refuses a missing revision instead of keeping a blind-write path", async () => {
    expect((await save("unsafe")).status).toBe(400);
    expect((await read()).name).toBe("before");
  });
  /** Возвращение имени к исходному не обнуляет revision и не разрешает устаревшую запись. */
  it("rejects a stale revision even after values return to their original state (ABA)", async () => {
    expect((await save("next", 0)).status).toBe(200);
    expect((await save("before", 1)).status).toBe(200);
    expect((await save("late", 0)).status).toBe(409);
    expect(await read()).toMatchObject({ name: "before", sessionVersion: 3 });
  });
  /** Отмена ожидающего HTTP не даёт позднему запросу затереть более новый подтверждённый профиль. */
  it("a delayed aborted request cannot overwrite the newer successful save", async () => {
    let enter!: () => void, release!: () => void, finish!: () => void;
    const entered = new Promise<void>((r) => (enter = r)),
      gate = new Promise<void>((r) => (release = r)),
      finished = new Promise<void>((r) => (finish = r));
    const service = app.get(ProfileService),
      original = service.update.bind(service);
    vi.spyOn(service, "update").mockImplementation(async (...args) => {
      if (args[1].name !== "late A") return original(...args);
      enter();
      await gate;
      try {
        return await original(...args);
      } finally {
        finish();
      }
    });
    try {
      const controller = new AbortController();
      const a = save("late A", 0, controller.signal).catch(() => null);
      await entered;
      controller.abort();
      await a;
      expect((await read()).name).toBe("before");
      expect((await save("new B", 0)).status).toBe(200);
      release();
      await finished;
      expect((await read()).name).toBe("new B");
    } finally {
      release();
    }
  });
  /** После паузы запись повторно учитывает отзыв сессии, блокировку и заявку на удаление аккаунта. */
  it.each([
    ["session revocation", "sessionVersion=sessionVersion+1", 401],
    ["blocking", "blockedAt=NOW()", 403],
    ["deletion request", "accountDeletionRequestedAt=NOW()", 403],
  ] as const)(
    "rechecks %s immediately before a delayed write",
    async (_, patch, status) => {
      let enter!: () => void, release!: () => void;
      const entered = new Promise<void>((r) => (enter = r)),
        gate = new Promise<void>((r) => (release = r));
      const service = app.get(ProfileService),
        original = service.update.bind(service);
      vi.spyOn(service, "update").mockImplementation(async (...args) => {
        enter();
        await gate;
        return original(...args);
      });
      try {
        const request = save("must not apply", 0);
        await entered;
        await conn.query("UPDATE users SET " + patch + " WHERE id=94881");
        release();
        expect((await request).status).toBe(status);
        expect((await read()).name).toBe("before");
      } finally {
        release();
      }
    },
  );
});
