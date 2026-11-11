/** Недоступная БД не должна выглядеть пустым видеокаталогом или успешной записью. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as db from "../apps/backend/src/db";

/** Явно отключаем DATABASE_URL: реальные данные не используются. */
beforeEach(() => vi.stubEnv("DATABASE_URL", ""));
/** Восстанавливаем окружение после проверок отсутствующей БД. */
afterEach(() => vi.unstubAllEnvs());

/** Все варианты чтения сообщают SERVICE_UNAVAILABLE вместо достоверного пустого результата. */
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

/** Создание, patch, удаление и импорт не должны возвращать ложный успех без соединения. */
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
