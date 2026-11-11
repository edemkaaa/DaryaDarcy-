/** Реальная Express/tRPC сериализация проверяется через локальный HTTP; подменены только открытые tags-данные. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";

let app: INestApplication, port: number;
// Exercise the actual mounted Express/tRPC adapter and serializer. Only SQL
// output is substituted; no database, storage, mail or background workers run.
/** Локальный Nest отдаёт достаточно большой синтетический публичный ответ без SQL/workers. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  app = await createBackendApplication();
  vi.spyOn(app.get(ContentReadService), "listTags").mockResolvedValue(
    Array.from({ length: 24 }, (_, id) => ({
      id,
      slug: `fixture-${id}`,
      label: "Открытая рубрика ".repeat(4),
      category: "topic",
      sortOrder: id,
    })),
  );
  await app.listen(0, "127.0.0.1");
  port = (app.getHttpServer().address() as AddressInfo).port;
});
/** Закрываем приложение и spies/env. */
afterAll(async () => {
  await app?.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
/** Node HTTP сохраняет сжатые wire-байты без автоматического fetch-декодирования. */
function read(path: string, headers: Record<string, string>) {
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    body: Buffer;
  }>((resolve, reject) => {
    request({ host: "127.0.0.1", port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () =>
        resolve({
          status: response.statusCode!,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
      response.on("error", reject);
    })
      .on("error", reject)
      .end();
  });
}
/** Gzip должен уменьшить ответ и после gunzip дать байт-в-байт тот же JSON, с корректным Vary. */
it("compresses a real mounted tRPC response without changing serialized bytes", async () => {
  const plain = await read("/api/trpc/feed.tags", {
    "Accept-Encoding": "identity",
  });
  const packed = await read("/api/trpc/feed.tags", {
    "Accept-Encoding": "gzip",
  });
  expect(plain.status).toBe(200);
  expect(JSON.parse(plain.body.toString()).result.data.json).toHaveLength(24);
  expect(packed.status).toBe(200);
  expect(packed.headers["content-encoding"]).toBe("gzip");
  expect(packed.headers.vary).toContain("Accept-Encoding");
  expect(gunzipSync(packed.body)).toEqual(plain.body);
  expect(packed.body.length).toBeLessThan(plain.body.length / 2);
});
/** Публичный batch с query согласовывает br и сохраняет исходный сериализованный ответ. */
it("negotiates Brotli for a real public batch with a query string", async () => {
  const path = "/api/trpc/feed.tags,feed.tags?batch=1";
  const plain = await read(path, { "Accept-Encoding": "identity" });
  const packed = await read(path, { "Accept-Encoding": "br, gzip" });
  expect(packed.status).toBe(200);
  expect(packed.headers["content-encoding"]).toBe("br");
  expect(brotliDecompressSync(packed.body)).toEqual(plain.body);
});
/** Даже посторонняя cookie исключает персональный запрос из public compression и оставляет no-store. */
it("keeps cookie-bearing public reads uncompressed", async () => {
  const result = await read("/api/trpc/feed.tags", {
    "Accept-Encoding": "gzip",
    Cookie: "unrelated=fixture",
  });
  expect(result.status).toBe(200);
  expect(result.headers["content-encoding"]).toBeUndefined();
  expect(result.headers["cache-control"]).toBe("no-store");
});
/** Смешанный batch с приватной процедурой не сжимается как полностью публичный. */
it("keeps a real batch containing auth.me uncompressed", async () => {
  const result = await read("/api/trpc/feed.tags,auth.me?batch=1", {
    "Accept-Encoding": "gzip",
  });
  expect(result.status).toBe(200);
  expect(result.headers["content-encoding"]).toBeUndefined();
  expect(JSON.parse(result.body.toString())).toHaveLength(2);
});
