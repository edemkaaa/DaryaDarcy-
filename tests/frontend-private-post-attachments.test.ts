import { expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: async (file: File) =>
    Buffer.from(await file.arrayBuffer()).toString("base64"),
}));
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import type { PrivateUploadInput } from "../apps/frontend/src/domain/post/private-upload";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

const assetId = "3af23d8c-140f-454b-a123-123456789abc";
const payload = serializePostDraft({
  text: "Private",
  photos: [],
  videos: [],
  tags: [],
  target: "club",
  status: "published",
  scheduledAt: null,
  publishedAt: new Date("2026-10-15T09:00:00Z"),
  sortOrder: 0,
});
const file = () => ({
  type: "document" as const,
  name: "kept.txt",
  mimeType: "text/plain",
  file: new File(["original bytes"], "kept.txt", { type: "text/plain" }),
});
const receipt = {
  state: "ready",
  assetId,
  type: "document",
  filename: "kept.txt",
  mimeType: "text/plain",
  fileSize: 14,
};
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
function boundary() {
  return {
    create: vi.fn(async (_input: object) => 42),
    update: vi.fn(async (_id: number, _input: object) => ({ success: true })),
    upload: vi.fn(async () => {
      throw new Error("Public fallback forbidden");
    }),
    uploadPrivate: vi.fn(
      async (
        _input: PrivateUploadInput,
        _signal: AbortSignal,
      ): Promise<unknown> => receipt,
    ),
    privateStatus: vi.fn(
      async (_input: object, _signal: AbortSignal): Promise<unknown> => receipt,
    ),
  };
}

it.each([null, 42])(
  "binds only private receipts in the final post transaction (%s)",
  async (id) => {
    const api = boundary();
    const coordinator = new PostSaveCoordinator(id, id ? payload : undefined);
    let durableKey: string | undefined;
    coordinator.setCheckpoint(async (state) => {
      durableKey = state.privateUploads?.[0]?.[1].key;
    });
    api.uploadPrivate.mockImplementationOnce(async (input) => {
      expect(input).toEqual({
        idempotencyKey: durableKey,
        type: "document",
        filename: "kept.txt",
        mimeType: "text/plain",
        base64: "b3JpZ2luYWwgYnl0ZXM=",
      });
      expect(durableKey).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
      return receipt;
    });
    await coordinator.save(payload, [file()], [9], api, task());
    const sent = id ? api.update.mock.calls[0][1] : api.create.mock.calls[0][0];
    expect(sent).toMatchObject({ privateAssetIds: [assetId] });
    expect(sent).not.toHaveProperty("attachments");
    if (id)
      expect(sent).toEqual({
        privateAssetIds: [assetId],
        removedMediaIds: [9],
      });
    expect(api.upload).not.toHaveBeenCalled();
  },
);

it("reload after lost upload ACK checks status and binds without uploading twice", async () => {
  const api = boundary();
  api.uploadPrivate.mockRejectedValueOnce(new Error("Lost ACK"));
  const coordinator = new PostSaveCoordinator();
  const attachment = file();
  await expect(
    coordinator.save(payload, [attachment], [], api, task()),
  ).rejects.toThrow();
  const restored = new PostSaveCoordinator();
  restored.restore(coordinator.snapshot());
  await restored.recoverUploads(api, task());
  expect(api.create).not.toHaveBeenCalled();
  await restored.save(payload, [attachment], [], api, task());
  expect(api.uploadPrivate).toHaveBeenCalledTimes(1);
  expect(api.privateStatus.mock.calls[0][0]).toEqual({
    idempotencyKey: api.uploadPrivate.mock.calls[0][0].idempotencyKey,
  });
  expect(api.create.mock.calls[0][0]).toMatchObject({
    privateAssetIds: [assetId],
  });
});

it.each(["pending", "notRecorded"])(
  "explicit recovery of %s replays original bytes and key, not a new intent",
  async (state) => {
    const api = boundary();
    api.uploadPrivate.mockRejectedValueOnce(new Error("Timeout"));
    api.privateStatus.mockResolvedValueOnce(
      state === "pending" ? { ...receipt, state } : { state },
    );
    const coordinator = new PostSaveCoordinator();
    const attachment = file();
    await expect(
      coordinator.save(payload, [attachment], [], api, task()),
    ).rejects.toThrow();
    await coordinator.recoverUploads(api, task());
    expect(api.uploadPrivate.mock.calls[1][0]).toEqual(
      api.uploadPrivate.mock.calls[0][0],
    );
    expect(api.create).not.toHaveBeenCalled();
    await coordinator.save(payload, [attachment], [], api, task());
    expect(api.uploadPrivate).toHaveBeenCalledTimes(2);
  },
);

