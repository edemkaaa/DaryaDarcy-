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
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, upsertUser } from "../apps/backend/src/db";

/** Проверяет уникальную нормализованную email-идентичность при обновлениях и конкурентной регистрации. */
describe.skipIf(!testDatabaseUrl)(
  "normalized email identity on disposable MySQL",
  () => {
    let conn: Connection;
    const prefix = "email-identity-fixture-";
    /** Находит и удаляет только аккаунты с собственным openId-префиксом. */
    async function cleanup() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE openId LIKE ?",
        [`${prefix}%`],
      );
      for (const row of rows)
        await conn.query("DELETE FROM users WHERE id=?", [row.id]);
    }
    /** Открывает одноразовую схему и подключает прикладной пул. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    });
    beforeEach(cleanup);
    /** Удаляет собственные аккаунты, закрывает соединения и возвращает окружение. */
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Другой openId с тем же нормализованным email не захватывает исходный аккаунт, роль или пароль. */
    it("rejects a whitespace/case variant without changing the existing address or credentials", async () => {
      await upsertUser({
        openId: `${prefix}owner`,
        email: "email-identity-fixture@example.test",
        passwordHash: "OWNER_HASH",
      });
      const [before] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM users WHERE openId=?",
        [`${prefix}owner`],
      );
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await expect(
          upsertUser({
            openId: `${prefix}other`,
            email: "  EMAIL-IDENTITY-FIXTURE@EXAMPLE.TEST  ",
            role: "admin",
            passwordHash: "OTHER_HASH",
          }),
        ).rejects.toThrow("User identity conflict");
        const [after] = await conn.query<RowDataPacket[]>(
          "SELECT * FROM users WHERE openId=?",
          [`${prefix}owner`],
        );
        expect(after).toEqual(before);
      } finally {
        logger.mockRestore();
      }
    });
    /** NULL и пустая почта сохраняют независимые legacy-аккаунты. */
    it("keeps separate legacy accounts with absent or empty email", async () => {
      await upsertUser({ openId: `${prefix}none-a`, email: null });
      await upsertUser({ openId: `${prefix}none-b`, email: null });
      await upsertUser({ openId: `${prefix}empty-a`, email: "" });
      await upsertUser({ openId: `${prefix}empty-b`, email: "" });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT email FROM users WHERE openId LIKE ?",
        [`${prefix}%`],
      );
      expect(rows.map((row) => row.email).sort()).toEqual(["", "", null, null]);
    });
    /** В гонке разных openId за один email выигрывает одна полная идентичность без смешивания имени и hash. */
    it("gives simultaneous different identities competing for an email exactly one winner", async () => {
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const results = await Promise.allSettled([
          upsertUser({
            openId: `${prefix}race-a`,
            email: "email-identity-race@example.test",
            name: "First",
            passwordHash: "FIRST_HASH",
          }),
          upsertUser({
            openId: `${prefix}race-b`,
            email: "email-identity-race@example.test",
            name: "Second",
            passwordHash: "SECOND_HASH",
          }),
        ]);
        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(1);
        expect(
          results.find((result) => result.status === "rejected"),
        ).toMatchObject({ reason: { message: "User identity conflict" } });
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT openId,name,passwordHash FROM users WHERE email=?",
          ["email-identity-race@example.test"],
        );
        expect(rows).toHaveLength(1);
        const winner = rows[0].openId.endsWith("race-a")
          ? { name: "First", passwordHash: "FIRST_HASH" }
          : { name: "Second", passwordHash: "SECOND_HASH" };
        expect(rows[0]).toMatchObject(winner);
      } finally {
        logger.mockRestore();
      }
    });
    /** Шесть конкурентных повторов одинаковых openId и email завершаются одним аккаунтом. */
    it("keeps simultaneous retries of the same identity on one account", async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          upsertUser({
            openId: `${prefix}same`,
            email: "email-identity-same@example.test",
            name: "Same",
          }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(6);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT openId,name,email FROM users WHERE openId=?",
        [`${prefix}same`],
      );
      expect(rows).toEqual([
        {
          openId: `${prefix}same`,
          name: "Same",
          email: "email-identity-same@example.test",
        },
      ]);
    });
  },
);
