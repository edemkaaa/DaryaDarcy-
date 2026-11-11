/** Ответ списка закрытых файлов проверяется строго до выдачи UI, включая все страницы и отмену. */
import { expect, it, vi } from "vitest";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
import {
  getLibraryFiles,
  parseLibraryFiles,
} from "../apps/frontend/src/features/library/library-files-api";

/** Собираем канонический metadata DTO с защищённым относительным URL, без настоящего файла. */
const file = (fileKey = "holly") => ({
  fileKey,
  sortOrder: 0,
  revision: 1,
  filename: "pattern.webp",
  mimeType: "image/webp",
  fileSize: 123,
  url: `/api/media/library-files/patterns/${fileKey}`,
});
/** Страница содержит только files и opaque nextCursor, чтобы отдельно подменять повреждённые поля. */
const page = (files = [file()], nextCursor: string | null = null) => ({
  files,
  nextCursor,
});

/** Внешний/direct URL, другая коллекция и query-token не проходят вместо канонического download endpoint. */
it.each([
  "https://disk.yandex.ru/i/public",
  "https://storage.example.test/private.webp",
  "/api/media/library-files/recipes/holly",
  "/api/media/library-files/patterns/holly?token=secret",
])("rejects a noncanonical file URL: %s", (url) => {
  expect(() =>
    parseLibraryFiles(page([{ ...file(), url }]), "patterns"),
  ).toThrow();
});
/** Дубли и лишние storage-поля отклоняются, а не молча теряются. */
it("rejects duplicate files and untrusted response fields", () => {
  expect(() => parseLibraryFiles(page([file(), file()]), "patterns")).toThrow();
  expect(() =>
    parseLibraryFiles({ ...page(), storageUrl: "secret" }, "patterns"),
  ).toThrow();
});
/** Второй cursor URL кодируется, обе страницы используют исходный signal, UI получает только полный набор. */
it("loads every page before exposing files and preserves cancellation", async () => {
  const signal = new AbortController().signal;
  const read = vi
    .fn()
    .mockResolvedValueOnce(page([file()], "0:5"))
    .mockResolvedValueOnce(page([file("star")]));
  expect(
    (await getLibraryFiles("patterns", signal, read)).map(
      (file) => file.fileKey,
    ),
  ).toEqual(["holly", "star"]);
  expect(read.mock.calls).toEqual([
    ["/api/library/materials/patterns/files", signal],
    ["/api/library/materials/patterns/files?cursor=0%3A5", signal],
  ]);
});
/** 404/503 следующей страницы не превращается в успешный частичный список. */
it.each([404, 503])(
  "does not expose a partial list after HTTP %s",
  async (status) => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(page([file()], "0:5"))
      .mockRejectedValueOnce(new ApiError("Unavailable", status));
    await expect(
      getLibraryFiles("patterns", new AbortController().signal, read),
    ).rejects.toMatchObject({ status });
    expect(read).toHaveBeenCalledTimes(2);
  },
);
/** Защищаемся от бесконечной пагинации и повторяющихся fileKey. */
it("rejects repeated cursors and duplicates across pages", async () => {
  const signal = new AbortController().signal;
  const repeated = vi
    .fn()
    .mockResolvedValueOnce(page([file()], "0:5"))
    .mockResolvedValueOnce(page([file("star")], "0:5"));
  await expect(getLibraryFiles("patterns", signal, repeated)).rejects.toThrow();
  const duplicate = vi
    .fn()
    .mockResolvedValueOnce(page([file()], "0:5"))
    .mockResolvedValueOnce(page([file()]));
  await expect(
    getLibraryFiles("patterns", signal, duplicate),
  ).rejects.toThrow();
});

/** Исполняемые/неподдержанные MIME и повреждённые параметры не попадают в download contract. */
it.each([
  "text/html",
  "image/svg+xml",
  "application/msword",
  "application/octet-stream",
  "text/plain;",
  "text/plain; charset=",
  'text/plain; charset="utf-8',
  "text/plain; charset=utf-8\r\nX-Header: value",
  "text/plain\u0000",
  `text/plain; name=${"x".repeat(128)}`,
])("rejects unsupported or malformed library MIME: %s", (mimeType) => {
  expect(() =>
    parseLibraryFiles(page([{ ...file(), mimeType }]), "patterns"),
  ).toThrow();
});

/** Пустое/длинное имя, разделители пути и управляющие символы недопустимы. */
it.each([
  "",
  "x".repeat(513),
  "../file.pdf",
  "dir\\file.pdf",
  "file\n.pdf",
  "file\u007f.pdf",
])(
  "rejects a filename outside the server metadata contract: %s",
  (filename) => {
    expect(() =>
      parseLibraryFiles(page([{ ...file(), filename }]), "patterns"),
    ).toThrow();
  },
);
