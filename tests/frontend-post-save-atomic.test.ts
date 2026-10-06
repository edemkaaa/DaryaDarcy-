import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: vi.fn(async () => "FILE_BASE64"),
}));
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
const payload = serializePostDraft({
  text: "Post",
  photos: [],
  videos: [],
  tags: [],
  target: "club",
  status: "published",
  scheduledAt: null,
  publishedAt: new Date("2026-10-04T09:00:00Z"),
  sortOrder: 0,
});
const attachment = () => ({
  type: "audio" as const,
  file: new File(["audio"], "test.mp3", { type: "audio/mpeg" }),
  name: "test.mp3",
  mimeType: "audio/mpeg",
});
const scope = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
const api = {
  create: vi.fn(async (_input: object, _signal: AbortSignal) => 42),
  update: vi.fn(async (_id: number, _input: object, _signal: AbortSignal) => ({
    success: true,
  })),
  upload: vi.fn(async (_input: object, _signal: AbortSignal) => ({
    url: "https://example.test/audio.mp3",
    mimeType: "audio/mpeg",
    fileSize: 5,
  })),
  remove: vi.fn(async (_id: number, _signal: AbortSignal) => undefined),
};
beforeEach(() => {
  vi.resetAllMocks();
  api.create.mockResolvedValue(42);
  api.update.mockResolvedValue({ success: true });
  api.upload.mockResolvedValue({
    url: "https://example.test/audio.mp3",
    mimeType: "audio/mpeg",
    fileSize: 5,
  });
});
it("uploads before creating one complete published post", async () => {
  const order: string[] = [];
  api.upload.mockImplementationOnce(async () => {
    order.push("upload");
    return {
      url: "https://example.test/audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 5,
    };
  });
  api.create.mockImplementationOnce(async () => {
    order.push("create");
    return 42;
  });
  await new PostSaveCoordinator().save(
    payload,
    [attachment()],
    [],
    api,
    scope(),
  );
  expect(order).toEqual(["upload", "create"]);
  expect(api.create.mock.calls[0][0]).toMatchObject({
    status: "published",
    attachments: [
      {
        type: "audio",
        url: "https://example.test/audio.mp3",
        filename: "test.mp3",
        mimeType: "audio/mpeg",
        fileSize: 5,
      },
    ],
  });
  expect(api.upload.mock.calls[0][0]).not.toHaveProperty("postId");
  expect(api.update).not.toHaveBeenCalled();
});
it.each([null, 42])(
  "rejected uploads leave post %s untouched; retry reuses confirmed files",
  async (id) => {
    const coordinator = new PostSaveCoordinator(id);
    const files = [attachment(), attachment()];
    api.upload
      .mockResolvedValueOnce({
        url: "https://example.test/first.mp3",
        mimeType: "audio/mpeg",
        fileSize: 5,
      })
      .mockRejectedValueOnce(new ApiError("Файл отклонён", 413));
    await expect(
      coordinator.save(payload, files, [9], api, scope()),
    ).rejects.toMatchObject({ uncertain: false });
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
    await coordinator.save(payload, files, [9], api, scope());
    expect(api.upload).toHaveBeenCalledTimes(3);
    const saved =
      id === null ? api.create.mock.calls[0][0] : api.update.mock.calls[0][1];
    expect(saved).toMatchObject({
      status: "published",
      attachments: [
        {
          url: "https://example.test/first.mp3",
          mimeType: "audio/mpeg",
          fileSize: 5,
        },
        {
          url: "https://example.test/audio.mp3",
          mimeType: "audio/mpeg",
          fileSize: 5,
        },
      ],
    });
  },
);
it("removes attachments in one final edit without unpublishing", async () => {
  await new PostSaveCoordinator(42).save(payload, [], [9], api, scope());
  expect(api.update).toHaveBeenCalledTimes(1);
  expect(api.update.mock.calls[0][1]).toMatchObject({
    status: "published",
    published: true,
    removedMediaIds: [9],
  });
  expect(api.remove).not.toHaveBeenCalled();
});
it("cancelling after upload cannot commit a post", async () => {
  const local = new OperationScope();
  const task = local.begin("save", new AbortController().signal, () => true)!;
  api.upload.mockImplementationOnce(async () => {
    local.cancel();
    return {
      url: "https://example.test/audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 5,
    };
  });
  await expect(
    new PostSaveCoordinator(42).save(payload, [attachment()], [9], api, task),
  ).rejects.toThrow("отменена");
  expect(api.update).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
});
it("a rejected edit reuses uploads and omits an unsaved file removed before retry", async () => {
  const coordinator = new PostSaveCoordinator(42);
  const files = [attachment(), attachment()];
  api.update.mockRejectedValueOnce(new ApiError("Сохранение отклонено", 400));
  await expect(
    coordinator.save(payload, files, [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  await coordinator.save(payload, [files[1]], [], api, scope());
  expect(api.upload).toHaveBeenCalledTimes(2);
  expect(api.update.mock.calls[1][1]).toMatchObject({
    attachments: [expect.objectContaining({ filename: "test.mp3" })],
  });
});
it("a confirmed save is never repeated through the same editor", async () => {
  const coordinator = new PostSaveCoordinator(42);
  const file = attachment();
  await coordinator.save(payload, [file], [], api, scope());
  await expect(
    coordinator.save(payload, [file], [], api, scope()),
  ).rejects.toThrow("уже сохранена");
  expect(api.update).toHaveBeenCalledTimes(1);
});
it("cancellation after a confirmed commit cannot replay attachment insertion", async () => {
  const coordinator = new PostSaveCoordinator(42);
  const local = new OperationScope();
  const task = local.begin("save", new AbortController().signal, () => true)!;
  api.update.mockImplementationOnce(async () => {
    local.cancel();
    return { success: true };
  });
  await expect(
    coordinator.save(payload, [attachment()], [], api, task),
  ).rejects.toMatchObject({ uncertain: false });
  await expect(coordinator.save(payload, [], [], api, scope())).rejects.toThrow(
    "уже сохранена",
  );
  expect(api.update).toHaveBeenCalledTimes(1);
});
