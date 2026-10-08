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
import * as db from "../apps/backend/src/db";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openVideoTestDatabase } from "./helpers/video-mysql";

describe.skipIf(!testDatabaseUrl)(
  "video catalogue persistence on disposable MySQL",
  () => {
    let conn: Connection;
    let firstId: number;
    let otherId: number;
    const first = {
      youtubeId: "repo-video-first",
      title: "Café",
      published: true,
      sortOrder: 4,
    };
    const other = {
      youtubeId: "repo-video-other",
      title: "Hidden",
      published: false,
      sortOrder: 8,
    };
    async function cleanup() {
      await conn.query(
        "DELETE FROM videos WHERE youtubeId IN ('repo-video-first','repo-video-other')",
      );
    }
    async function stored() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM videos WHERE youtubeId IN ('repo-video-first','repo-video-other') ORDER BY youtubeId",
      );
      return rows;
    }
    beforeAll(async () => {
      conn = await openVideoTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    });
    beforeEach(async () => {
      await cleanup();
      firstId = await db.createVideo(first);
      otherId = await db.createVideo(other);
    });
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      const database = await db.getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("stores original titles and metadata while public reads normalize only published rows", async () => {
      expect(firstId).toBeGreaterThan(0);
      expect(await db.getVideoById(firstId)).toMatchObject({
        id: firstId,
        title: "Café",
        sortOrder: 4,
      });
      expect(await db.getVideoById(otherId)).toBeUndefined();
      expect(await db.getVideoByYoutubeId(first.youtubeId)).toMatchObject({
        title: first.title,
      });
      expect(await db.getVideoByYoutubeId(other.youtubeId)).toMatchObject({
        published: false,
        title: "Hidden",
      });
      expect(
        (await db.getVideos()).filter((row) =>
          [firstId, otherId].includes(row.id),
        ),
      ).toMatchObject([{ id: firstId, title: "Café" }]);
      expect(
        await db.getVideoByYoutubeId("repo-video-missing"),
      ).toBeUndefined();
    });
    it("updates only the selected row and retains untouched columns", async () => {
      const before = await stored();
      await db.updateVideo(firstId, { title: "Updated", published: false });
      expect(await stored()).toEqual([
        { ...before[0], title: "Updated", published: 0 },
        before[1],
      ]);
      expect(await db.getVideoById(firstId)).toBeUndefined();
    });
    it("deletes only the selected row and tolerates an already missing ID", async () => {
      const before = await stored();
      await db.deleteVideo(firstId);
      await db.deleteVideo(firstId);
      expect(await stored()).toEqual([before[1]]);
      expect(await db.getVideoByYoutubeId(first.youtubeId)).toBeUndefined();
    });
  },
);
