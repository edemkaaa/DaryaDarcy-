import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection } from "mysql2/promise";
import {
  createVideo,
  getDb,
  getVideoByYoutubeId,
} from "../apps/backend/src/db";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openVideoTestDatabase } from "./helpers/video-mysql";

describe.skipIf(!testDatabaseUrl)("video SQL fixture isolation", () => {
  let conn: Connection;
  async function cleanup() {
    await conn.query(
      "DELETE FROM videos WHERE youtubeId IN ('isolation-fixed','isolation-created')",
    );
  }
  beforeAll(async () => {
    conn = await openVideoTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    await cleanup();
  });
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
  it("keeps an imported row when an independent connection cleans fixed fixture IDs", async () => {
    await conn.query(
      "INSERT INTO videos (id,youtubeId,title) VALUES (999998,'isolation-fixed','Fixed fixture')",
    );
    const id = await createVideo({
      youtubeId: "isolation-created",
      title: "Imported fixture",
    });
    await conn.query("DELETE FROM videos WHERE id BETWEEN 999998 AND 999999");
    expect(await getVideoByYoutubeId("isolation-created")).toMatchObject({
      id,
      title: "Imported fixture",
    });
    expect(await getVideoByYoutubeId("isolation-fixed")).toBeUndefined();
  });
});
