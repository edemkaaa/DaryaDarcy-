/** 429 приватного video сохраняется в журнале с дедлайном; повтор начинается со статуса исходного ключа. */
import { afterEach, expect, it, vi } from "vitest";
import {
  uploadPrivatePostVideo,
  type PrivatePostVideo,
} from "../apps/frontend/src/domain/post/private-video-upload";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";
/** Возвращаем реальные таймеры. */
afterEach(() => vi.useRealTimers());
/** Каждый сценарий получает собственный File и стабильный ключ намерения. */
const video = (): PrivatePostVideo => ({
  key: "video-original-key",
  file: new File(["bytes"], "video.mp4", { type: "video/mp4" }),
});
const ready = {
  state: "ready",
  assetId: "3af23d8c-140f-454b-a123-123456789abc",
  type: "video",
  filename: "video.mp4",
  fileSize: 5,
  mimeType: "video/mp4",
};
/** Создаём актуальное cancellable operation-владение для проверяемой отправки. */
const task = () =>
  new OperationScope().begin("save", new AbortController().signal, () => true)!;

/** До cooldown ни status, ни upload не выполняются; после него явный повтор использует тот же File/key и сохраняет ready receipt. */
it("persists the deadline, refuses an early retry, then checks status before sending the same file/key", async () => {
  vi.useFakeTimers();
  const selected = video();
  const api = {
    uploadPrivateVideo: vi
      .fn()
      .mockRejectedValueOnce(new ApiError("busy", 429, 2))
      .mockResolvedValue(ready),
    privateStatus: vi.fn().mockResolvedValue({ state: "notRecorded" }),
  };
  const checkpoint = vi.fn(async () => {});
  await expect(
    uploadPrivatePostVideo(selected, api, task(), checkpoint),
  ).rejects.toMatchObject({ status: 429 });
  expect(selected.retryNotBefore).toBe(Date.now() + 2000);
  expect(checkpoint).toHaveBeenCalledTimes(2);
  const restored = { ...selected };
  await vi.advanceTimersByTimeAsync(1999);
  await expect(
    uploadPrivatePostVideo(restored, api, task(), checkpoint),
  ).rejects.toMatchObject({ status: 429 });
  expect(api.privateStatus).not.toHaveBeenCalled();
  expect(api.uploadPrivateVideo).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(api.uploadPrivateVideo).toHaveBeenCalledTimes(1);
  await uploadPrivatePostVideo(restored, api, task(), checkpoint);
  expect(api.privateStatus).toHaveBeenCalledWith(
    { idempotencyKey: selected.key },
    expect.any(AbortSignal),
  );
  expect(api.uploadPrivateVideo).toHaveBeenLastCalledWith(
    selected.file,
    selected.key,
    expect.any(AbortSignal),
  );
  expect(restored.receipt).toEqual(ready);
  expect(restored.retryNotBefore).toBeUndefined();
});

/** Отменённый scope не записывает поздний cooldown в черновик прежнего аккаунта. */
it("does not apply a late 429 to a previous account's draft", async () => {
  const selected = video();
  const scope = new OperationScope();
  const operation = scope.begin(
    "save",
    new AbortController().signal,
    () => true,
  )!;
  const checkpoint = vi.fn(async () => {});
  const api = {
    uploadPrivateVideo: vi.fn(async () => {
      scope.cancel();
      throw new ApiError("busy", 429, 2);
    }),
    privateStatus: vi.fn(),
  };
  await expect(
    uploadPrivatePostVideo(selected, api, operation, checkpoint),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(selected.retryNotBefore).toBeUndefined();
  expect(checkpoint).toHaveBeenCalledTimes(1);
});
