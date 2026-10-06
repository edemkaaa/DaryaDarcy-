import { beforeEach, expect, it, vi, type Mock } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: vi.fn(async () => "FILE_BASE64"),
}));
import {
  PostSaveCoordinator,
  type PostSaveApi,
} from "../apps/frontend/src/domain/post/save-post";
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
let api: { [K in keyof PostSaveApi]: Mock<PostSaveApi[K]> };
beforeEach(() => {
  api = {
    create: vi.fn(async () => 42),
    update: vi.fn(async () => ({ success: true })),
    upload: vi.fn(async () => ({
      url: "https://example.test/audio.mp3",
      mediaId: 9,
      mimeType: "audio/mpeg",
      fileSize: 5,
    })),
  };
});
it("keeps a post unpublished until all attachments are confirmed", async () => {
  const order: string[] = [];
  api.create.mockImplementation(async (input) => {
    order.push(`create:${input.status}`);
    return 42;
  });
  api.upload.mockImplementation(async () => {
    order.push("upload");
    return {
      url: "https://example.test/audio.mp3",
      mediaId: 9,
      mimeType: "audio/mpeg",
      fileSize: 5,
    };
  });
  api.update.mockImplementation(async (_id, input) => {
    order.push(`update:${input.status}`);
    return { success: true };
  });
  await new PostSaveCoordinator().save(
    payload,
    [attachment()],
    [],
    api,
    scope(),
  );
  expect(order).toEqual(["upload", "create:published"]);
});
it("saves the requested schedule only after preparing attachments", async () => {
  await new PostSaveCoordinator().save(
    {
      ...payload,
      status: "scheduled",
      published: false,
      scheduledAt: "2026-10-05T09:00:00Z",
    },
    [attachment()],
    [],
    api,
    scope(),
  );
  expect(api.create.mock.calls[0][0]).toMatchObject({
    status: "scheduled",
    published: false,
    scheduledAt: "2026-10-05T09:00:00Z",
  });
  expect(api.update).not.toHaveBeenCalled();
});
it("an explicit upload rejection cannot create a partial post; retry reuses confirmed files", async () => {
  const coordinator = new PostSaveCoordinator();
  const files = [attachment(), attachment()];
  api.upload
    .mockResolvedValueOnce({
      url: "https://example.test/first.mp3",
      mediaId: 7,
      mimeType: "audio/mpeg",
      fileSize: 5,
    })
    .mockRejectedValueOnce(new ApiError("Файл отклонён", 413));
  await expect(
    coordinator.save(payload, files, [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
  await coordinator.save(payload, files, [], api, scope());
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.upload).toHaveBeenCalledTimes(3);
  expect(api.create.mock.calls[0][0]).toMatchObject({
    status: "published",
  });
});
it("does not repeat a create after the server response was lost", async () => {
  const coordinator = new PostSaveCoordinator();
  api.create.mockRejectedValueOnce(
    new ApiError("Нет ответа", 0, undefined, false, "timeout"),
  );
  await expect(
    coordinator.save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: true });
  await expect(coordinator.save(payload, [], [], api, scope())).rejects.toThrow(
    "не подтверждён",
  );
  expect(api.create).toHaveBeenCalledTimes(1);
});
it("does not repeat an unconfirmed attachment upload", async () => {
  const coordinator = new PostSaveCoordinator();
  const file = attachment();
  api.upload.mockRejectedValueOnce(new ApiError("Нет ответа", 500));
  await expect(
    coordinator.save(payload, [file], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: true });
  await expect(
    coordinator.save(payload, [file], [], api, scope()),
  ).rejects.toThrow("не подтверждён");
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.update).not.toHaveBeenCalled();
});
it("a malformed update success is not treated as a published post", async () => {
  api.update.mockResolvedValue({ success: false });
  await expect(
    new PostSaveCoordinator(42).save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: true });
});
it("cancelling before saving cannot start an attachment upload", async () => {
  const local = new OperationScope();
  const task = local.begin("save", new AbortController().signal, () => true)!;
  local.cancel();
  await expect(
    new PostSaveCoordinator().save(payload, [attachment()], [], api, task),
  ).rejects.toThrow("отменена");
  expect(api.upload).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
});
it("existing media removal is explicit and completes before publication", async () => {
  const order: string[] = [];
  api.update.mockImplementation(async (_id, input) => {
    order.push(input.status ?? "missing");
    return { success: true };
  });
  await new PostSaveCoordinator(42).save(payload, [], [9], api, scope());
  expect(order).toEqual(["published"]);
  expect(api.update.mock.calls[0][1]).toMatchObject({ removedMediaIds: [9] });
});

