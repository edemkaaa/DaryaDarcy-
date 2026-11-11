/** Настоящий loopback HTTP проверяет допуск tRPC batch до выполнения операций. */
import { afterAll, beforeAll, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";

let application: INestApplication;
let base: string;

/** Поднимаем фабрику приложения на случайном локальном порту, без executable/worker запуска. */
beforeAll(async () => {
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
/** Закрываем только созданное тестом приложение. */
afterAll(async () => application?.close());

/** Передаём имена процедур в реальный GET batch-маршрут. */
function batch(names: string[]) {
  return fetch(`${base}/api/trpc/${names.join(",")}?batch=1`);
}

/** Пакет из 21 операции превышает общий предел и получает 400. */
it("rejects more than 20 operations before executing a public batch", async () => {
  const response = await batch(Array(21).fill("feed.tags"));
  expect(response.status).toBe(400);
});

/** Два дорогих полных чтения ленты в одном пакете запрещены отдельно от общего числа процедур. */
it("rejects repeated full-feed reads in one batch", async () => {
  const response = await batch(["feed.list", "feed.list"]);
  expect(response.status).toBe(400);
});

/** Две auth.me без БД подтверждают, что обычный короткий batch остаётся рабочим. */
it("preserves ordinary short batches", async () => {
  // Use a read that is valid without a configured database. DB unavailability
  // is a separate 503 contract, not a batch admission failure.
  const response = await batch(["auth.me", "auth.me"]);
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveLength(2);
});
