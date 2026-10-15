import { expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: async (file: File) =>
    Buffer.from(await file.arrayBuffer()).toString("base64"),
}));
import {
  PostSaveCoordinator,
  type PostPayload,
} from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

const key = "private-photo-intent-0001";
const assetId = "3af23d8c-140f-454b-a123-123456789abc";
const url = `/api/media/content-files/${assetId}`;
const reference = `local-photo:${key}`;
const oldUrl = "https://existing.example.test/photo.webp";
const photo = () => ({
  key,
  file: new File(["original"], "photo.png", { type: "image/png" }),
});
const payload = (photos = [oldUrl, reference]) =>
  serializePostDraft({
    text: "Private photos",
    photos,
    videos: [],
    tags: [],
    target: "club",
    status: "published",
    scheduledAt: null,
    publishedAt: new Date("2026-10-16T09:00:00Z"),
    sortOrder: 0,
  });
const receipt = {
  state: "ready",
  assetId,
  usage: "postPhoto",
  filename: "photo.png",
  mimeType: "image/webp",
  fileSize: 17, // Server re-encodes photos: not the original File.size.
  url,
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
    uploadPrivatePhoto: vi.fn(
      async (_input: object, _signal: AbortSignal): Promise<unknown> => receipt,
    ),
    privatePhotoStatus: vi.fn(
      async (_input: object, _signal: AbortSignal): Promise<unknown> => receipt,
    ),
  };
}
function coordinatorFor(id: number | null = null, original?: PostPayload) {
  const coordinator = new PostSaveCoordinator(id, original);
  coordinator.setCheckpoint(async () => {}); // Unit boundary, NOT IndexedDB acceptance.
  return coordinator;
}

it.each([null, 42])(
  "uploads new photos before binding, preserving old URL order (%s)",
  async (id) => {
    const api = boundary();
    const coordinator = coordinatorFor(id, id ? payload([oldUrl]) : undefined);
    const selected = photo();
    let durable = false;
    coordinator.setCheckpoint(async (state) => {
      if (state.privatePhotos?.[0]?.attempted) {
        expect(state.privatePhotos[0]).toMatchObject({
          key,
          file: selected.file,
        });
        durable = true;
      }
    });
    api.uploadPrivatePhoto.mockImplementationOnce(async (input) => {
      expect(durable).toBe(true);
      expect(input).toEqual({
        idempotencyKey: key,
        usage: "postPhoto",
        filename: "photo.png",
        mimeType: "image/png",
        base64: "b3JpZ2luYWw=",
      });
      expect(api.create).not.toHaveBeenCalled();
      expect(api.update).not.toHaveBeenCalled();
      return receipt;
    });
    await coordinator.save(payload(), [], [], api, task(), [selected]);
    expect(
      id ? api.update.mock.calls[0][1] : api.create.mock.calls[0][0],
    ).toMatchObject({ photos: [oldUrl, url] });
    expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
    expect(api.privatePhotoStatus).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
  },
);

