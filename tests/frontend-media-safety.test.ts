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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cancelSessionRequests();
});
const video = () => new Blob(["video"], { type: "video/mp4" });
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
it("rejects unsupported active image content before decoding", async () => {
  const file = new File(["<svg/>"], "picture.svg", { type: "image/svg+xml" });
  const reader = vi.fn();
  vi.stubGlobal("FileReader", reader);
  await expect(fileToUpload(file)).rejects.toThrow("Неподдерживаемый формат");
  expect(reader).not.toHaveBeenCalled();
});
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
describe("operation ownership", () => {
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
