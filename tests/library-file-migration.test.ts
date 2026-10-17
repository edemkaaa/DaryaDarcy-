import { expect, expectTypeOf, it } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { inspectLibraryMigration } from "../apps/backend/src/content/library-file-migration";
import { uploadPrivateContentFile } from "../apps/backend/src/content/private-content-uploads";

it("keeps operator-only library usages out of the existing editor upload contract", () => {
  expectTypeOf<Awaited<ReturnType<typeof uploadPrivateContentFile>>["usage"]>().toEqualTypeOf<
    "postPhoto" | "articlePhoto" | "articleDocument" | "commentPhoto"
  >();
});

const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const document = () => {
  const bytes = Buffer.from("synthetic library document");
  return {
    fileKey: "main",
    filename: "fixture.txt",
    mimeType: "text/plain",
    sha256: hash(bytes),
    bytes,
    sortOrder: 0,
    expectedRevision: 0,
  };
};
it("dry-runs a verified manifest without database/storage configuration or exposing bytes and names", async () => {
  const report = await inspectLibraryMigration({
    materialKey: "recipes",
    idempotencyKey: "library-rehearsal-0001",
    files: [document()],
  });
  expect(report).toMatchObject({
    materialKey: "recipes",
    files: 1,
    totalBytes: 26,
  });
  expect(JSON.stringify(report)).not.toMatch(
    /synthetic library document|fixture.txt|base64/,
  );
});
it("rejects byte substitution, duplicate slots, unknown materials and path-like names", async () => {
  for (const input of [
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [{ ...document(), sha256: "0".repeat(64) }],
    },
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [document(), document()],
    },
    {
      materialKey: "unknown",
      idempotencyKey: "library-rehearsal-0001",
      files: [document()],
    },
    {
      materialKey: "recipes",
      idempotencyKey: "library-rehearsal-0001",
      files: [{ ...document(), filename: "../fixture.txt" }],
    },
  ])
    await expect(inspectLibraryMigration(input)).rejects.toThrow();
});
it("validates real image bytes without lossy conversion and rejects disguised active content", async () => {
  const bytes = await sharp({
    create: { width: 3, height: 4, channels: 3, background: "red" },
  })
    .webp({ lossless: true })
    .toBuffer();
  const photo = {
    ...document(),
    fileKey: "holly",
    filename: "fixture.webp",
    mimeType: "image/webp",
    bytes,
    sha256: hash(bytes),
  };
  const input = {
    materialKey: "patterns",
    idempotencyKey: "library-image-fixture-0001",
    files: [photo],
  };
  expect(await inspectLibraryMigration(input)).toMatchObject({
    files: 1,
    totalBytes: bytes.length,
  });
  const hostile = Buffer.from("<svg onload='alert(1)'/>");
  await expect(
    inspectLibraryMigration({
      ...input,
      files: [{ ...photo, bytes: hostile, sha256: hash(hostile) }],
    }),
  ).rejects.toThrow();
});
