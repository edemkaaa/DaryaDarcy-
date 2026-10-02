import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, upsertUser } from "../apps/backend/src/db";
describe.skipIf(!testDatabaseUrl)("database failure logging on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => { conn = await openTestDatabase(); vi.stubEnv("DATABASE_URL", testDatabaseUrl!); });
  afterAll(async () => {
    await conn?.end();
    await (await getDb() as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  it("logs a failed registration without credentials, recipient or SQL params", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(upsertUser({ openId: "long-open-id-".repeat(10), email: "private@example.test", passwordHash: "PRIVATE_HASH_SENTINEL" })).rejects.toThrow();
      expect(logger).toHaveBeenCalled();
      expect(JSON.stringify(logger.mock.calls)).not.toMatch(/PRIVATE_HASH_SENTINEL|private@example|long-open-id|insert into|params|query/);
    } finally { logger.mockRestore(); }
  });
});
