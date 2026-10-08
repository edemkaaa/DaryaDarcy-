import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: vi.fn(async () => "FILE_BASE64"),
}));
import {
  PostSaveCoordinator,
  type PostSaveApi,
  type PostSaveSnapshot,
} from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

const payload = serializePostDraft({
  text: "Post",
  photos: ["https://example.test/photo"],
  videos: ["https://example.test/video"],
  tags: ["video"],
  target: "club",
  status: "scheduled",
  scheduledAt: new Date("2026-12-01T09:00:00Z"),
  publishedAt: new Date("2026-10-04T09:00:00Z"),
  sortOrder: 7,
  richText: [{ type: "paragraph", children: [{ text: "Post", italic: true }] }],
});
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
const api = {
  create: vi.fn<PostSaveApi["create"]>(async () => 42),
  update: vi.fn<PostSaveApi["update"]>(async () => ({ success: true })),
  upload: vi.fn<PostSaveApi["upload"]>(async () => ({
    url: "https://example.test/file",
    mimeType: "audio/wav",
    fileSize: 46,
  })),
};
beforeEach(() => {
  vi.resetAllMocks();
  api.create.mockResolvedValue(42);
  api.update.mockResolvedValue({ success: true });
  api.upload.mockResolvedValue({
    url: "https://example.test/file",
    mimeType: "audio/wav",
    fileSize: 46,
  });
});

it("waits for durable creation before dispatch, synchronously excluding another final write", async () => {
  const coordinator = new PostSaveCoordinator();
  let release!: () => void;
  coordinator.setCheckpoint(
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined),
  );
  const saving = coordinator.save(payload, [], [], api, task());
  expect(api.create).not.toHaveBeenCalled();
  expect(() => coordinator.assertCanClose()).toThrow();
  await expect(
    coordinator.save(payload, [], [], api, task()),
  ).rejects.toThrow();
  release();
  await saving;
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(coordinator.snapshot().phase).toBe("complete");
});

