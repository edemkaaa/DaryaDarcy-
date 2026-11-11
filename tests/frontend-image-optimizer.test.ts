/** Проверяем реальные параметры декодирования превью Next на синтетических изображениях в памяти. */
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "next/dist/server/image-optimizer/transform";
import config from "../apps/frontend/next.config.mjs";

/** Применяет действующие настройки Next к буферу и фиксированному размеру; S3 и HTTP не используются. */
const optimize = (buffer: Buffer) => optimizeImage({
  buffer,
  contentType: "image/webp",
  quality: 75,
  width: 960,
  concurrency: config.experimental.imgOptConcurrency,
  operationCache: config.experimental.imgOptOperationCache,
  limitInputPixels: config.experimental.imgOptMaxInputPixels,
  sequentialRead: config.experimental.imgOptSequentialRead,
  timeoutInSeconds: config.experimental.imgOptTimeoutInSeconds,
});

/** Граница мегапикселей отделяется от размера файла; тесты не измеряют скорость устройства. */
describe("public photo preview decoding", () => {
  /** Допустимый большой progressive JPEG должен дать лёгкое WebP-превью шириной 960, а не оригинал. */
  it("resizes a progressive 37MP portrait instead of falling back to the original", async () => {
    const original = await sharp({ create: {
      width: 4550, height: 8088, channels: 3, background: "#886644",
    } }).jpeg({ progressive: true }).toBuffer();
    const preview = await optimize(original);
    expect(await sharp(preview).metadata()).toMatchObject({
      format: "webp", width: 960, height: 1706,
    });
    expect(preview.length).toBeLessThan(original.length);
  });

  /** Слишком большое изображение отклоняется; локальные IP и размер входного ответа остаются ограниченными. */
  it("still rejects images above the bounded 40MP decoding budget", async () => {
    const original = await sharp({ create: {
      width: 6400, height: 6400, channels: 3, background: "#886644",
    } }).jpeg().toBuffer();
    await expect(optimize(original)).rejects.toThrow("pixel limit");
    expect(config.images.dangerouslyAllowLocalIP).toBe(false);
    expect(config.images.maximumResponseBody).toBe(8 * 1024 * 1024);
  });
});
