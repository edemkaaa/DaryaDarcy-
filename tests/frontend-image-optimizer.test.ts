import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "next/dist/server/image-optimizer/transform";
import config from "../apps/frontend/next.config.mjs";

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

describe("public photo preview decoding", () => {
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

  it("still rejects images above the bounded 40MP decoding budget", async () => {
    const original = await sharp({ create: {
      width: 6400, height: 6400, channels: 3, background: "#886644",
    } }).jpeg().toBuffer();
    await expect(optimize(original)).rejects.toThrow("pixel limit");
    expect(config.images.dangerouslyAllowLocalIP).toBe(false);
    expect(config.images.maximumResponseBody).toBe(8 * 1024 * 1024);
  });
});
