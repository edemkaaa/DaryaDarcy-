import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection } from "mysql2/promise";
import {
  createVideo,
  getDb,
  getVideoByYoutubeId,
} from "../apps/backend/src/db";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openVideoTestDatabase } from "./helpers/video-mysql";

/** Проверяет, что автоинкремент нового видео не попадает в зарезервированный диапазон очистки фиксированных фикстур. */
describe.skipIf(!testDatabaseUrl)("video SQL fixture isolation", () => {
  let conn: Connection;
  /** Удаляет только два собственных synthetic youtubeId. */
  async function cleanup() {
    await conn.query(
      "DELETE FROM videos WHERE youtubeId IN ('isolation-fixed','isolation-created')",
    );
  }
  /** Открывает изолированную videos-схему, подключает прикладной пул и очищает прежний запуск suite. */
  beforeAll(async () => {
    conn = await openVideoTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    await cleanup();
  });
  /** Удаляет собственные строки, закрывает соединения и восстанавливает окружение. */
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
  /** После вставки высокого фиксированного ID новая импортированная строка переживает очистку зарезервированного диапазона. */
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
