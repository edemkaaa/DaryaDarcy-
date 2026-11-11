/** Read-only availability probe должен отказывать до upload/create, сохраняя новый черновик повторяемым. */
import { expect, it, vi } from "vitest";
import {
  OperationScope,
  type ScopedOperation,
} from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
import { checkPrivateUploadAvailability } from "../apps/frontend/src/shared/media/private-upload-availability";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";

/** Каждый save получает независимого владельца отменяемой операции. */
const scope = () => new OperationScope();
/** Сериализуем минимальный клубный draft без реального редактора/БД. */
const payload = (photos: string[] = []) =>
  serializePostDraft({
    text: "Kept draft",
    photos,
    videos: [],
    tags: [],
    target: "club",
    status: "draft",
    scheduledAt: null,
    publishedAt: new Date("2026-10-20T10:00:00Z"),
    sortOrder: 0,
  });
/** Ключ availability уникален для каждой проверки и не является будущим upload intent. */
it("uses a fresh read-only key and forwards cancellation", async () => {
  const task = scope().begin("save", new AbortController().signal, () => true)!;
  const status = vi.fn(async () => ({ state: "notRecorded" }));
  await checkPrivateUploadAvailability(status, task);
  await checkPrivateUploadAvailability(status, task);
  expect(status.mock.calls[0]).toMatchObject([
    { idempotencyKey: expect.stringMatching(/^availability:/) },
    task.signal,
  ]);
  expect(status.mock.calls[0]).not.toEqual(status.mock.calls[1]);
});
/** Probe разрешает только точное notRecorded, не невалидный/лишний ready-подобный ответ. */
it.each([
  null,
  {},
  { state: "ready" },
  { state: "notRecorded", assetId: "unexpected" },
])("rejects an invalid probe result %j", async (value) => {
  const task = scope().begin("save", new AbortController().signal, () => true)!;
  await expect(
    checkPrivateUploadAvailability(async () => value, task),
  ).rejects.toMatchObject({ kind: "invalid-response" });
});
/** Положительный результат уже отменённого владельца не продолжает save. */
it("ignores a late successful probe after account cancellation", async () => {
  const owner = scope();
  const task = owner.begin("save", new AbortController().signal, () => true)!;
  await expect(
    checkPrivateUploadAvailability(async () => {
      owner.cancel();
      return { state: "notRecorded" };
    }, task),
  ).rejects.toThrow();
});
/** 404/503 возвращают coordinator в idle; два явных повтора не вызывают upload/create и сохраняют понятный отказ. */
it.each([404, 503])(
  "keeps a new post retryable without writes after probe HTTP %s",
  async (status) => {
    /** Для повторной попытки создаём актуальный scope, а не переиспользуем завершённый. */
    const task = () =>
      scope().begin("save", new AbortController().signal, () => true)!;
    const coordinator = new PostSaveCoordinator();
    const selected = {
      type: "document" as const,
      name: "kept.txt",
      mimeType: "text/plain",
      file: new File(["kept"], "kept.txt", { type: "text/plain" }),
    };
    const api = {
      checkUploadsAvailable: vi.fn(
        async (
          _kinds: readonly ("content" | "attachment")[],
          operation: ScopedOperation,
        ) =>
          checkPrivateUploadAvailability(async () => {
            throw new ApiError("SERVER_INTERNAL", status);
          }, operation),
      ),
      create: vi.fn(async () => 42),
      update: vi.fn(),
      upload: vi.fn(),
      uploadPrivate: vi.fn(),
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const error = await coordinator
        .save(payload(), [selected], [], api, task())
        .catch((error: unknown) => error);
      expect(error).toMatchObject({
        uncertain: false,
        data: { httpStatus: status },
      });
      if (status === 404)
        expect((error as Error).message).toContain(
          "Загрузка файлов сейчас недоступна",
        );
      expect(coordinator.snapshot()).toMatchObject({
        phase: "idle",
        privateUploads: [],
      });
    }
    expect(api.checkUploadsAvailable).toHaveBeenCalledTimes(2);
    expect(api.upload).not.toHaveBeenCalled();
    expect(api.uploadPrivate).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  },
);
/** Без вложений доступность private uploads не является условием сохранения текста. */
it("does not probe or block text-only publications", async () => {
  const api = {
    checkUploadsAvailable: vi.fn(),
    create: vi.fn(async () => 42),
    update: vi.fn(),
    upload: vi.fn(),
  };
  const task = scope().begin("save", new AbortController().signal, () => true)!;
  await expect(
    new PostSaveCoordinator().save(payload(), [], [], api, task),
  ).resolves.toBe(42);
  expect(api.checkUploadsAvailable).not.toHaveBeenCalled();
});