it("lost upload ACK restores the same intent, status first, without uploading twice", async () => {
  const api = boundary();
  api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
  const coordinator = coordinatorFor();
  await expect(
    coordinator.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toMatchObject({ uncertain: true });
  const restored = coordinatorFor();
  restored.restore(structuredClone(coordinator.snapshot()));
  await restored.recoverUploads(api, task());
  expect(api.create).not.toHaveBeenCalled();
  await restored.save(payload(), [], [], api, task());
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
  expect(api.privatePhotoStatus.mock.calls[0][0]).toEqual({
    idempotencyKey: key,
  });
  expect(api.create.mock.calls[0][0]).toMatchObject({ photos: [oldUrl, url] });
});

it.each(["pending", "notRecorded"])(
  "explicit %s recovery replays identical bytes and key",
  async (state) => {
    const api = boundary();
    api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Timeout"));
    api.privatePhotoStatus.mockResolvedValueOnce(
      state === "pending" ? { ...receipt, state, url: undefined } : { state },
    );
    const coordinator = coordinatorFor();
    await expect(
      coordinator.save(payload(), [], [], api, task(), [photo()]),
    ).rejects.toThrow();
    await coordinator.recoverUploads(api, task());
    expect(api.uploadPrivatePhoto.mock.calls[1][0]).toEqual(
      api.uploadPrivatePhoto.mock.calls[0][0],
    );
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("unknown create replays the frozen payload/key without uploading or creating a new intent", async () => {
  const api = boundary();
  api.create.mockRejectedValueOnce(new Error("Lost create ACK"));
  const coordinator = coordinatorFor();
  await expect(
    coordinator.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  const restored = coordinatorFor();
  restored.restore(structuredClone(coordinator.snapshot()));
  await restored.recoverCreation(api, task());
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
  expect(api.create.mock.calls[1][0]).toMatchObject({ photos: [oldUrl, url] });
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
  expect(api.privatePhotoStatus).not.toHaveBeenCalled();
});

it("does not send any write when the durable checkpoint fails", async () => {
  const api = boundary();
  const coordinator = coordinatorFor();
  coordinator.setCheckpoint(async () => {
    throw new Error("Storage full");
  });
  await expect(
    coordinator.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  expect(api.uploadPrivatePhoto).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});

it.each([
  { ...receipt, url: "https://s3.example.test/private/file" },
  { ...receipt, url: `${url}?token=secret` },
  { ...receipt, url: "/api/media/content-files/another-id" },
  { ...receipt, usage: "articlePhoto" },
  { ...receipt, filename: "another.png" },
  { ...receipt, mimeType: "image/svg+xml" },
  { ...receipt, fileSize: 0 },
  { ...receipt, fileSize: 4 * 1024 * 1024 + 1 },
  { ...receipt, objectKey: "content/private-v1/raw" },
])("rejects untrusted private receipt without binding: %j", async (invalid) => {
  const api = boundary();
  api.uploadPrivatePhoto.mockResolvedValueOnce(invalid);
  await expect(
    coordinatorFor().save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();
});

it("never dispatches a local marker without its original File", async () => {
  const api = boundary();
  await expect(
    coordinatorFor().save(payload(), [], [], api, task()),
  ).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();
});

it("no public fallback when closed-photo transport is unavailable", async () => {
  const api = boundary();
  const unavailable = { ...api, uploadPrivatePhoto: undefined };
  await expect(
    coordinatorFor().save(payload(), [], [], unavailable, task(), [photo()]),
  ).rejects.toThrow();
  expect(api.upload).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});

it.each(["upload", "status"])(
  "account switch during %s cannot accept a late receipt or bind",
  async (phase) => {
    const api = boundary();
    const coordinator = coordinatorFor();
    if (phase === "status") {
      api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
      await expect(
        coordinator.save(payload(), [], [], api, task(), [photo()]),
      ).rejects.toThrow();
    }
    let release!: (value: unknown) => void;
    const late = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    if (phase === "upload") api.uploadPrivatePhoto.mockReturnValueOnce(late);
    else api.privatePhotoStatus.mockReturnValueOnce(late);
    let ownsAccess = true;
    const operation = new OperationScope().begin(
      "save",
      new AbortController().signal,
      () => ownsAccess,
    )!;
    const pending =
      phase === "upload"
        ? coordinator.save(payload(), [], [], api, operation, [photo()])
        : coordinator.recoverUploads(api, operation);
    await vi.waitFor(() =>
      expect(
        phase === "upload" ? api.uploadPrivatePhoto : api.privatePhotoStatus,
      ).toHaveBeenCalled(),
    );
    ownsAccess = false;
    release(receipt);
    await expect(pending).rejects.toThrow();
    expect(coordinator.snapshot().privatePhotos?.[0]?.receipt).toBeUndefined();
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("requires an installed durable checkpoint before any private photo write", async () => {
  const api = boundary();
  await expect(
    new PostSaveCoordinator().save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  expect(api.uploadPrivatePhoto).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});

it("recovery cannot replay a photo before durable storage is installed", async () => {
  const api = boundary();
  const original = coordinatorFor();
  api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
  await expect(
    original.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  const restored = new PostSaveCoordinator();
  restored.restore(structuredClone(original.snapshot()));
  api.privatePhotoStatus.mockResolvedValueOnce({ state: "notRecorded" });
  await expect(restored.recoverUploads(api, task())).rejects.toThrow();
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
});

it("malformed notRecorded cannot authorize another upload attempt", async () => {
  const api = boundary();
  const coordinator = coordinatorFor();
  api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
  await expect(
    coordinator.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  api.privatePhotoStatus.mockResolvedValueOnce({
    state: "notRecorded",
    url: "https://unexpected.example.test/file",
  });
  await expect(coordinator.recoverUploads(api, task())).rejects.toThrow();
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
});

it.each([401, 403, 409, 503])(
  "status failure %s preserves the unresolved photo without another write",
  async (status) => {
    const api = boundary();
    const coordinator = coordinatorFor();
    api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
    await expect(
      coordinator.save(payload(), [], [], api, task(), [photo()]),
    ).rejects.toThrow();
    api.privatePhotoStatus.mockRejectedValueOnce(
      new ApiError("Status unavailable", status),
    );
    await expect(coordinator.recoverUploads(api, task())).rejects.toThrow();
    expect(coordinator.snapshot().phase).toBe("upload");
    expect(coordinator.snapshot().privatePhotos?.[0].key).toBe(key);
    expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("a pending upload is not permission to publish", async () => {
  const api = boundary();
  api.uploadPrivatePhoto.mockResolvedValueOnce({
    ...receipt,
    state: "pending",
    url: undefined,
  });
  await expect(
    coordinatorFor().save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toMatchObject({ uncertain: true });
  expect(api.create).not.toHaveBeenCalled();
});

it.each([
  new File([], "empty.png", { type: "image/png" }),
  new File(["not an allowed type"], "photo.svg", { type: "image/svg+xml" }),
  new File(["bytes"], "control\n.png", { type: "image/png" }),
  new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", {
    type: "image/png",
  }),
])(
  "invalid source photo never reaches an upload or post write",
  async (file) => {
    const api = boundary();
    await expect(
      coordinatorFor().save(payload(), [], [], api, task(), [{ key, file }]),
    ).rejects.toThrow();
    expect(api.uploadPrivatePhoto).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  },
);

it("recovers only the second unresolved photo and preserves the user's reordered carousel", async () => {
  const second = {
    key: "private-photo-intent-0002",
    file: new File(["second"], "second.png", { type: "image/png" }),
  };
  const secondAsset = "3af23d8c-140f-454b-a123-123456789abd";
  const secondUrl = `/api/media/content-files/${secondAsset}`;
  const secondReceipt = {
    ...receipt,
    filename: "second.png",
    assetId: secondAsset,
    url: secondUrl,
  };
  const original = payload([reference, oldUrl, `local-photo:${second.key}`]);
  const api = boundary();
  api.uploadPrivatePhoto
    .mockResolvedValueOnce(receipt)
    .mockRejectedValueOnce(new Error("Second ACK lost"));
  const coordinator = coordinatorFor();
  await expect(
    coordinator.save(original, [], [], api, task(), [photo(), second]),
  ).rejects.toThrow();
  const restored = coordinatorFor();
  restored.restore(structuredClone(coordinator.snapshot()));
  api.privatePhotoStatus.mockResolvedValueOnce(secondReceipt);
  await restored.recoverUploads(api, task());
  await restored.save(
    payload([`local-photo:${second.key}`, oldUrl, reference]),
    [],
    [],
    api,
    task(),
  );
  expect(api.privatePhotoStatus).toHaveBeenCalledTimes(1);
  expect(api.privatePhotoStatus.mock.calls[0][0]).toEqual({
    idempotencyKey: second.key,
  });
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(2);
  expect(api.create.mock.calls[0][0]).toMatchObject({
    photos: [secondUrl, oldUrl, url],
  });
});

it("an explicitly removed recovered photo is not resurrected or bound", async () => {
  const api = boundary();
  const coordinator = coordinatorFor();
  api.uploadPrivatePhoto.mockRejectedValueOnce(new Error("Lost ACK"));
  await expect(
    coordinator.save(payload(), [], [], api, task(), [photo()]),
  ).rejects.toThrow();
  await coordinator.recoverUploads(api, task());
  await coordinator.save(payload([oldUrl]), [], [], api, task());
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1);
  expect(api.create.mock.calls[0][0]).toMatchObject({ photos: [oldUrl] });
});
