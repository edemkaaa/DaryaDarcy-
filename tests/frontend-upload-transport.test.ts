import { afterEach, expect, it, vi } from "vitest";
import { getUntypedClient } from "@trpc/client";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";
import {
  cancelSessionRequests,
  getSessionRequestSignal,
} from "../apps/frontend/src/shared/api/request-lifecycle";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import {
  uploadPrivateContentFile,
  type PrivateContentFile,
} from "../apps/frontend/src/shared/media/private-content-upload";

vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  /** Возвращает известные исходные байты документа в Base64 для проверки неизменного upload payload. */
  attachmentBase64: async () =>
    Buffer.from("original document").toString("base64"),
}));
/** Отменяет сессионные запросы и очищает управляемые таймеры и globals после сценария. */
afterEach(() => {
  cancelSessionRequests();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const uploads = [
  "admin.uploadPrivateContentFile",
  "admin.uploadPrivateAttachment",
  "admin.uploadPublicCover",
  "profile.uploadAvatarWithReceipt",
  "club.uploadPrivateCommentPhoto",
  "admin.uploadMedia",
] as const;
/** Формирует одиночный или batch tRPC-ответ в зависимости от фактического URL транспорта. */
const reply = (url: RequestInfo | URL, value: unknown) => {
  const result = { result: { data: { json: value } } };
  return Response.json(String(url).includes("batch=1") ? [result] : result);
};
const input = { idempotencyKey: "original-file-key-0001", base64: "Ynl0ZXM=" };
/** Сохраняет отказ Promise как проверяемое значение, чтобы fake timers не оставляли необработанное отклонение. */
const errorOf = (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => error);

/** Проверяет, что файловая mutation может завершиться позже обычного 15-секундного дедлайна. */
it.each(uploads)(
  "%s can finish after the ordinary 15-second deadline",
  async (path) => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (url: RequestInfo | URL) =>
        new Promise<Response>((resolve) => {
          setTimeout(() => resolve(reply(url, { state: "ready" })), 40_000);
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const result = errorOf(
      getUntypedClient(createTRPCClient()).mutation(path, input),
    );
    await vi.advanceTimersByTimeAsync(40_001);
    expect(await result).toEqual({ state: "ready" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

/** Отправляет файлы отдельными запросами без batch с соседними файлами или обычными записями и сохраняет исходные тела. */
it("isolates every file from other files and ordinary writes, keeping the original payload", async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
    reply(url, { state: "ready" }),
  );
  vi.stubGlobal("fetch", fetcher);
  const client = getUntypedClient(createTRPCClient());
  const second = { ...input, idempotencyKey: "original-file-key-0002" };
  await Promise.all([
    client.mutation("admin.uploadPrivateContentFile", input),
    client.mutation("admin.uploadPrivateContentFile", second),
    client.mutation("admin.updatePost", { id: 42, text: "ordinary write" }),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const files = fetcher.mock.calls.filter(([url]) =>
    String(url).includes("admin.uploadPrivateContentFile"),
  );
  expect(files).toHaveLength(2);
  expect(
    files.map(([url, init]) => {
      expect(String(url)).not.toContain(",");
      expect(String(url)).not.toContain(input.idempotencyKey);
      expect(init).toMatchObject({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      expect(new Headers(init?.headers).has("Idempotency-Key")).toBe(false);
      const body = JSON.parse(String(init?.body));
      return body.json ?? body[0].json;
    }),
  ).toEqual([input, second]);
});

/** Оставляет короткий дедлайн чтению status и обычным query. */
it.each([
  "feed.tags",
  "admin.privateContentFileStatus",
  "profile.avatarUploadStatus",
])("status/read %s keeps the short deadline", async (path) => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const result = errorOf(
    getUntypedClient(createTRPCClient()).query(path, {
      idempotencyKey: input.idempotencyKey,
    }),
  );
  await vi.advanceTimersByTimeAsync(15_001);
  expect(await result).toMatchObject({ cause: { kind: "timeout" } });
  expect(vi.getTimerCount()).toBe(0);
});

/** Разделяет бюджеты обычной записи и долгой загрузки одного клиента. */
it("an ordinary mutation still times out in 15 seconds while a file has its own budget", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetcher);
  const client = getUntypedClient(createTRPCClient());
  const ordinary = errorOf(client.mutation("admin.updatePost", { id: 42 }));
  let fileFinished = false;
  const file = errorOf(
    client.mutation("admin.uploadPrivateAttachment", input),
  ).then((result) => {
    fileFinished = true;
    return result;
  });
  await vi.advanceTimersByTimeAsync(15_001);
  expect(await ordinary).toMatchObject({ cause: { kind: "timeout" } });
  expect(fileFinished).toBe(false);
  await vi.advanceTimersByTimeAsync(164_999);
  expect(await file).toMatchObject({ cause: { kind: "timeout" } });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

/** Останавливает зависший fetch или body загрузки ровно по 180-секундному сроку без автоматического повтора. */
it.each(["request", "body"])(
  "a hung upload %s stops at 180 seconds without automatic retry",
  async (part) => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      part === "request"
        ? new Promise<Response>(() => {})
        : Promise.resolve(new Response(new ReadableStream({ /** Оставляет поток ответа открытым без байтов, моделируя зависшее чтение body. */ start() {} }))),
    );
    vi.stubGlobal("fetch", fetcher);
    let finished = false;
    const result = errorOf(
      getUntypedClient(createTRPCClient()).mutation(
        "admin.uploadPrivateContentFile",
        input,
      ),
    ).then((value) => {
      finished = true;
      return value;
    });
    await vi.advanceTimersByTimeAsync(179_999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ cause: { kind: "timeout" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  },
);

/** Отмена caller или сессии прерывает долгую загрузку и не принимает позднюю квитанцию. */
it.each(["caller", "session"])(
  "%s cancellation aborts a long upload without accepting a late receipt",
  async (owner) => {
    let complete!: (response: Response) => void;
    const fetcher = vi.fn(
      (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const result = errorOf(
      getUntypedClient(createTRPCClient()).mutation(
        "admin.uploadPrivateContentFile",
        input,
        { signal: controller.signal },
      ),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    if (owner === "caller") controller.abort();
    else cancelSessionRequests();
    expect(await result).toMatchObject({ cause: { kind: "cancelled" } });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    complete(reply(fetcher.mock.calls[0][0], { state: "ready" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

/** Сохраняет явно заданный валидный Idempotency-Key на изолированном файловом запросе. */
it("preserves an explicitly supplied operation header on an isolated file", async () => {
  const key = "8d427a00-4a92-4508-874c-b265d7e92d1c";
  const fetcher = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) =>
    reply(url, { state: "ready" }),
  );
  vi.stubGlobal("fetch", fetcher);
  await getUntypedClient(createTRPCClient()).mutation(
    "admin.uploadPrivateContentFile",
    input,
    { context: { idempotencyKey: key } },
  );
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"),
  ).toBe(key);
});

/** Отклоняет повреждённый operation header до отправки файла. */
it("rejects a malformed operation header before dispatching a file", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    getUntypedClient(createTRPCClient()).mutation(
      "admin.uploadPrivateContentFile",
      input,
      { context: { idempotencyKey: "invalid" } },
    ),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});

/** После таймаута восстанавливает ready-файл через status с прежним ключом, не отправляя исходные байты повторно. */
it("recovers a timed-out file status-first using its original key and bytes without re-uploading", async () => {
  vi.useFakeTimers();
  const file: PrivateContentFile<"articleDocument"> = {
    key: "original-document-intent-0001",
    file: new File(["original document"], "original.txt", {
      type: "text/plain",
    }),
  };
  const assetId = "3af23d8c-140f-454b-a123-123456789abc";
  const receipt = {
    state: "ready",
    assetId,
    usage: "articleDocument",
    filename: "original.txt",
    mimeType: "text/plain",
    fileSize: file.file.size,
    url: `/api/media/content-files/${assetId}`,
  };
  const requests: { path: string; input: Record<string, unknown> }[] = [];
  const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url), "http://fixture.invalid").pathname.split(
      "/api/trpc/",
    )[1];
    const encoded =
      init?.body ??
      new URL(String(url), "http://fixture.invalid").searchParams.get("input")!;
    const body = JSON.parse(String(encoded));
    requests.push({ path, input: body.json ?? body[0].json });
    return path === "admin.uploadPrivateContentFile"
      ? new Promise<Response>(() => {})
      : Promise.resolve(reply(url, receipt));
  });
  vi.stubGlobal("fetch", fetcher);
  const client = createTRPCClient();
  const api = {
    /** Связывает helper загрузки с настоящей tRPC mutation и передаёт её AbortSignal. */
    upload: (
      value: Parameters<typeof client.admin.uploadPrivateContentFile.mutate>[0],
      signal: AbortSignal,
    ) => client.admin.uploadPrivateContentFile.mutate(value, { signal }),
    /** Связывает helper восстановления с query статуса прежнего ключа и AbortSignal. */
    status: (value: { idempotencyKey: string }, signal: AbortSignal) =>
      client.admin.privateContentFileStatus.query(value, { signal }),
  };
  /** Создаёт файловую операцию в текущем поколении сессии для проверки её отмены. */
  const task = () =>
    new OperationScope().begin("file", getSessionRequestSignal(), () => true)!;
  const checkpoint = vi.fn(async () => {});
  const first = errorOf(
    uploadPrivateContentFile(file, "articleDocument", api, task(), checkpoint),
  );
  await vi.advanceTimersByTimeAsync(180_001);
  expect(await first).toMatchObject({ cause: { kind: "timeout" } });
  expect(file.attempted).toBe(true);
  expect(file.receipt).toBeUndefined();
  expect(requests).toHaveLength(1);
  const restored = { ...file };
  const recovery = uploadPrivateContentFile(
    restored,
    "articleDocument",
    api,
    task(),
    checkpoint,
  );
  await vi.advanceTimersByTimeAsync(1);
  await recovery;
  expect(restored.receipt).toMatchObject(receipt);
  expect(requests.map((request) => request.path)).toEqual([
    "admin.uploadPrivateContentFile",
    "admin.privateContentFileStatus",
  ]);
  expect(requests[0].input).toMatchObject({
    idempotencyKey: file.key,
    base64: Buffer.from("original document").toString("base64"),
  });
  expect(requests[1].input).toEqual({ idempotencyKey: file.key });
});
