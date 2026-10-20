import { expect, it, vi } from "vitest";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
import {
  getLibraryFiles,
  parseLibraryFiles,
} from "../apps/frontend/src/features/library/library-files-api";

const file = (fileKey = "holly") => ({
  fileKey,
  sortOrder: 0,
  revision: 1,
  filename: "pattern.webp",
  mimeType: "image/webp",
  fileSize: 123,
  url: `/api/media/library-files/patterns/${fileKey}`,
});
const page = (files = [file()], nextCursor: string | null = null) => ({
  files,
  nextCursor,
});

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
it("rejects duplicate files and untrusted response fields", () => {
  expect(() => parseLibraryFiles(page([file(), file()]), "patterns")).toThrow();
  expect(() =>
    parseLibraryFiles({ ...page(), storageUrl: "secret" }, "patterns"),
  ).toThrow();
});
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
