/** Подменяем браузерные primitives и fetch, проверяя ранние лимиты файлов, безопасные ошибки, отмену загрузки и владение результатом операции. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadAdminVideoBlob } from "../apps/frontend/src/features/admin/media/video-upload";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { attachmentBase64 } from "../apps/frontend/src/shared/media/read-attachment";
import {
  fileToUpload,
  compressImageBlob,
} from "../apps/frontend/src/shared/media/image-upload";
import {
  MAX_ATTACHMENT_BYTES,
  validateFileSelection,
} from "../apps/frontend/src/shared/browser/file-operations";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import {
  PHOTO_RATIO_CACHE_LIMIT,
  getCachedPhotoRatio,
  rememberPhotoRatio,
} from "../apps/frontend/src/shared/media/photo-ratio-cache";

/** Неверные размеры не заменяют уже известное корректное отношение сторон в кеше. */
it("rejects invalid image dimensions without poisoning remembered proportions", () => {
  const uri = "https://images.example.test/valid-ratio";
  expect(rememberPhotoRatio(uri, 800, 400)).toBe(2);
  for (const [width, height] of [
    [0, 400],
    [800, -1],
    [NaN, 400],
    [800, Infinity],
    [Number.MAX_VALUE, Number.MIN_VALUE],
  ]) {
    expect(rememberPhotoRatio(uri, width, height)).toBeNull();
    expect(getCachedPhotoRatio(uri)).toBe(2);
  }
});

/** После достижения лимита вытесняется давно не использованное изображение, а недавно прочитанное остаётся. */
it("bounds the photo metadata cache and retains recently used photos", () => {
  const uri = (index: number) => `https://images.example.test/cache-${index}`;
  for (let index = 0; index < PHOTO_RATIO_CACHE_LIMIT; index++)
    rememberPhotoRatio(uri(index), 640, 800);
  expect(getCachedPhotoRatio(uri(0))).toBe(0.8);
  rememberPhotoRatio(uri(PHOTO_RATIO_CACHE_LIMIT), 800, 400);
  expect(getCachedPhotoRatio(uri(1))).toBeUndefined();
  expect(getCachedPhotoRatio(uri(0))).toBe(0.8);
  expect(getCachedPhotoRatio(uri(PHOTO_RATIO_CACHE_LIMIT))).toBe(2);
});

