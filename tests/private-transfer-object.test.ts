/** Потоковый перенос проверяется на собственном S3 wire без БД: original bytes/key остаются нетронутыми. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { ensurePrivateTransferredObject } from "../apps/backend/src/media/private-transfer-object";
import {
  digest,
  privateStorageNamespace,
  privateAttachmentObjectKey,
} from "../apps/backend/src/media/private-upload-object";

let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
const bytes = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypmp42"),
  Buffer.alloc(16),
]);
const key = "club/tg/копия@2026.mp4",
  etag = '"' + createHash("md5").update(bytes).digest("hex") + '"';
/** Создаём synthetic source object с pinned ETag и отдельный loopback namespace. */
beforeEach(async () => {
  wire = await openPrivateUploadWire({ content: true });
  for (const [name, value] of Object.entries({
    S3_ENDPOINT: wire.endpoint,
    S3_BUCKET: wire.bucket,
    S3_ACCESS_KEY: "copy-fixture",
    S3_SECRET_KEY: "copy-fixture-secret",
  }))
    vi.stubEnv(name, value);
  wire.objects.set(key, {
    bytes: Buffer.from(bytes),
    etag,
    mime: "video/mp4",
    metadata: {},
  });
});
/** Закрываем wire и возвращаем S3 env. */
afterEach(async () => {
  await wire?.close();
  vi.unstubAllEnvs();
});
/** Новый destination intent связан с namespace, типом и размером исходника. */
function receipt() {
  return {
    assetId: randomUUID(),
    type: "video" as const,
    payloadHash: digest("owned copy intent"),
    fileSize: bytes.length,
    mimeType: "video/mp4",
    namespaceHash: privateStorageNamespace().hash,
  };
}
/** Передаём разрешённый старый key и ожидаемый ETag, без произвольного URL. */
const source = () => ({ key, etag, sha256: null });
/** Проверяем metadata/content integrity и условный PUT; настоящий Timeweb здесь не вызывается. */
describe("private conditional streaming transport without a database", () => {
  /** Оба SHA и bytes совпадают, повтор не делает PUT/DELETE и не изменяет original. */
  it("verifies full source/destination SHA and reuses the same owned copy", async () => {
    const row = receipt(),
      result = await ensurePrivateTransferredObject(row, source());
    expect(result.sha256).toBe(digest(bytes));
    expect(await ensurePrivateTransferredObject(row, source())).toEqual(result);
    expect(
      wire.objects.get(privateAttachmentObjectKey("video", row.assetId))!.bytes,
    ).toEqual(bytes);
    expect(wire.objects.get(key)!.bytes).toEqual(bytes);
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(1);
    expect(wire.effects.some((x) => x.startsWith("DELETE "))).toBe(false);
  });
  /** Потерянный ACK восстанавливается по имеющемуся объекту без второй записи. */
  it("recovers a lost streaming PUT acknowledgement from persisted object metadata", async () => {
    const row = receipt();
    wire.dropPutAck();
    await expect(
      ensurePrivateTransferredObject(row, source()),
    ).rejects.toThrow();
    expect((await ensurePrivateTransferredObject(row, source())).sha256).toBe(
      digest(bytes),
    );
    expect(wire.objects.size).toBe(2);
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(1);
  });
  /** Многоchunk video копируется байт-в-байт с полным digest и повторной проверкой source. */
  it("streams multiple network chunks without changing the video bytes", async () => {
    const video = Buffer.concat([bytes, Buffer.alloc(512 * 1024, 41)]);
    const pinned = '"' + createHash("md5").update(video).digest("hex") + '"';
    wire.objects.set(key, {
      bytes: video,
      etag: pinned,
      mime: "video/mp4",
      metadata: {},
    });
    const row = { ...receipt(), fileSize: video.length };
    const result = await ensurePrivateTransferredObject(row, {
      key,
      etag: pinned,
      sha256: digest(video),
    });
    expect(result.sha256).toBe(digest(video));
    expect(
      wire.objects.get(privateAttachmentObjectKey("video", row.assetId))!.bytes,
    ).toEqual(video);
    expect(
      wire.effects.filter((x) => x.startsWith("GET ") && x.includes("club/tg")),
    ).toHaveLength(2);
  });
  /** Неверный известный digest останавливает до PUT. */
  it("rejects a mismatching source SHA before creating any destination", async () => {
    await expect(
      ensurePrivateTransferredObject(receipt(), {
        ...source(),
        sha256: "0".repeat(64),
      }),
    ).rejects.toThrow();
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(0);
  });
  /** Недостаточная private-policy не допускает destination write. */
  it("refuses an unsafe policy before copying", async () => {
    wire.rejectPolicy(true);
    await expect(
      ensurePrivateTransferredObject(receipt(), source()),
    ).rejects.toThrow();
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(0);
  });
  /** Чужой existing object не перезаписывается под видом retry. */
  it("refuses unrelated pre-existing destination data without overwriting it", async () => {
    const row = receipt(),
      destination = privateAttachmentObjectKey("video", row.assetId),
      foreign = Buffer.from("unrelated existing data");
    wire.objects.set(destination, {
      bytes: foreign,
      etag: '"foreign"',
      mime: "video/mp4",
      metadata: {},
    });
    await expect(
      ensurePrivateTransferredObject(row, source()),
    ).rejects.toThrow();
    expect(wire.objects.get(destination)!.bytes).toEqual(foreign);
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(0);
  });
  /** Объявленный video/mp4 с не-video bytes не копируется. */
  it("verifies actual bytes instead of trusting video metadata", async () => {
    const bad = Buffer.from("this is not a video");
    wire.objects.set(key, {
      bytes: bad,
      etag,
      mime: "video/mp4",
      metadata: {},
    });
    await expect(
      ensurePrivateTransferredObject(
        { ...receipt(), fileSize: bad.length },
        source(),
      ),
    ).rejects.toThrow();
    expect(wire.effects.filter((x) => x.startsWith("PUT "))).toHaveLength(0);
  });
  /** Traversal, private destination namespace и control characters запрещены до wire. */
  it.each([
    "../other",
    "club/tg/../other",
    "content/private-v1/other",
    "club/tg/bad\nname",
  ])("rejects unsafe source key %j without network access", async (unsafe) => {
    await expect(
      ensurePrivateTransferredObject(receipt(), { ...source(), key: unsafe }),
    ).rejects.toThrow();
    expect(wire.effects).toHaveLength(0);
  });
  /** Intent сверх1ГиБ или другого namespace не начинает даже чтение объекта. */
  it("rejects oversized or foreign-namespace intents without allocating the file", async () => {
    await expect(
      ensurePrivateTransferredObject(
        { ...receipt(), fileSize: 1024 ** 3 + 1 },
        source(),
      ),
    ).rejects.toThrow();
    await expect(
      ensurePrivateTransferredObject(
        { ...receipt(), namespaceHash: "wrong" },
        source(),
      ),
    ).rejects.toThrow();
    expect(wire.effects).toHaveLength(0);
  });
});
