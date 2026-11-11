import { expect, it, vi } from "vitest";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  /** Кодирует File только для тестового окружения остальных вложений; видео проходит отдельным raw-транспортом. */
  attachmentBase64: async (file: File) => Buffer.from(await file.arrayBuffer()).toString("base64"),
}));
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { requirePrivateReceipt } from "../apps/frontend/src/domain/post/private-upload";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

const key = "private-video-original-key";
const assetId = "3af23d8c-140f-454b-a123-123456789abc";
/** Создаёт локальный видеофайл с постоянным исходным ключом загрузки. */
const selected = () => ({
  key,
  file: new File(["original video"], "lesson.mp4", { type: "video/mp4" }),
});
/** Создаёт payload со смешанными VK и локальным видео, чтобы проверить замену локального маркера asset-привязкой. */
const payload = () =>
  serializePostDraft({
    text: "Video",
    photos: [],
    videos: ["https://vkvideo.ru/video-123_456", `local-video:${key}`],
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
  type: "video",
  filename: "lesson.mp4",
  mimeType: "video/mp4",
  fileSize: 14,
};

/** Сохраняет сообщение занятости видео и retryNotBefore через общий координатор обоих редакторов. */
it("preserves the busy-video message through the save coordinator for both editors", async () => {
  const api = boundary();
  api.uploadPrivateVideo.mockRejectedValueOnce(new ApiError(
    "Сервер обрабатывает другую видеозагрузку. Повторите загрузку позже.", 429, 2,
  ));
  const c = coordinator();
  await expect(c.save(payload(), [], [], api, task(), [], [selected()]))
    .rejects.toThrow("Сервер обрабатывает другую видеозагрузку");
  expect(c.snapshot().privateVideos?.[0].retryNotBefore).toBeGreaterThan(Date.now());
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
});
/** Создаёт API-double raw-видеозагрузки и status с запрещённым публичным fallback. */
function boundary() {
  return {
    create: vi.fn(async (_payload: unknown) => 42),
    update: vi.fn(async () => ({ success: true })),
    upload: vi.fn(async () => {
      throw Error("Public upload forbidden");
    }),
    uploadPrivateVideo: vi.fn(
      async (
        _file: File,
        _key: string,
        _signal: AbortSignal,
      ): Promise<unknown> => receipt,
    ),
    privateStatus: vi.fn(
      async (_input: unknown, _signal: AbortSignal): Promise<unknown> =>
        receipt,
    ),
  };
}
/** Создаёт операцию сохранения с проверяемым владением для моделирования смены аккаунта. */
const task = (owns = () => true) =>
  new OperationScope().begin("save", new AbortController().signal, owns)!;
/** Создаёт координатор с доступным durable checkpoint для приватного видео. */
function coordinator() {
  const c = new PostSaveCoordinator();
  c.setCheckpoint(async () => {});
  return c;
}

/** Проверяет отдельный лимит видео и запрет публичных URL в приватной квитанции. */
it("accepts video receipts above the audio/document limit without accepting public URLs", () => {
  expect(
    requirePrivateReceipt({ ...receipt, fileSize: 45 * 1024 * 1024 }),
  ).toEqual({ ...receipt, fileSize: 45 * 1024 * 1024 });
  expect(() =>
    requirePrivateReceipt({
      ...receipt,
      url: "https://storage.invalid/private.mp4",
    }),
  ).toThrow();
  expect(() =>
    requirePrivateReceipt({ ...receipt, fileSize: 80 * 1024 * 1024 + 1 }),
  ).toThrow();
});
/** До отправки raw File сохраняет исходный ключ и байты, затем привязывает asset вместо локальной или публичной ссылки. */
it("checkpoints original video bytes/key before raw upload and binds the asset instead of a local/public URL", async () => {
  const c = coordinator(),
    api = boundary(),
    video = selected();
  let durable = false;
  c.setCheckpoint(async (state) => {
    if (state.privateVideos?.[0]?.attempted) {
      expect(state.privateVideos[0].file).toBe(video.file);
      expect(state.privateVideos[0].key).toBe(key);
      durable = true;
    }
  });
  api.uploadPrivateVideo.mockImplementationOnce(
    async (file, idempotencyKey) => {
      expect(durable).toBe(true);
      expect(file).toBe(video.file);
      expect(idempotencyKey).toBe(key);
      expect(await file.text()).toBe("original video");
      return receipt;
    },
  );
  expect(await c.save(payload(), [], [], api, task(), [], [video])).toBe(42);
  expect(api.create.mock.calls[0][0]).toMatchObject({
    videos: ["https://vkvideo.ru/video-123_456"],
    privateAssetIds: [assetId],
    idempotencyKey: expect.any(String),
  });
  expect(api.upload).not.toHaveBeenCalled();
  expect(api.privateStatus).not.toHaveBeenCalled();
});
/** Отказ durable storage не допускает отправки видео и публикации. */
it("does not dispatch video bytes or publish when durable storage fails", async () => {
  const c = coordinator(),
    api = boundary();
  c.setCheckpoint(async () => {
    throw Error("Storage full");
  });
  await expect(
    c.save(payload(), [], [], api, task(), [], [selected()]),
  ).rejects.toThrow();
  expect(api.uploadPrivateVideo).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
  expect(api.upload).not.toHaveBeenCalled();
});
/** Восстанавливает потерянную квитанцию через status без повторной загрузки ready-видео. */
it("recovers lost upload ACK from status before publishing, without uploading ready bytes again", async () => {
  const c = coordinator(),
    api = boundary(),
    video = selected();
  api.uploadPrivateVideo.mockRejectedValueOnce(Error("Lost ACK"));
  await expect(
    c.save(payload(), [], [], api, task(), [], [video]),
  ).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();
  const restored = coordinator();
  restored.restore(c.snapshot());
  await restored.recoverUploads(api, task());
  expect(api.privateStatus).toHaveBeenCalledWith(
    { idempotencyKey: key },
    expect.any(AbortSignal),
  );
  expect(api.create).not.toHaveBeenCalled();
  await restored.save(payload(), [], [], api, task(), [], [video]);
  expect(api.uploadPrivateVideo).toHaveBeenCalledTimes(1);
  expect(api.create).toHaveBeenCalledTimes(1);
});
/** При явном восстановлении pending/notRecorded повторяет тот же File и ключ. */
it.each(["pending", "notRecorded"] as const)(
  "explicitly replays the same File/key after %s status",
  async (state) => {
    const video = { ...selected(), attempted: true };
    const c = coordinator(),
      api = boundary();
    api.privateStatus.mockResolvedValueOnce(
      state === "pending" ? { ...receipt, state } : { state },
    );
    await c.save(payload(), [], [], api, task(), [], [video]);
    expect(api.privateStatus).toHaveBeenCalledTimes(1);
    expect(api.uploadPrivateVideo).toHaveBeenCalledWith(
      video.file,
      key,
      expect.any(AbortSignal),
    );
    expect(api.create).toHaveBeenCalledTimes(1);
  },
);
/** Игнорирует поздний upload/status после смены аккаунта, не привязывая квитанцию. */
it.each(["upload", "status"] as const)(
  "ignores late %s response after account switch",
  async (stage) => {
    let owns = true;
    const video = { ...selected(), attempted: stage === "status" };
    const c = coordinator(),
      api = boundary();
    if (stage === "status")
      api.privateStatus.mockImplementationOnce(async () => {
        owns = false;
        return receipt;
      });
    else
      api.uploadPrivateVideo.mockImplementationOnce(async () => {
        owns = false;
        return receipt;
      });
    await expect(
      c.save(
        payload(),
        [],
        [],
        api,
        task(() => owns),
        [],
        [video],
      ),
    ).rejects.toThrow();
    expect(video).not.toHaveProperty("receipt");
    expect(api.create).not.toHaveBeenCalled();
  },
);
/** Неопределённый pending-ответ оставляет координатор в upload и блокирует частичную публикацию. */
it("keeps a pending upload response uncertain and does not publish a partial post", async () => {
  const c = coordinator(),
    api = boundary();
  api.uploadPrivateVideo.mockResolvedValueOnce({
    ...receipt,
    state: "pending",
  });
  await expect(
    c.save(payload(), [], [], api, task(), [], [selected()]),
  ).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();
  expect(c.snapshot().phase).toBe("upload");
});
/** Отклоняет неверные тип, размер, MIME или публичную ссылку до привязки видео. */
it.each([
  { ...receipt, fileSize: 1 },
  { ...receipt, type: "document" },
  { ...receipt, mimeType: "text/html" },
  { ...receipt, url: "https://storage.invalid/private.mp4" },
])("rejects an invalid video acknowledgement before binding", async (bad) => {
  const c = coordinator(),
    api = boundary();
  api.uploadPrivateVideo.mockResolvedValueOnce(bad);
  await expect(
    c.save(payload(), [], [], api, task(), [], [selected()]),
  ).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();
});
/** Требует raw-приватный транспорт и durable checkpoint, не переходя на публичную загрузку. */
it("requires raw private transport and a durable checkpoint, never public fallback", async () => {
  const api = boundary();
  const { uploadPrivateVideo: omitted, ...noVideo } = api;
  await expect(
    coordinator().save(payload(), [], [], noVideo, task(), [], [selected()]),
  ).rejects.toThrow();
  await expect(
    new PostSaveCoordinator().save(
      payload(),
      [],
      [],
      api,
      task(),
      [],
      [selected()],
    ),
  ).rejects.toThrow();
  expect(omitted).not.toHaveBeenCalled();
  expect(api.upload).not.toHaveBeenCalled();
  expect(api.create).not.toHaveBeenCalled();
});

/** Привязывает приватный poster явной парой assetId и не добавляет его в фотогалерею. */
it("keeps a video poster private and binds its explicit asset without adding it to the gallery", async () => {
  const photoAssetId = "abf23d8c-140f-454b-a123-123456789abc";
  const video = { ...selected(), poster: { key: "private-video-poster-key", file: new File(["poster"], "poster.png", { type: "image/png" }) } };
  const api = { ...boundary(), uploadPrivatePhoto: vi.fn(async () => ({ state: "ready", assetId: photoAssetId, usage: "postPhoto", filename: "poster.png", mimeType: "image/webp", fileSize: 17, url: `/api/media/content-files/${photoAssetId}` })), privatePhotoStatus: vi.fn(async () => ({state:"notRecorded"})) };
  await coordinator().save(payload(), [], [], api, task(), [], [video]);
  expect(api.create.mock.calls[0][0]).toMatchObject({ photos: [], privateAssetIds: [assetId], privateVideoPosters: [{ videoAssetId: assetId, posterAssetId: photoAssetId }] });
  expect(api.uploadPrivatePhoto).toHaveBeenCalledTimes(1); expect(api.upload).not.toHaveBeenCalled();
});
/** После потери ответа create повторяет замороженный payload без повторной загрузки видео или poster. */
it("replays a frozen create after lost response without uploading video or poster again", async () => {
  const api=boundary(),c=coordinator();api.create.mockRejectedValueOnce(Error("Lost create ACK"));
  await expect(c.save(payload(),[],[],api,task(),[],[selected()])).rejects.toThrow();
  expect(c.snapshot().phase).toBe("create");
  const restored=coordinator();restored.restore(c.snapshot());await restored.recoverCreation(api,task());
  expect(api.create.mock.calls[1][0]).toEqual(api.create.mock.calls[0][0]);expect(api.uploadPrivateVideo).toHaveBeenCalledTimes(1);expect(api.create.mock.calls[1][0]).not.toHaveProperty("file");
});
/** Не повторяет update с неизвестным результатом и не отправляет его видео заново. */
it("does not replay an unknown update or upload its video again", async () => {
  const api=boundary(),c=new PostSaveCoordinator(42);c.setCheckpoint(async()=>{});api.update.mockRejectedValueOnce(Error("Lost update ACK"));
  await expect(c.save(payload(),[],[],api,task(),[],[selected()])).rejects.toThrow();
  const restored=coordinator();restored.restore(c.snapshot());
  await expect(restored.recoverCreation(api,task())).rejects.toThrow();await expect(restored.save(payload(),[],[],api,task())).rejects.toThrow();
  expect(api.create).not.toHaveBeenCalled();expect(api.update).toHaveBeenCalledTimes(1);expect(api.uploadPrivateVideo).toHaveBeenCalledTimes(1);
});
/** Отклоняет отсутствующие и повторные локальные видео и не загружает снятый с выбора файл. */
it("rejects missing or repeated local videos and never uploads a removed selection", async () => {
  const api=boundary();await expect(coordinator().save(payload(),[],[],api,task(),[],[])).rejects.toThrow();
  await expect(coordinator().save(payload(),[],[],api,task(),[],[selected(),selected()])).rejects.toThrow();
  await coordinator().save({...payload(),videos:[]},[],[],api,task(),[],[selected()]);
  expect(api.uploadPrivateVideo).not.toHaveBeenCalled();expect(api.create.mock.calls[0][0]).not.toHaveProperty("privateAssetIds");
});
