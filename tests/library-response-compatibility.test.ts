/** Серверно подготовленные metadata проходят настоящий клиентский parser без БД, S3 и сети. */
import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prepareLibraryMigration } from "../apps/backend/src/content/library-migration-manifest";
import {
  getLibraryFiles,
  parseLibraryFiles,
} from "../apps/frontend/src/features/library/library-files-api";

// Exercise server-prepared metadata through the real frontend parser.
// No database, network, storage credentials or production objects.
/** Готовим migration bytes/hash, затем строим ровно ту metadata-форму, которую serializer выдаёт из сохранённых полей. */
async function prepare(bytes: Buffer, mimeType: string, filename: string) {
  const result = await prepareLibraryMigration({
    materialKey: "recipes",
    idempotencyKey: "audit-library-20261102",
    files: [
      {
        fileKey: "main",
        filename,
        mimeType,
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sortOrder: 0,
        expectedRevision: 0,
      },
    ],
  });
  const file = result.files[0];
  // The list serializer returns stored MIME/name verbatim (library-files.ts).
  return {
    files: [
      {
        fileKey: file.fileKey,
        filename: file.filename,
        mimeType: file.mimeType,
        fileSize: file.bytes.length,
        sortOrder: 0,
        revision: 1,
        url: "/api/media/library-files/recipes/main",
      },
    ],
    nextCursor: null,
  };
}
/** UTF-8/16 и Windows-1251 варианты MIME должны сохраняться совместимыми после серверной подготовки. */
it.each([
  ["text/plain", "text/plain; charset=utf-8", Buffer.from("Synthetic text")],
  [
    "text/plain; charset=utf-16be",
    "text/plain; charset=utf-16be",
    Buffer.from("Текст", "utf16le").swap16(),
  ],
  [
    'text/plain; charset="utf-8"',
    'text/plain; charset="utf-8"',
    Buffer.from("Текст"),
  ],
  [
    "text/plain; charset=utf-16le",
    "text/plain; charset=utf-16le",
    Buffer.from("Текст", "utf16le"),
  ],
  [
    "text/plain; charset=windows-1251",
    "text/plain; charset=windows-1251",
    Buffer.from([0xd2, 0xe5, 0xea, 0xf1, 0xf2]),
  ],
])(
  "accepts server-prepared TXT metadata: %s",
  async (declared, expected, bytes) => {
    const response = await prepare(bytes, declared, "readme.txt");
    expect(response.files[0].mimeType).toBe(expected);
    expect(parseLibraryFiles(response, "recipes")).toEqual(response);
  },
);
/** Клиент объединяет разные допустимые форматы двух страниц, сохраняя signal и encoded cursor. */
it("reads a mixed TXT/PDF list through a subsequent page without losing metadata", async () => {
  const txt = await prepare(Buffer.from("Readme"), "text/plain", "readme.txt");
  const pdf = await prepare(
    Buffer.from("%PDF-1.7\n%%EOF"),
    "application/pdf",
    "guide.pdf",
  );
  const other = {
    ...pdf.files[0],
    fileKey: "guide",
    url: "/api/media/library-files/recipes/guide",
  };
  const read = vi
    .fn()
    .mockResolvedValueOnce({ ...txt, nextCursor: "0:1" })
    .mockResolvedValueOnce({ ...pdf, files: [other] });
  const signal = new AbortController().signal;
  expect(await getLibraryFiles("recipes", signal, read)).toEqual([
    ...txt.files,
    other,
  ]);
  expect(read.mock.calls).toEqual([
    ["/api/library/materials/recipes/files", signal],
    ["/api/library/materials/recipes/files?cursor=0%3A1", signal],
  ]);
});
/** Имена до серверного предела 512 символов не делают весь список несовместимым. */
it.each([255, 256, 512])(
  "preserves valid filename length %s alongside other files",
  async (length) => {
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .webp()
      .toBuffer();
    const response = await prepare(
      bytes,
      "image/webp",
      "x".repeat(length - 5) + ".webp",
    );
    response.files.push({
      ...response.files[0],
      fileKey: "second",
      filename: "other.webp",
      url: "/api/media/library-files/recipes/second",
    });
    expect(parseLibraryFiles(response, "recipes")).toEqual(response);
    expect(response.files[0].filename.length).toBe(length);
  },
);
