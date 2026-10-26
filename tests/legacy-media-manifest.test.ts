import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prepareLegacyMedia } from "../apps/backend/src/content/legacy-media-manifest";

const hash = (value: Buffer | string) =>
  createHash("sha256").update(value).digest("hex");
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
describe("lossless legacy migration manifest", () => {
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
  it("rejects executable and truncated images", async () => {
    await expect(
      prepareLegacyMedia(input(Buffer.from('<svg onload="alert(1)"></svg>'))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      prepareLegacyMedia(input(Buffer.from([255, 216, 255, 0]))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