it("storage failure before dispatch sends no request and permits a later safe retry", async () => {
  const coordinator = new PostSaveCoordinator();
  const checkpoint = vi.fn().mockRejectedValue(new Error("Storage full"));
  coordinator.setCheckpoint(checkpoint);
  await expect(
    coordinator.save(payload, [], [], api, task()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(api.create).not.toHaveBeenCalled();
  expect(() => coordinator.assertCanClose()).not.toThrow();
  checkpoint.mockResolvedValue(undefined);
  await coordinator.save(payload, [], [], api, task());
  expect(api.create).toHaveBeenCalledTimes(1);
});

it.each([null, 42])(
  "journals attachment upload before dispatch and cannot blindly replay it after reload (%s)",
  async (id) => {
    const coordinator = new PostSaveCoordinator(id);
    let durable!: PostSaveSnapshot;
    coordinator.setCheckpoint(async (state) => {
      durable = structuredClone(state);
    });
    api.upload.mockImplementationOnce(async () => {
      expect(durable.phase).toBe("upload");
      throw new ApiError("Lost response", 500);
    });
    const file = {
      type: "audio" as const,
      name: "song.wav",
      mimeType: "audio/wav",
      file: new File(["audio"], "song.wav"),
    };
    await expect(
      coordinator.save(payload, [file], [], api, task()),
    ).rejects.toMatchObject({ uncertain: true });
    const restored = new PostSaveCoordinator(id);
    restored.restore(durable);
    await expect(
      restored.save(payload, [file], [], api, task()),
    ).rejects.toMatchObject({ uncertain: true });
    await expect(restored.recoverCreation(api, task())).rejects.toThrow(
      "ручная проверка",
    );
    expect(api.upload).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  },
);

it("explicit recovery replays the exact persisted creation with metadata and no second upload", async () => {
  const coordinator = new PostSaveCoordinator();
  const file = {
    type: "audio" as const,
    name: "song.mp3",
    mimeType: "audio/mpeg",
    file: new File(["audio"], "song.mp3"),
  };
  let durable!: PostSaveSnapshot;
  coordinator.setCheckpoint(async (state) => {
    durable = structuredClone(state);
  });
  api.create.mockRejectedValueOnce(new ApiError("Lost response", 500));
  await expect(
    coordinator.save(payload, [file], [], api, task()),
  ).rejects.toMatchObject({ uncertain: true });
  const restored = new PostSaveCoordinator();
  restored.restore(durable);
  await expect(
    restored.save({ ...payload, text: "Changed" }, [], [], api, task()),
  ).rejects.toThrow();
  expect(api.create).toHaveBeenCalledTimes(1);
  await expect(restored.recoverCreation(api, task())).resolves.toBe(42);
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
  expect(api.create.mock.calls[1][0].attachments?.[0]).toMatchObject({
    mimeType: "audio/wav",
    fileSize: 46,
  });
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.update).not.toHaveBeenCalled();
});

it("definite rejection preserves the intent and cloned uploaded File associations after reload", async () => {
  const coordinator = new PostSaveCoordinator();
  const files = [
    {
      type: "audio" as const,
      name: "song.wav",
      mimeType: "audio/wav",
      file: new File(["audio"], "song.wav"),
    },
  ];
  coordinator.setCheckpoint(async () => {});
  api.create.mockRejectedValueOnce(new ApiError("Rejected", 400));
  await expect(
    coordinator.save(payload, files, [], api, task()),
  ).rejects.toMatchObject({ uncertain: false });
  const copy = structuredClone({ state: coordinator.snapshot(), files });
  const restored = new PostSaveCoordinator();
  restored.restore(copy.state);
  await restored.save(payload, copy.files, [], api, task());
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
});

it("an interrupted update stays blocked after reload and is never treated as a recoverable create", async () => {
  const coordinator = new PostSaveCoordinator(42, payload);
  let durable!: PostSaveSnapshot;
  coordinator.setCheckpoint(async (state) => {
    durable = structuredClone(state);
  });
  api.update.mockRejectedValueOnce(new ApiError("Lost response", 500));
  await expect(
    coordinator.save({ ...payload, text: "Edited" }, [], [], api, task()),
  ).rejects.toMatchObject({ uncertain: true });
  const restored = new PostSaveCoordinator(42);
  restored.restore(durable);
  await expect(restored.recoverCreation(api, task())).rejects.toThrow(
    "ручная проверка",
  );
  await expect(restored.save(payload, [], [], api, task())).rejects.toThrow();
  expect(api.update).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
});

it("a confirmed commit remains terminal even if persisting confirmation fails", async () => {
  const coordinator = new PostSaveCoordinator();
  coordinator.setCheckpoint(async (state) => {
    if (state.phase === "complete") throw new Error("Storage full");
  });
  await expect(coordinator.save(payload, [], [], api, task())).rejects.toThrow(
    "сохранена",
  );
  const restored = new PostSaveCoordinator();
  restored.restore(structuredClone(coordinator.snapshot()));
  await expect(restored.save(payload, [], [], api, task())).rejects.toThrow(
    "уже сохранена",
  );
  await expect(restored.recoverCreation(api, task())).rejects.toThrow();
  expect(api.create).toHaveBeenCalledTimes(1);
});

it("session cancellation during persistence prevents dispatch", async () => {
  const coordinator = new PostSaveCoordinator();
  const scope = new OperationScope();
  const operation = scope.begin(
    "save",
    new AbortController().signal,
    () => true,
  )!;
  coordinator.setCheckpoint(async () => {
    scope.cancel();
  });
  await expect(
    coordinator.save(payload, [], [], api, operation),
  ).rejects.toThrow("отменена");
  expect(api.create).not.toHaveBeenCalled();
});

it("failed explicit recovery retains the same key and payload for another explicit check", async () => {
  const coordinator = new PostSaveCoordinator();
  coordinator.setCheckpoint(async () => {});
  api.create.mockRejectedValueOnce(new ApiError("Lost", 500));
  await expect(
    coordinator.save(payload, [], [], api, task()),
  ).rejects.toThrow();
  const restored = new PostSaveCoordinator();
  restored.restore(structuredClone(coordinator.snapshot()));
  api.create.mockRejectedValueOnce(new ApiError("Conflict", 409));
  await expect(restored.recoverCreation(api, task())).rejects.toThrow();
  expect(restored.snapshot().phase).toBe("create");
  await restored.recoverCreation(api, task());
  expect(api.create.mock.calls[2][0]).toEqual(api.create.mock.calls[0][0]);
});
