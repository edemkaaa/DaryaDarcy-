import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
const scope = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;
const api = {
  create: vi.fn<PostSaveApi["create"]>(async () => 42),
  update: vi.fn<PostSaveApi["update"]>(async () => ({ success: true })),
  upload: vi.fn<PostSaveApi["upload"]>(async () => ({
    url: "https://example.test/audio",
    mimeType: "audio/wav",
    fileSize: 46,
  })),
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyAt = (index: number) => api.create.mock.calls[index][0].idempotencyKey;
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

it("independent creations send distinct secure UUIDs even for identical content", async () => {
  await new PostSaveCoordinator().save(payload, [], [], api, scope());
  await new PostSaveCoordinator().save(payload, [], [], api, scope());
  expect(keyAt(0)).toMatch(uuid);
  expect(keyAt(1)).toMatch(uuid);
  expect(keyAt(1)).not.toBe(keyAt(0));
});

it("retains the key and complete payload after a definite rejection of unchanged content", async () => {
  const coordinator = new PostSaveCoordinator();
  api.create.mockRejectedValueOnce(new ApiError("Отклонено", 400));
  await expect(
    coordinator.save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  await coordinator.save(structuredClone(payload), [], [], api, scope());
  expect(keyAt(0)).toMatch(uuid);
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);
});

it("uses a new intent if the user changes content after a definite rejection", async () => {
  const coordinator = new PostSaveCoordinator();
  api.create.mockRejectedValueOnce(new ApiError("Отклонено", 400));
  await expect(
    coordinator.save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  await coordinator.save(
    { ...payload, text: "Corrected" },
    [],
    [],
    api,
    scope(),
  );
  expect(keyAt(0)).toMatch(uuid);
  expect(keyAt(1)).toMatch(uuid);
  expect(keyAt(1)).not.toBe(keyAt(0));
});

it("removing a confirmed attachment changes the intent without uploading retained files again", async () => {
  const coordinator = new PostSaveCoordinator();
  const files = ["one.wav", "two.wav"].map((name) => ({
    name,
    type: "audio" as const,
    mimeType: "audio/wav",
    file: new File(["audio"], name, { type: "audio/wav" }),
  }));
  api.create.mockRejectedValueOnce(new ApiError("Отклонено", 400));
  await expect(
    coordinator.save(payload, files, [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  await coordinator.save(payload, [files[1]], [], api, scope());
  expect(api.upload).toHaveBeenCalledTimes(2);
  expect(keyAt(0)).toMatch(uuid);
  expect(keyAt(1)).toMatch(uuid);
  expect(keyAt(1)).not.toBe(keyAt(0));
  expect(api.create.mock.calls[1][0].attachments).toHaveLength(1);
});

it("an existing post is updated without an idempotency key or browser crypto", async () => {
  vi.stubGlobal("crypto", undefined);
  await new PostSaveCoordinator(42).save(payload, [], [], api, scope());
  expect(api.update.mock.calls[0][1]).not.toHaveProperty("idempotencyKey");
  expect(api.create).not.toHaveBeenCalled();
});

it("missing secure UUID support fails before dispatch and leaves closing or retry possible", async () => {
  const crypto = globalThis.crypto;
  vi.stubGlobal("crypto", undefined);
  const coordinator = new PostSaveCoordinator();
  await expect(
    coordinator.save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: false });
  expect(api.create).not.toHaveBeenCalled();
  expect(() => coordinator.assertCanClose()).not.toThrow();
  vi.stubGlobal("crypto", crypto);
  await coordinator.save(payload, [], [], api, scope());
  expect(keyAt(0)).toMatch(uuid);
});

it("a pending final create cannot dispatch a second intent through the same editor", async () => {
  const coordinator = new PostSaveCoordinator();
  let release!: (id: number) => void;
  api.create.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        release = resolve;
      }),
  );
  const saving = coordinator.save(payload, [], [], api, scope());
  try {
    await expect(
      coordinator.save(
        { ...payload, text: "Changed while pending" },
        [],
        [],
        api,
        scope(),
      ),
    ).rejects.toThrow("Сохранение");
    expect(api.create).toHaveBeenCalledTimes(1);
  } finally {
    release(42);
    await saving;
  }
});

it("an unknown create sends a key but still forbids blind replay with changed content", async () => {
  const coordinator = new PostSaveCoordinator();
  api.create.mockRejectedValueOnce(new ApiError("Нет ответа", 500));
  await expect(
    coordinator.save(payload, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: true });
  expect(keyAt(0)).toMatch(uuid);
  await expect(
    coordinator.save({ ...payload, text: "Changed" }, [], [], api, scope()),
  ).rejects.toMatchObject({ uncertain: true });
  expect(api.create).toHaveBeenCalledTimes(1);
});

it.each(["confirmed", "unknown"])(
  "a concurrent upload cannot write again after a %s final create",
  async (outcome) => {
    const coordinator = new PostSaveCoordinator();
    const file = {
      name: "late.wav",
      type: "audio" as const,
      mimeType: "audio/wav",
      file: new File(["audio"], "late.wav", { type: "audio/wav" }),
    };
    let release!: (value: unknown) => void;
    let started!: () => void;
    const uploading = new Promise<void>((resolve) => {
      started = resolve;
    });
    api.upload.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const lateSave = coordinator.save(payload, [file], [], api, scope());
    await uploading;
    if (outcome === "unknown") {
      api.create.mockRejectedValueOnce(new ApiError("Нет ответа", 500));
      await expect(
        coordinator.save(payload, [], [], api, scope()),
      ).rejects.toMatchObject({ uncertain: true });
    } else {
      await coordinator.save(payload, [], [], api, scope());
    }
    release({
      url: "https://example.test/late",
      mimeType: "audio/wav",
      fileSize: 46,
    });
    await expect(lateSave).rejects.toMatchObject({
      uncertain: outcome === "unknown",
    });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
  },
);
