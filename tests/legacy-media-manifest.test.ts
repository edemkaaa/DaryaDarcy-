/** Lossless migration manifest проверяется офлайн по исходным bytes и закреплённой привязке; настоящие файлы не меняются. */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  prepareLegacyMedia,
  prepareLegacyMigration,
} from "../apps/backend/src/content/legacy-media-manifest";

/** Digest fixtures вычисляется независимо от migration helper. */
const hash = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
/** Намерение связывает subject/slot/старый URL и ожидаемые source bytes с обязательным preserveOriginal. */
function input(
  bytes: Buffer,
  type = "photo",
  kind = "postPhoto",
  slot = "photos.0",
) {
  const subject = { kind, id: 70001, slot };
  const expectedOldUrl =
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/synthetic.jpg";
  return {
    version: 1,
    idempotencyKey: "legacy:" + hash(JSON.stringify([subject, expectedOldUrl])),
    operationId: hash(JSON.stringify([subject, expectedOldUrl])),
    subject,
    expectedOldUrl,
    expectedSourceSha256: hash(bytes),
    expectedSourceBytes: bytes.length,
    preserveOriginal: true,
    type,
    filename: "synthetic",
    bytes,
  };
}
/** Проверяем строгий источник, отдельный s3Stream для больших video и отсутствие перекодирования. */
describe("lossless legacy migration manifest", () => {
  /** Сохранённая Unicode-строка URL остаётся точной; encoded separators/control/traversal отвергаются. */
  it("preserves an exact Unicode database URL while safely resolving its storage key", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    const request = input(bytes),
      expectedOldUrl =
        "https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/моё фото.jpg";
    const operationId = hash(JSON.stringify([request.subject, expectedOldUrl]));
    expect(
      (await prepareLegacyMedia({ ...request, expectedOldUrl, operationId }))
        .expectedOldUrl,
    ).toBe(expectedOldUrl);
    for (const suffix of [
      "%2Fprivate.jpg",
      "%5Cprivate.jpg",
      "%2E%2E/file.jpg",
      "bad%0Aname.jpg",
      "bad%zz.jpg",
    ]) {
      const old = `https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/${suffix}`;
      await expect(
        prepareLegacyMedia({
          ...request,
          expectedOldUrl: old,
          operationId: hash(JSON.stringify([request.subject, old])),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });
  /** Исторический club/tg key разрешён без расширения allowlist host. */
  it("accepts the existing Telegram club prefix and @ filenames without broadening source hosts", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    const request = input(bytes),
      expectedOldUrl =
        "https://s3.twcstorage.ru/daryadarcy-s3/club/tg/photo_2025-09-15@10-00-00.jpg";
    const operationId = hash(JSON.stringify([request.subject, expectedOldUrl]));
    expect(
      (await prepareLegacyMedia({ ...request, expectedOldUrl, operationId }))
        .bytes,
    ).toEqual(bytes);
  });
  /** 200МиБ video получает streaming plan с ETag/probe, но не обходит обычный byte-upload limit; неверные bounds запрещены. */
  it("prepares a large-video copy using only a bounded probe, without changing byte-upload limits", async () => {
    const probe = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from("ftypmp42"),
      Buffer.alloc(16),
    ]);
    const request = input(probe, "video", "postMedia", "url");
    const expectedOldUrl =
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/videos/fixture.mp4";
    const operationId = hash(JSON.stringify([request.subject, expectedOldUrl]));
    const { bytes: _bytes, ...base } = request;
    const copy = {
      ...base,
      operationId,
      expectedOldUrl,
      transport: "s3Stream",
      probe,
      expectedSourceBytes: 200 * 1024 * 1024,
      expectedSourceSha256: null,
      expectedSourceETag: '"fixture-etag"',
    };
    const result = await prepareLegacyMigration(copy);
    expect(result.transport).toBe("s3Stream");
    expect(result.expectedSourceBytes).toBe(200 * 1024 * 1024);
    expect("bytes" in result).toBe(false);
    await expect(
      prepareLegacyMedia({
        ...request,
        expectedSourceBytes: 200 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (const changes of [
      { expectedSourceBytes: 1024 ** 3 + 1 },
      { expectedSourceETag: '"bad\r\nheader"' },
      { probe: Buffer.alloc(65537) },
      { type: "photo" },
    ])
      await expect(
        prepareLegacyMigration({ ...copy, ...changes }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  /** JPEG/PNG/WebP/GIF сохраняются точной отдельной копией Buffer с тем же hash. */
  it.each(["jpeg", "png", "webp", "gif"] as const)(
    "keeps %s bytes instead of re-encoding",
    async (format) => {
      const bytes = await sharp({
        create: { width: 4, height: 3, channels: 4, background: "red" },
      })
        [format]()
        .toBuffer();
      const result = await prepareLegacyMedia(input(bytes));
      expect(result.bytes).toEqual(bytes);
      expect(result.mimeType).toBe(`image/${format}`);
      expect(result.sha256).toBe(hash(bytes));
      expect(result.bytes).not.toBe(bytes);
    },
  );
  /** Поздняя мутация caller Buffer не меняет уже принятые bytes плана. */
  it("copies caller bytes before asynchronous verification", async () => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const saved = Buffer.from(bytes),
      manifest = input(bytes);
    const pending = prepareLegacyMedia(manifest);
    bytes.fill(0);
    expect((await pending).bytes).toEqual(saved);
  });
  /** Допустимые video/document распознаются без перекодирования. */
  it("recognizes a small video container and a document without transcoding", async () => {
    const video = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from("ftypmp42"),
      Buffer.alloc(16),
    ]);
    const clip = await prepareLegacyMedia(
      input(video, "video", "postMedia", "url"),
    );
    expect(clip.mimeType).toBe("video/mp4");
    expect(clip.bytes).toEqual(video);
    const document = Buffer.from("synthetic text document");
    expect(
      (
        await prepareLegacyMedia(
          input(document, "document", "articleMedia", "sections.1.url"),
        )
      ).bytes,
    ).toEqual(document);
  });
  /** Digest/size/URL/operation mismatch, preserveOriginal:false и неизвестные поля блокируют план. */
  it.each([
    { expectedSourceSha256: "0".repeat(64) },
    { expectedSourceBytes: 1 },
    { expectedOldUrl: "http://127.0.0.1/secret" },
    {
      expectedOldUrl:
        "https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/a?secret=hidden",
    },
    { operationId: "0".repeat(64) },
    { preserveOriginal: false },
    { path: "/private/secret" },
    { subject: { kind: "publicReference", id: 1, slot: "article.cover" } },
  ])(
    "rejects unverified bytes, wrong source/identity or destructive metadata: %j",
    async (change) => {
      await expect(
        prepareLegacyMedia({ ...input(Buffer.from("synthetic")), ...change }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    },
  );
  /** SVG и повреждённый JPEG не считаются переносимым фото. */
  it("rejects executable and truncated images", async () => {
    await expect(
      prepareLegacyMedia(input(Buffer.from('<svg onload="alert(1)"></svg>'))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      prepareLegacyMedia(input(Buffer.from([255, 216, 255, 0]))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
