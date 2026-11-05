import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as db from "../apps/backend/src/db";

beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
afterEach(() => vi.unstubAllEnvs());

it.each([
  { name: "published list", read: () => db.getVideos(), expected: [] },
  {
    name: "published detail",
    read: () => db.getVideoById(1),
    expected: undefined,
  },
  {
    name: "import dedup",
    read: () => db.getVideoByYoutubeId("fixture"),
    expected: undefined,
  },
])(
  "reports $name unavailable rather than empty when no database is configured",
  async ({ read }) => {
    await expect(read()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  },
);

it.each([
  {
    name: "create",
    write: () => db.createVideo({ youtubeId: "fixture", title: "Synthetic" }),
  },
  { name: "update", write: () => db.updateVideo(1, { title: "Synthetic" }) },
  { name: "delete", write: () => db.deleteVideo(1) },
  {
    name: "bulk import",
    write: () =>
      db.bulkImportVideos([{ youtubeId: "fixture", title: "Synthetic" }], {
        id: 1,
        sessionVersion: 0,
      }),
  },
])(
  "refuses $name instead of reporting a write without a database",
  async ({ write }) => {
    await expect(write()).rejects.toThrow("Database not available");
  },
);
