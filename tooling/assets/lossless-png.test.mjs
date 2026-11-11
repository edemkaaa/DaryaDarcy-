// Проверяет сохранение образцов и структуры PNG при перепаковке, включая случаи, где меньший размер не должен покупаться изменением цвета.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync, crc32 } from "node:zlib";
import sharp from "sharp";
import { optimizeLosslessPng } from "./lossless-png.mjs";

const decode = (data) => /* Сравнивает декодированный RGBA-результат, а не только метадату или размер нового файла. */ sharp(data).ensureAlpha().raw().toBuffer();
const rgba = Buffer.from(Array.from({ length: 17 * 23 * 4 }, (_, i) => (i * 7) & 255));
for (const palette of [false, true]) {
  // Сценарий: PNG с палитрой и без неё сохраняет декодированные пиксели, alpha, density и ICC.
  test(`lossless PNG retains decoded pixels and alpha with palette=${palette}`, async () => {
    const original = await sharp(rgba, { raw: { width: 17, height: 23, channels: 4 } })
      .withMetadata({ density: 144 }).png({ compressionLevel: 0, palette, colours: 16 }).toBuffer();
    const output = optimizeLosslessPng(original);
    assert.ok(output.length < original.length);
    assert.deepEqual(await decode(output), await decode(original));
    const meta = await sharp(output).metadata();
    assert.equal(meta.density, 144);
    assert.deepEqual(meta.icc, (await sharp(original).metadata()).icc);
  });
}
// Сценарий: 16-битный PNG сохраняет глубину и младшие байты образцов.
test("16-bit PNG retains low bytes and colour depth", async () => {
  const chunk = (type, data) => {
    // Формирует валидный тестовый PNG-блок с CRC для точной проверки 16-битных младших байтов.

    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    result.write(type, 4);
    data.copy(result, 8);
    result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(19, 0);
  header.writeUInt32BE(13, 4);
  header[8] = 16;
  header[9] = 2;
  const rows = Buffer.alloc((19 * 6 + 1) * 13);
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 19 * 3; x++) rows.writeUInt16BE((x * 123 + y * 511) & 65535, y * 115 + 1 + x * 2);
  }
  const original = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
  const output = optimizeLosslessPng(original);
  assert.ok(output.length < original.length);
  assert.equal((await sharp(output).metadata()).bitsPerSample, 16);
  const native = (bytes) => /* Декодирует образцы в ushort, чтобы 8-битное сравнение не скрывало потерю точности цвета. */ sharp(bytes).toColourspace("rgb16").raw({ depth: "ushort" }).toBuffer();
  assert.deepEqual(await native(output), await native(original));
});
// Сценарий: Interlaced PNG сохраняется побайтно вместо неподдерживаемого преобразования.
test("interlaced PNG is retained unchanged", async () => {
  const original = await sharp(rgba, { raw: { width: 17, height: 23, channels: 4 } })
    .png({ progressive: true }).toBuffer();
  assert.deepEqual(optimizeLosslessPng(original), original);
});
