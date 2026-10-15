import { expect, it, vi } from "vitest";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import {
  uploadPrivateContentFile,
  requirePrivateContentReceipt,
} from "../apps/frontend/src/shared/media/private-content-upload";
import {
  articleFileReference,
  resolveArticleFiles,
  selectArticleFiles,
  type PrivateArticleFile,
} from "../apps/frontend/src/domain/content/private-article-files";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: async (file: File) =>
    Buffer.from(await file.arrayBuffer()).toString("base64"),
}));

const assetId = "3af23d8c-140f-454b-a123-123456789abc";
const url = `/api/media/content-files/${assetId}`;
const photo = (): PrivateArticleFile => ({
  key: "article-photo-intent-0001",
  usage: "articlePhoto",
  file: new File(["png bytes"], "photo.png", { type: "image/png" }),
});
const receipt = (file: PrivateArticleFile, patch = {}) => ({
  state: "ready",
  assetId,
  usage: file.usage,
  filename: file.file.name,
  mimeType:
    file.usage === "articlePhoto" ? "image/webp" : "text/plain; charset=utf-8",
  fileSize: file.file.size,
  url,
  ...patch,
});
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
it("resolves only referenced photos/documents and preserves old URLs, block order and repeated references", () => {
  const file = photo();
  file.attempted = true;
  file.receipt = receipt(file) as NonNullable<PrivateArticleFile["receipt"]>;
  const ref = articleFileReference(file);
  const sections = [
    { type: "photo" as const, url: "/existing.png", caption: "old" },
    { type: "carousel" as const, urls: [ref, "/other.png", ref] },
    { type: "png" as const, url: ref },
  ];
  expect(selectArticleFiles(sections, [file])).toEqual([file]);
  expect(resolveArticleFiles(sections, [file])).toEqual([
    { type: "photo", url: "/existing.png", caption: "old" },
    { type: "carousel", urls: [url, "/other.png", url] },
    { type: "png", url },
  ]);
  expect(sections[1].urls?.[0]).toBe(ref);
  expect(
    selectArticleFiles([{ type: "text", text: "removed" }], [file]),
  ).toEqual([]);
});
it("refuses missing bytes, wrong usage and unresolved receipts before article submission", () => {
  const file = photo(),
    ref = articleFileReference(file);
  expect(() => selectArticleFiles([{ type: "photo", url: ref }], [])).toThrow();
  expect(() =>
    selectArticleFiles([{ type: "link", url: ref }], [file]),
  ).toThrow();
  expect(() =>
    resolveArticleFiles([{ type: "photo", url: ref }], [file]),
  ).toThrow();
});
it("checkpoints bytes/key before upload and recovers a lost reply status-first without another upload", async () => {
  const file = photo(),
    states: unknown[] = [];
  const checkpoint = vi.fn(async () => {
    states.push(
      structuredClone({
        key: file.key,
        attempted: file.attempted,
        receipt: file.receipt,
      }),
    );
  });
  const api = {
    upload: vi.fn(async () => {
      expect(states).toHaveLength(1);
      throw new Error("lost reply");
    }),
    status: vi.fn(async () => receipt(file, { fileSize: 80 })),
  };
  await expect(
    uploadPrivateContentFile(file, file.usage, api, task(), checkpoint),
  ).rejects.toThrow("lost reply");
  await uploadPrivateContentFile(file, file.usage, api, task(), checkpoint);
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.status).toHaveBeenCalledWith(
    { idempotencyKey: file.key },
    expect.any(AbortSignal),
  );
  expect(file.receipt?.url).toBe(url);
  expect(file.receipt?.fileSize).toBe(80);
});
it("replays notRecorded with identical key and bytes and accepts exact document length with normalized MIME", async () => {
  const file: PrivateArticleFile = {
    key: "article-document-intent-0001",
    usage: "articleDocument",
    file: new File(["text bytes"], "file.txt", { type: "text/plain" }),
    attempted: true,
  };
  const api = {
    upload: vi.fn(async (_input: unknown, _signal: AbortSignal) =>
      receipt(file),
    ),
    status: vi.fn(async () => ({ state: "notRecorded" })),
  };
  await uploadPrivateContentFile(file, file.usage, api, task(), async () => {});
  expect(api.upload.mock.calls[0]?.[0]).toMatchObject({
    idempotencyKey: file.key,
    usage: "articleDocument",
    filename: "file.txt",
    mimeType: "text/plain",
    base64: Buffer.from("text bytes").toString("base64"),
  });
  expect(
    resolveArticleFiles(
      [{ type: "link", url: articleFileReference(file), label: "document" }],
      [file],
    ),
  ).toEqual([{ type: "link", url, label: "document" }]);
  expect(() =>
    requirePrivateContentReceipt(
      receipt(file, { fileSize: 1 }),
      file.file,
      file.usage,
    ),
  ).toThrow();
});
it.each([
  { usage: "postPhoto" },
  { url: "https://external.test/file" },
  { objectKey: "private/file" },
  { state: "pending", url },
])("rejects an incompatible or leaking receipt %j", (patch) => {
  const file = photo();
  expect(() =>
    requirePrivateContentReceipt(receipt(file, patch), file.file, file.usage),
  ).toThrow();
});
it("a cancelled/account-switched upload cannot accept a late receipt or write a checkpoint", async () => {
  const file = photo(),
    scope = new OperationScope(),
    operation = scope.begin("save", new AbortController().signal, () => true)!;
  const checkpoint = vi.fn(async () => {});
  const api = {
    upload: async () => {
      scope.cancel();
      return receipt(file);
    },
    status: async () => ({ state: "notRecorded" }),
  };
  await expect(
    uploadPrivateContentFile(file, file.usage, api, operation, checkpoint),
  ).rejects.toThrow();
  expect(file.receipt).toBeUndefined();
  expect(checkpoint).toHaveBeenCalledTimes(1);
});
it("storage failure prevents any upload", async () => {
  const file = photo(),
    api = { upload: vi.fn(), status: vi.fn() };
  await expect(
    uploadPrivateContentFile(file, file.usage, api, task(), async () => {
      throw new Error("storage unavailable");
    }),
  ).rejects.toThrow("storage unavailable");
  expect(api.upload).not.toHaveBeenCalled();
});