it.each([null, 42])(
  "post %s uses canonical server metadata for audio and documents",
  async (id) => {
    const audio = attachment();
    const document = {
      type: "document" as const,
      file: new File(["local"], "notes.txt", {
        type: "application/octet-stream",
      }),
      name: "notes.txt",
      mimeType: "application/octet-stream",
    };
    api.upload
      .mockResolvedValueOnce({
        url: "https://example.test/opaque-audio",
        mimeType: "audio/wav",
        fileSize: 46,
      })
      .mockResolvedValueOnce({
        url: "https://example.test/opaque-document",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 123,
      });
    await new PostSaveCoordinator(id).save(
      payload,
      [audio, document],
      [],
      api,
      scope(),
    );
    const saved =
      id === null ? api.create.mock.calls[0][0] : api.update.mock.calls[0][1];
    expect(saved.attachments).toEqual([
      {
        type: "audio",
        filename: "test.mp3",
        url: "https://example.test/opaque-audio",
        mimeType: "audio/wav",
        fileSize: 46,
      },
      {
        type: "document",
        filename: "notes.txt",
        url: "https://example.test/opaque-document",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 123,
      },
    ]);
  },
);

it.each([null, 42])(
  "post %s retains canonical metadata on an explicit save retry",
  async (id) => {
    const coordinator = new PostSaveCoordinator(id);
    const files = [attachment(), attachment()];
    api.upload
      .mockResolvedValueOnce({
        url: "https://example.test/removed",
        mimeType: "audio/wav",
        fileSize: 46,
      })
      .mockResolvedValueOnce({
        url: "https://example.test/retained",
        mimeType: "audio/wav",
        fileSize: 99,
      });
    const write = id === null ? api.create : api.update;
    write.mockRejectedValueOnce(new ApiError("Сохранение отклонено", 400));
    await expect(
      coordinator.save(payload, files, [], api, scope()),
    ).rejects.toMatchObject({ uncertain: false });
    await coordinator.save(payload, [files[1]], [], api, scope());
    expect(api.upload).toHaveBeenCalledTimes(2);
    const saved =
      id === null ? api.create.mock.calls[1][0] : api.update.mock.calls[1][1];
    expect(saved.attachments).toEqual([
      {
        type: "audio",
        filename: "test.mp3",
        url: "https://example.test/retained",
        mimeType: "audio/wav",
        fileSize: 99,
      },
    ]);
  },
);

const confirmed = {
  url: "https://example.test/opaque",
  mimeType: "audio/wav",
  fileSize: 46,
};
const malformedUploads: unknown[] = [
  null,
  {},
  { url: confirmed.url },
  { ...confirmed, url: "javascript:alert(1)" },
  { ...confirmed, url: "https://user:password@example.test/file" },
  ...[
    undefined,
    null,
    "",
    "  ",
    "a".repeat(129),
    "audio/wav\n",
    "audio/\u007fwav",
    42,
  ].map((mimeType) => ({ ...confirmed, mimeType })),
  ...[
    undefined,
    null,
    "46",
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ].map((fileSize) => ({ ...confirmed, fileSize })),
];
for (const id of [null, 42]) {
  it.each(malformedUploads.map((result, index) => ({ result, index })))(
    `post ${id} rejects malformed upload $index without replaying writes`,
    async ({ result }) => {
      const coordinator = new PostSaveCoordinator(id);
      const file = attachment();
      api.upload.mockResolvedValueOnce(result);
      await expect(
        coordinator.save(payload, [file], [], api, scope()),
      ).rejects.toMatchObject({ uncertain: true });
      await expect(
        coordinator.save(payload, [file], [], api, scope()),
      ).rejects.toMatchObject({ uncertain: true });
      expect(api.upload).toHaveBeenCalledTimes(1);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).not.toHaveBeenCalled();
    },
  );
}
