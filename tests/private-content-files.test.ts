/** Закрытая загрузка проверяется настоящей обработкой картинки и собственным HTTP wire вместо S3. */
import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import * as photos from "../apps/backend/src/media/photos";
import { digest, ensurePrivateUploadObject, privateStorageNamespace } from "../apps/backend/src/media/private-upload-object";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";

let wire: Awaited<ReturnType<typeof openPrivateUploadWire>> | undefined;
/** Закрываем только локальный wire и снимаем S3 env между тестами. */
afterEach(async () => { await wire?.close(); wire = undefined; vi.unstubAllEnvs(); });

/** PNG с EXIF и прозрачностью превращается в WebP без EXIF/XMP, с теми же размерами и ненулевой alpha. */
it("prepares private photo bytes without a public upload, stripping metadata and retaining alpha", async () => {
  const input = await sharp({ create: { width: 2, height: 3, channels: 4, background: { r: 30, g: 60, b: 90, alpha: 0.3 } } })
    .withExif({ IFD0: { Artist: "private author" } }).png().toBuffer();
  const output = await photos.preparePhoto(input.toString("base64"));
  const meta = await sharp(output).metadata();
  expect(meta).toMatchObject({ format: "webp", width: 2, height: 3, hasAlpha: true });
  expect(meta.exif).toBeUndefined();
  expect(meta.xmp).toBeUndefined();
  const pixels = await sharp(output).raw().toBuffer();
  expect(pixels[3]).toBeGreaterThan(0);
  expect(pixels[3]).toBeLessThan(255);
});
/** SVG не проходит бинарную подготовку фото. */
it("refuses active image content before a private storage write", async () => {
  await expect(photos.preparePhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString("base64")))
    .rejects.toMatchObject({ code: "BAD_REQUEST" });
});
/** Создаём отдельный разрешённый content wire, байты документа и receipt с digest/namespace; реальные ключи не используются. */
async function fixture() {
  wire = await openPrivateUploadWire({ content: true });
  vi.stubEnv("S3_ENDPOINT", wire.endpoint);
  vi.stubEnv("S3_BUCKET", wire.bucket);
  vi.stubEnv("S3_ACCESS_KEY", "content-fixture-access");
  vi.stubEnv("S3_SECRET_KEY", "content-fixture-secret");
  const bytes = Buffer.from("new article document");
  const receipt = { assetId: randomUUID(), type: "document" as const, scope: "content" as const,
    payloadHash: digest(bytes), mimeType: "text/plain", fileSize: bytes.length, namespaceHash: privateStorageNamespace().hash };
  return { bytes, receipt };
}
/** После потерянного ACK повтор сверяет тот же объект content/private-v1 и не делает второй PUT. */
it("writes only the new private content scope and reuses the object after a lost PUT acknowledgement", async () => {
  const { bytes, receipt } = await fixture();
  wire!.dropPutAck();
  await expect(ensurePrivateUploadObject(receipt, bytes)).rejects.toThrow();
  expect(wire!.objects.size).toBe(1);
  expect([...wire!.objects.keys()]).toEqual([`content/private-v1/${receipt.assetId}`]);
  expect(await ensurePrivateUploadObject(receipt, bytes)).toMatch(/^".+"$/);
  expect(wire!.effects.filter(value => value.startsWith("PUT "))).toHaveLength(1);
  expect([...wire!.objects.values()][0].bytes).toEqual(bytes);
});
/** Отсутствие отдельного policy statement останавливает запись до PUT. */
it("refuses the content write when its dedicated policy statement is absent", async () => {
  const { bytes, receipt } = await fixture();
  wire!.rejectPolicy(true);
  await expect(ensurePrivateUploadObject(receipt, bytes)).rejects.toThrow();
  expect(wire!.objects.size).toBe(0);
  expect(wire!.effects.filter(value => value.startsWith("PUT "))).toEqual([]);
});
