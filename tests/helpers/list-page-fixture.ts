import { vi } from "vitest";
import type { Pool } from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { openContentTestDatabase } from "./content-mysql";
import { testDatabaseUrl } from "./backend-mysql";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { getDb } from "../../apps/backend/src/db";
import { sdk } from "../../apps/backend/src/_core/sdk";

export type ListPage = {
  items: Array<{ id: number; [field: string]: unknown }>;
  nextCursor: string | null;
  totalCount?: number;
};

/** Owned SQL rows and real HTTP/JWT only; application workers are not started. */
export async function openListPageFixture(name: string, base: number) {
  // Создаёт собственные SQL-строки и loopback API с настоящими JWT, не запуская фоновые workers.

  const conn = await openContentTestDatabase();
  vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
  vi.stubEnv("JWT_SECRET", "pagination-synthetic-local-secret-32");
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  const url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const ids = [base, base + 1, base + 2, base + 3];
  async function cleanup() {
    // Удаляет только выделенные ID и source данного набора, сохраняя строки параллельных сценариев.

    await conn.query("DELETE FROM comment_likes WHERE userId IN (?)", [ids]);
    await conn.query("DELETE FROM post_comments WHERE postId BETWEEN ? AND ?", [
      base + 100,
      base + 299,
    ]);
    await conn.query("DELETE FROM saved_posts WHERE userId IN (?)", [ids]);
    await conn.query("DELETE FROM likes WHERE userId IN (?)", [ids]);
    await conn.query("DELETE FROM post_media WHERE postId BETWEEN ? AND ?", [
      base + 100,
      base + 299,
    ]);
    await conn.query("DELETE FROM posts WHERE source=?", [name]);
    await conn.query("DELETE FROM club_payments WHERE userId IN (?)", [ids]);
    await conn.query("DELETE FROM users WHERE id IN (?)", [ids]);
  }
  return {
    app,
    conn,
    ids,
    reset: async () => {
      // Очищает собственный набор и создаёт роли user/admin/moderator для матрицы доступа.

      await cleanup();
      for (const [index, role] of [
        "user",
        "user",
        "admin",
        "moderator",
      ].entries()) {
        await conn.query(
          "INSERT INTO users(id,openId,name,role,createdAt) VALUES(?,?,?,?, '2026-01-01')",
          [ids[index], `${name}-${index}`, `Fixture ${index}`, role],
        );
      }
    },
    post: async (index: number, target = "feed", published = true) => {
      // Выделяет ID поста внутри собственного диапазона и задаёт целевой раздел и опубликованность явно.

      const id = base + 100 + index;
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,source,target,published,status) VALUES(?, ?,JSON_ARRAY(),JSON_ARRAY(),?,?,?,?)",
        [
          id,
          `Post ${index}`,
          name,
          target,
          published,
          published ? "published" : "draft",
        ],
      );
      return id;
    },
    grant: async (index = 0) => {
      // Синтетический доступ принадлежит тестовому аккаунту; платёжный провайдер не вызывается.

      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(?,?,'paid','2030-01-01')",
        [ids[index], `${name}-access-${index}`],
      );
    },
    read: async (method: string, input: object, actor: number | null = 0) => {
      // Отправляет настоящий tRPC HTTP под выбранным синтетическим актором либо гостем и возвращает статус отдельно от данных.

      const token =
        actor === null
          ? null
          : await sdk.createSessionToken(`${name}-${actor}`, {
              sessionVersion: 0,
            });
      const response = await fetch(
        url +
          "/api/trpc/" +
          method +
          "?input=" +
          encodeURIComponent(JSON.stringify({ json: input })),
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const body = await response.json();
      return {
        status: response.status,
        data: body.result?.data?.json as ListPage,
        error: body.error?.json,
      };
    },
    close: async () => {
      // Закрывает приложение, очищает свой набор и пул, затем возвращает подменённое окружение Vitest.

      await app.close();
      await cleanup();
      await conn.end();
      await ((await getDb()) as unknown as { $client: Pool })?.$client.end();
      vi.unstubAllEnvs();
    },
  };
}
