// Проверяет TTL, размер и ошибки кеша обложек; ошибочный ответ источника не должен становиться сохранённой картинкой.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as thumbnails from "../upstream.mjs";

// Сценарий: TTL повторно использует байты, но не смешивает разные ID.
test("reuses thumbnail bytes until expiry and keeps distinct video IDs separate", async () => {
  assert.equal(typeof thumbnails.createThumbnailReader, "function");
  let time = 0;
  let reads = 0;
  const read = thumbnails.createThumbnailReader({
    now: () => /* Управляет истечением TTL без реального ожидания. */ time,
    ttlMs: 100,
    load: async (id) => /* Возвращает контролируемые байты или сетевой отказ, позволяя проверить повтор чтения и учёт размера. */ Buffer.from(`${id}:${++reads}`),
  });
  assert.equal((await read("sq7pY1H_fYU")).toString(), "sq7pY1H_fYU:1");
  assert.equal((await read("sq7pY1H_fYU")).toString(), "sq7pY1H_fYU:1");
  assert.equal((await read("_RZRJgVSD8Y")).toString(), "_RZRJgVSD8Y:2");
  time = 100;
  assert.equal((await read("sq7pY1H_fYU")).toString(), "sq7pY1H_fYU:3");
});

// Сценарий: Бюджет вытесняет старые обложки, ошибки не кешируются.
test("evicts older thumbnails at the byte budget and never caches failures", async () => {
  assert.equal(typeof thumbnails.createThumbnailReader, "function");
  let reads = 0;
  let failing = true;
  const read = thumbnails.createThumbnailReader({
    maxBytes: 5,
    load: async (id) => {
      // Возвращает контролируемые байты или сетевой отказ, позволяя проверить повтор чтения и учёт размера.

      if (id === "NJYw6dVnSpg" && failing)
        throw new Error("upstream unavailable");
      return Buffer.from(String(++reads).repeat(3));
    },
  });
  assert.equal((await read("sq7pY1H_fYU")).toString(), "111");
  assert.equal((await read("_RZRJgVSD8Y")).toString(), "222");
  assert.equal((await read("sq7pY1H_fYU")).toString(), "333");
  await assert.rejects(read("NJYw6dVnSpg"));
  failing = false;
  assert.equal((await read("NJYw6dVnSpg")).toString(), "444");
  await assert.rejects(read("../private"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(read("NJYw6dVnSpg", controller.signal));
});
