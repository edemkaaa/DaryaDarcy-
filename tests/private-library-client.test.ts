import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  apiUrl: (path: string) => "http://127.0.0.1:1" + path,
}));
import {
  readAestheticGuide,
  readPatternBindings,
} from "../apps/frontend/src/domain/library/private-library";
import { aestheticGuides } from "../apps/backend/src/content/aesthetic-guides";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
it("parses only the requested guide and never persists the paid payload", async () => {
  fetcher.mockResolvedValue(
    response({ key: "cottagecore", ...aestheticGuides.cottagecore }),
  );
  expect(await readAestheticGuide("cottagecore")).toEqual({
    key: "cottagecore",
    ...aestheticGuides.cottagecore,
  });
  expect(fetcher).toHaveBeenCalledWith(
    "http://127.0.0.1:1/api/library/guides/aesthetics/cottagecore",
    expect.objectContaining({ cache: "no-store", credentials: "include" }),
  );
});
it.each([
  null,
  {},
  { key: "goblincore", ...aestheticGuides.cottagecore },
  { key: "cottagecore", ...aestheticGuides.cottagecore, free: "unexpected" },
])("rejects malformed/wrong-key payload %j", async (value) => {
  fetcher.mockResolvedValue(response(value));
  await expect(readAestheticGuide("cottagecore")).rejects.toMatchObject({
    kind: "invalid-response",
  });
});
it.each([404, 503])(
  "does not normalize failed guide read %i into a successful empty guide",
  async (status) => {
    fetcher.mockResolvedValue(response({ error: "private-marker" }, status));
    await expect(readAestheticGuide("cottagecore")).rejects.toMatchObject({
      status,
    });
  },
);
const file = (key: string) => ({
  fileKey: key,
  sortOrder: 0,
  revision: 1,
  filename: "synthetic",
  mimeType: key === "loshadka" ? "application/pdf" : "image/webp",
  fileSize: 123,
  url: `/api/media/library-files/patterns/${key}`,
});
it("follows bounded metadata pages and returns only canonical known pattern slots", async () => {
  fetcher.mockResolvedValueOnce(
    response({ files: [file("holly"), file("other")], nextCursor: "0:2" }),
  );
  fetcher.mockResolvedValueOnce(
    response({
      files: [file("sock"), file("star"), file("apple"), file("loshadka")],
      nextCursor: null,
    }),
  );
  expect(Object.keys(await readPatternBindings()).sort()).toEqual([
    "apple",
    "holly",
    "sock",
    "star",
  ]);
  expect(fetcher.mock.calls[1][0]).toContain("?cursor=0%3A2");
});
it("finishes after the four winter files without requesting a free PDF binding", async () => {
  fetcher.mockResolvedValueOnce(
    response({
      files: ["holly", "sock", "star", "apple"].map(file),
      nextCursor: "0:5",
    }),
  );
  expect(Object.keys(await readPatternBindings()).sort()).toEqual([
    "apple",
    "holly",
    "sock",
    "star",
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  {
    files: [{ ...file("holly"), url: "https://public.example.test/original" }],
    nextCursor: null,
  },
  { files: [{ ...file("holly"), mimeType: "text/html" }], nextCursor: null },
  { files: [file("holly"), file("holly")], nextCursor: null },
  { files: Array(51).fill(file("holly")), nextCursor: null },
  { files: [], nextCursor: "unsafe" },
])(
  "rejects unsafe binding metadata without a public fallback",
  async (value) => {
    fetcher.mockResolvedValue(response(value));
    await expect(readPatternBindings()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);
it("rejects a repeated pagination cursor", async () => {
  fetcher.mockImplementation(async () =>
    response({ files: [], nextCursor: "0:2" }),
  );
  await expect(readPatternBindings()).rejects.toMatchObject({
    kind: "invalid-response",
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("honors cancellation without starting a read", async () => {
  const signal = AbortSignal.abort();
  await expect(readAestheticGuide("cottagecore", signal)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
