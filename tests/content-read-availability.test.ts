/** Проверяем настоящее HTTP-чтение без DATABASE_URL и прямые read helpers, чтобы отказ БД не выглядел пустым контентом. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import * as db from "../apps/backend/src/db";
import {
  getPostCommentById,
  listPostCommentsV2,
  listCommentReports,
} from "../apps/backend/src/content/comments";

let app: INestApplication;
let base: string;
/** Поднимаем принадлежащий набору Nest listener на loopback без БД. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
/** Закрываем приложение и возвращаем окружение. */
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
/** Для разных публичных чтений ожидаем 503 и SERVICE_UNAVAILABLE в форме tRPC-ответа. */
it.each([
  { name: "feed.tags" },
  { name: "articles.list" },
  { name: "articles.getById", input: { id: 1 } },
  { name: "videos.list" },
  { name: "videos.getById", input: { id: 1 } },
])(
  "returns an explicit HTTP service failure from $name without database configuration",
  async ({ name, input }) => {
    const url =
      base +
      "/api/trpc/" +
      name +
      (input
        ? "?input=" + encodeURIComponent(JSON.stringify({ json: input }))
        : "");
    const response = await fetch(url);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        json: { data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 } },
      },
    });
  },
);
/** Прямые helpers тоже обязаны отказать; пустой массив или undefined не подтверждают доступность базы. */
it.each([
  () => db.listPublishedArticles(),
  () => db.getArticleById(1),
  () => db.getAllTags(),
  () => listPostCommentsV2(1),
  () => getPostCommentById(1),
  () => listCommentReports(10),
])(
  "does not disguise a missing connection as empty content or a missing object",
  async (read) => {
    await expect(read()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  },
);