/** Возвращаем настоящий clock и globals, завершая session-scoped запросы после сценария. */
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cancelSessionRequests();
});
/** Минимальный Blob используется только как тело подменённого транспорта, а не как настоящий декодируемый MP4. */
const video = () => new Blob(["video"], { type: "video/mp4" });
/** Пустое, HTML и JSON тело 413 одинаково дают понятный отказ размера без повторного чтения ответа. */
it.each(["<html>too big</html>", "", '{"error":"private details"}'])(
  "handles a 413 body once: %s",
  async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body, { status: 413 })),
    );
    await expect(
      uploadAdminVideoBlob(video(), "test.mp4"),
    ).rejects.toMatchObject({
      status: 413,
      message: expect.stringContaining("слишком большое"),
    });
  },
);
/** Внутренний текст 500 не показывается пользователю как ошибка загрузки. */
it("does not expose raw HTML or internal messages from an upload server", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response('{"error":"PRIVATE_SQL_SECRET"}', { status: 500 }),
    ),
  );
  await expect(uploadAdminVideoBlob(video(), "test.mp4")).rejects.toMatchObject(
    { message: "Сервис временно недоступен. Попробуйте ещё раз." },
  );
});
/** Из безопасного allowlist сохраняются конкретные сообщения отказа формата и пустого файла. */
it.each(["Некорректный видеофайл", "Пустой файл"])(
  "explains the documented video validation refusal: %s",
  async (message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: message }, { status: 400 })),
    );
    await expect(
      uploadAdminVideoBlob(video(), "test.mp4"),
    ).rejects.toMatchObject({ status: 400, message });
  },
);
/** Неизвестный текст даже с 400 заменяется безопасным объяснением. */
it("does not expose an unexpected raw upload error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "PRIVATE_SQL_SECRET" }, { status: 400 }),
    ),
  );
  await expect(uploadAdminVideoBlob(video(), "test.mp4")).rejects.toMatchObject(
    { message: "Не удалось загрузить видео. Проверьте формат файла." },
  );
});
/** GIF-сигнатура обнаруживается до bitmap/FileReader, несмотря на подменённые имя и MIME. */
it("rejects GIF before decoding or reading it as base64", async () => {
  const reader = vi.fn();
  const bitmap = vi.fn();
  vi.stubGlobal("FileReader", reader);
  vi.stubGlobal("createImageBitmap", bitmap);
  await expect(
    fileToUpload(new File(["GIF89a"], "renamed.png", { type: "image/png" })),
  ).rejects.toThrow("Анимированные изображения");
  expect(reader).not.toHaveBeenCalled();
  expect(bitmap).not.toHaveBeenCalled();
});
/** Ответ upload обязан содержать допустимый адрес без активной схемы, credentials или неверного типа. */
it.each([
  "javascript:alert(1)",
  "",
  123,
  "https://user:pass@example.test/video",
])("rejects an invalid upload URL: %s", async (url) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ url })),
  );
  await expect(uploadAdminVideoBlob(video(), "test.mp4")).rejects.toMatchObject(
    { kind: "invalid-response" },
  );
});
/** Deadline охватывает чтение тела ответа, а не только момент получения заголовков. */
it("times out even when upload headers arrive but its body hangs", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, text: () => new Promise(() => {}) })),
  );
  const pending = expect(
    uploadAdminVideoBlob(video(), "test.mp4"),
  ).rejects.toMatchObject({ kind: "timeout" });
  await vi.advanceTimersByTimeAsync(180_001);
  await pending;
});
/** Смена сессии прекращает прямую загрузку даже при fetch, который сам не завершает promise. */
it("cancels a direct upload on session change", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  const pending = expect(
    uploadAdminVideoBlob(video(), "test.mp4"),
  ).rejects.toMatchObject({ kind: "cancelled" });
  cancelSessionRequests();
  await pending;
});
/** Размер вложения ограничивается до Base64 и сетевой работы, чтобы не выделять лишнюю память. */
it("rejects a large attachment before FileReader or fetch is called", async () => {
  const fetch = vi.fn();
  const reader = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("FileReader", reader);
  const large = { size: MAX_ATTACHMENT_BYTES + 1 } as Blob;
  await expect(attachmentBase64(large)).rejects.toThrow("32 МБ");
  expect(fetch).not.toHaveBeenCalled();
  expect(reader).not.toHaveBeenCalled();
});
/** Проверяется весь список: один слишком большой файл или превышение количества останавливают подготовку целиком. */
it("checks the complete selection before reading any selected file", () => {
  expect(() =>
    validateFileSelection([
      { size: 1 },
      { size: MAX_ATTACHMENT_BYTES + 1 },
    ] as File[]),
  ).toThrow("32 МБ");
  expect(() =>
    validateFileSelection(
      Array.from({ length: 21 }, () => ({ size: 1 })) as File[],
    ),
  ).toThrow("20 файлов");
});
/** SVG не проходит как растровое фото и не передаётся в FileReader. */
it("rejects unsupported active image content before decoding", async () => {
  const file = new File(["<svg/>"], "picture.svg", { type: "image/svg+xml" });
  const reader = vi.fn();
  vi.stubGlobal("FileReader", reader);
  await expect(fileToUpload(file)).rejects.toThrow("Неподдерживаемый формат");
  expect(reader).not.toHaveBeenCalled();
});
/** Ресурс декодирования освобождается и на ошибке canvas, не только после успешной конвертации. */
it("closes a decoded bitmap even when creating the canvas fails", async () => {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 100, height: 100, close })),
  );
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => null }),
  });
  await expect(
    compressImageBlob(new Blob(["image"], { type: "image/png" })),
  ).rejects.toThrow("подготовить фото");
  expect(close).toHaveBeenCalledTimes(1);
});
/** Модель редактора допускает только одну текущую операцию и не принимает результат отменённого владельца. */
describe("operation ownership", () => {
  /** Старый finish не снимает блокировку новой операции после cancel и повторного открытия. */
  it("locks synchronously and prevents a late result affecting a reopened editor", () => {
    const scope = new OperationScope();
    const parent = new AbortController();
    const old = scope.begin("upload", parent.signal, () => true)!;
    expect(scope.begin("save", parent.signal, () => true)).toBeNull();
    scope.cancel();
    const next = scope.begin("save", parent.signal, () => true)!;
    expect(old.signal.aborted).toBe(true);
    expect(old.isCurrent()).toBe(false);
    old.finish();
    expect(scope.getSnapshot()).toBe("save");
    next.finish();
    expect(scope.getSnapshot()).toBeNull();
  });
  /** Abort родительской сессии лишает подготовку права начинать последующую серверную запись. */
  it("cancels preparation before a server mutation can start after a session change", () => {
    const scope = new OperationScope();
    const parent = new AbortController();
    const operation = scope.begin("prepare", parent.signal, () => true)!;
    parent.abort();
    expect(() => operation.assertCurrent()).toThrow("отменена");
    expect(operation.signal.aborted).toBe(true);
    expect(scope.getSnapshot()).toBeNull();
  });
});

/** 401 инициирует проверку сессии до чтения зависшего тела, после чего текущая загрузка отменяется. */
it("checks an upload 401 immediately even when its response body stalls", async () => {
  const { subscribeSessionChecks } =
    await import("../apps/frontend/src/shared/api/session-events");
  const check = vi.fn(() => cancelSessionRequests());
  const unsubscribe = subscribeSessionChecks(check);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status: 401,
      ok: false,
      text: () => new Promise<string>(() => {}),
    })),
  );
  try {
    await expect(
      uploadAdminVideoBlob(video(), "test.mp4"),
    ).rejects.toMatchObject({ kind: "cancelled" });
    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith(401);
  } finally {
    unsubscribe();
  }
});
