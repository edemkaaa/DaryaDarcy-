import { expect, it } from "vitest";
import { resolveAestheticImages } from "../apps/frontend/src/domain/library/aesthetic-visuals";
import type { LibraryFile } from "../apps/frontend/src/features/library/library-files-api";

const source = {
  uri: "/assets/results/castlecore/outfits/outfit3.lossless.webp",
};
const file: LibraryFile = {
  fileKey: "outfits-outfit3",
  sortOrder: 0,
  revision: 1,
  filename: "visual.webp",
  mimeType: "image/webp",
  fileSize: 12,
  url: "/api/media/library-files/aesthetic-castlecore/outfits-outfit3",
};
it("uses only the confirmed private binding, preserving group order", () => {
  expect(resolveAestheticImages("castlecore", [file], [source])).toEqual([
    { uri: "/api/media/library-files/aesthetic-castlecore/outfits-outfit3" },
  ]);
});
it("does not return a public fallback for missing bindings", () => {
  expect(() => resolveAestheticImages("castlecore", [], [source])).toThrow();
});
it("refuses a binding or source from another material", () => {
  expect(() =>
    resolveAestheticImages("cottagecore", [file], [source]),
  ).toThrow();
  expect(() =>
    resolveAestheticImages(
      "castlecore",
      [{ ...file, url: "https://public.test/leak.webp" }],
      [source],
    ),
  ).toThrow();
});
it("does not silently accept duplicate binding identities", () => {
  expect(() =>
    resolveAestheticImages("castlecore", [file, file], [source]),
  ).toThrow();
});