it.each([409, 401, 403, 503])(
  "status failure %s preserves intent and sends no upload/post",
  async (status) => {
    const api = boundary();
    api.uploadPrivate.mockRejectedValueOnce(new Error("Timeout"));
    api.privateStatus.mockRejectedValueOnce(new ApiError("Rejected", status));
    const coordinator = new PostSaveCoordinator();
    await expect(
      coordinator.save(payload, [file()], [], api, task()),
    ).rejects.toThrow();
    const before = coordinator.snapshot().privateUploads;
    await expect(coordinator.recoverUploads(api, task())).rejects.toThrow();
    expect(coordinator.snapshot().privateUploads).toEqual(before);
    expect(coordinator.snapshot().phase).toBe("upload");
    expect(api.uploadPrivate).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("account cancellation ignores a late ready receipt and never binds it", async () => {
  const api = boundary();
  const scope = new OperationScope();
  const operation = scope.begin(
    "save",
    new AbortController().signal,
    () => true,
  )!;
  api.uploadPrivate.mockImplementationOnce(async () => {
    scope.cancel();
    return receipt;
  });
  const coordinator = new PostSaveCoordinator();
  await expect(
    coordinator.save(payload, [file()], [], api, operation),
  ).rejects.toThrow();
  expect(coordinator.snapshot().privateUploads?.[0][1].receipt).toBeUndefined();
  expect(api.uploadPrivate).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
});

it.each([
  { ...receipt, assetId: "not-a-uuid" },
  { ...receipt, state: "pending" },
  { ...receipt, fileSize: 15 },
  { ...receipt, type: "audio" },
  { ...receipt, filename: "another.txt" },
  { ...receipt, mimeType: "garbage/" },
  { ...receipt, url: "https://example.test/public.txt" },
])(
  "an invalid or pending receipt never permits publishing: %j",
  async (value) => {
    const api = boundary();
    api.uploadPrivate.mockResolvedValue(value);
    const coordinator = new PostSaveCoordinator();
    await expect(
      coordinator.save(payload, [file()], [], api, task()),
    ).rejects.toThrow();
    expect(api.create).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
  },
);

it("a cancelled status read cannot apply its receipt to the restored journal", async () => {
  const api = boundary();
  api.uploadPrivate.mockRejectedValueOnce(new Error("Timeout"));
  const coordinator = new PostSaveCoordinator();
  await expect(
    coordinator.save(payload, [file()], [], api, task()),
  ).rejects.toThrow();
  const scope = new OperationScope();
  const operation = scope.begin(
    "save",
    new AbortController().signal,
    () => true,
  )!;
  api.privateStatus.mockImplementationOnce(async () => {
    scope.cancel();
    return receipt;
  });
  await expect(coordinator.recoverUploads(api, operation)).rejects.toThrow();
  expect(coordinator.snapshot().privateUploads?.[0][1].receipt).toBeUndefined();
  expect(coordinator.snapshot().phase).toBe("upload");
  expect(api.create).not.toHaveBeenCalled();
});

it("journaling failure before private upload sends no bytes", async () => {
  const api = boundary();
  const coordinator = new PostSaveCoordinator();
  coordinator.setCheckpoint(async () => {
    throw new Error("Storage full");
  });
  await expect(
    coordinator.save(payload, [file()], [], api, task()),
  ).rejects.toThrow();
  expect(api.uploadPrivate).not.toHaveBeenCalled();
  expect(api.upload).not.toHaveBeenCalled();
});

it("a failed final recovery checkpoint can be retried without poisoning a ready receipt", async () => {
  const api = boundary();
  api.uploadPrivate.mockRejectedValueOnce(new Error("Timeout"));
  const coordinator = new PostSaveCoordinator();
  const attachment = file();
  await expect(
    coordinator.save(payload, [attachment], [], api, task()),
  ).rejects.toThrow();
  coordinator.setCheckpoint(async (snapshot) => {
    if (snapshot.phase === "idle") throw new Error("Storage full");
  });
  await expect(coordinator.recoverUploads(api, task())).rejects.toThrow(
    "Storage full",
  );
  coordinator.setCheckpoint(async () => {});
  await coordinator.save(payload, [attachment], [], api, task());
  expect(api.uploadPrivate).toHaveBeenCalledTimes(1);
  expect(api.create.mock.calls[0][0]).toMatchObject({
    privateAssetIds: [assetId],
  });
});
