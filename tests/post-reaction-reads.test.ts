import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ on() {}, query: transport.query }) },
}));

// Keep the facade/repository/Drizzle real; only unavailable SQL is simulated.
// Actor isolation and bookmark order are accepted separately on real MySQL.
let database: typeof import("../apps/backend/src/db");
const reads = [
  { name: "likes", run: () => database.getUserLikedPostIds(8970) },
  { name: "bookmarks", run: () => database.getUserSavedPostIds(8970) },
];
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  transport.query.mockReset().mockResolvedValue([[], []]);
  database = await import("../apps/backend/src/db");
});
afterEach(() => vi.unstubAllEnvs());

describe("personal reaction read compatibility", () => {
  it.each(reads)(
    "keeps the absent-DB empty result for $name",
    async ({ run }) => {
      vi.stubEnv("DATABASE_URL", "");
      expect(await run()).toEqual([]);
    },
  );
  it.each(reads)(
    "returns an empty $name list for an actor with no marks",
    async ({ run }) => {
      expect(await run()).toEqual([]);
    },
  );
  it.each(reads)(
    "rejects failed $name SQL instead of reporting no marks",
    async ({ run }) => {
      transport.query.mockRejectedValue(new Error("REACTION_SQL_FAILURE"));
      await expect(run()).rejects.toThrow();
    },
  );
  it.each(reads)(
    "returns raw $name IDs after SQL recovers",
    async ({ run }) => {
      transport.query.mockRejectedValueOnce(new Error("REACTION_SQL_FAILURE"));
      await expect(run()).rejects.toThrow();
      transport.query.mockResolvedValue([[[8975], [8975], [8972]], []]);
      expect(await run()).toEqual([8975, 8975, 8972]);
    },
  );
});
