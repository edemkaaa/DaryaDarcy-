import { expect, it, vi } from "vitest";
import {
  preparePrivateComment,
  savePrivateComment,
  type PrivateCommentApi,
  type PrivateCommentRecord,
} from "../apps/frontend/src/domain/post/private-comment-save";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  /** Изолированно кодирует байты File в Base64, не используя browser FileReader в этом unit-наборе. */
  attachmentBase64: async (file: File) =>
    Buffer.from(await file.arrayBuffer()).toString("base64"),
}));
const url = "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc";
/** Создаёт фото комментария с постоянным ключом операции для проверки восстановления. */
const file = () => ({
  key: "comment-photo-intent-0001",
  file: new File(["png bytes"], "photo.png", { type: "image/png" }),
});
/** Формирует каноническую квитанцию приватного фото и допускает адресную инъекцию повреждения. */
const ready = (
  input: { filename: string },
  patch: Record<string, unknown> = {},
) => ({
  state: "ready",
  assetId: "3af23d8c-140f-454b-a123-123456789abc",
  usage: "commentPhoto",
  filename: input.filename,
  mimeType: "image/webp",
  fileSize: 80,
  url,
  ...patch,
});
/** Фиксирует владельца, родительский пост, ответ и исходный текст до первой загрузки. */
const prepare = () =>
  preparePrivateComment(
    101,
    { postId: 42, text: " original text ", parentId: 7 },
    [file()],
  );
/** Создаёт действующую операцию комментария с отдельным сигналом отмены. */
const task = () =>
  new OperationScope().begin(
    "comment",
    new AbortController().signal,
    () => true,
  )!;
/** Создаёт API-double загрузки, чтения статуса и добавления комментария. */
const api = () => ({
  upload: vi.fn<PrivateCommentApi["upload"]>(async (input) => ready(input)),
  status: vi.fn<PrivateCommentApi["status"]>(async () => ({
    state: "notRecorded",
  })),
  add: vi.fn<PrivateCommentApi["add"]>(async () => ({ id: 99 })),
});
/** Собирает checkpoints журнала с именами File, сохраняя порядок durable-стадий для утверждений. */
const saved = () => {
  const checkpoints: string[] = [];
  return {
    checkpoints,
    checkpoint: vi.fn(async (record: PrivateCommentRecord) => {
      checkpoints.push(
        JSON.stringify({
          ...record,
          files: record.files.map((f) => ({ ...f, file: f.file.name })),
        }),
      );
    }),
  };
};
/** Сохраняет исходную цель и intent до загрузки, а точный payload с привязками замораживает до addComment. */
it("persists original post/reply/text and file intent before upload; freezes binding before addComment", async () => {
  const record = prepare(),
    port = api(),
    storage = saved();
  port.upload.mockImplementation(async (input) => {
    expect(storage.checkpoints.length).toBeGreaterThan(0);
    expect(input).toMatchObject({
      postId: 42,
      usage: "commentPhoto",
      idempotencyKey: "comment-photo-intent-0001",
      base64: Buffer.from("png bytes").toString("base64"),
    });
    return ready(input);
  });
  port.add.mockImplementation(async (input) => {
    expect(JSON.parse(storage.checkpoints.at(-1)!)).toMatchObject({
      phase: "write",
      payloadJson: JSON.stringify(input),
    });
    expect(input).toEqual({
      postId: 42,
      text: "original text",
      parentId: 7,
      photos: [url],
      idempotencyKey: record.key,
    });
    return { id: 99 };
  });
  expect(
    await savePrivateComment(record, port, task(), storage.checkpoint),
  ).toBe(99);
  expect(record.savedId).toBe(99);
});
/** После потери ответа загрузки сначала читает её статус по прежнему ключу без повторной отправки файла. */
it("lost upload reply recovers status first with the original post/key and no duplicate upload", async () => {
  const record = prepare(),
    port = api(),
    storage = saved();
  port.upload.mockRejectedValueOnce(new Error("lost upload"));
  await expect(
    savePrivateComment(record, port, task(), storage.checkpoint),
  ).rejects.toThrow("lost upload");
  expect(port.add).not.toHaveBeenCalled();
  port.status.mockResolvedValueOnce(ready({ filename: "photo.png" }));
  expect(
    await savePrivateComment(record, port, task(), storage.checkpoint),
  ).toBe(99);
  expect(port.upload).toHaveBeenCalledTimes(1);
  expect(port.status).toHaveBeenCalledWith(
    { idempotencyKey: "comment-photo-intent-0001" },
    expect.any(AbortSignal),
  );
});
/** При notRecorded повторяет исходные байты и ключ; после потери addComment повторяет только замороженный payload. */
it("notRecorded replays identical bytes/key and lost addComment reply replays the exact frozen payload", async () => {
  const record = prepare(),
    port = api(),
    storage = saved();
  port.upload.mockRejectedValueOnce(new Error("lost upload"));
  await expect(
    savePrivateComment(record, port, task(), storage.checkpoint),
  ).rejects.toThrow();
  port.add.mockRejectedValueOnce(new Error("lost write"));
  await expect(
    savePrivateComment(record, port, task(), storage.checkpoint),
  ).rejects.toThrow("lost write");
  const first = structuredClone(port.add.mock.calls[0][0]);
  expect(
    await savePrivateComment(record, port, task(), storage.checkpoint),
  ).toBe(99);
  expect(port.upload.mock.calls[1][0]).toEqual(port.upload.mock.calls[0][0]);
  expect(port.upload).toHaveBeenCalledTimes(2);
  expect(port.add.mock.calls[1][0]).toEqual(first);
});
/** Отказ durable checkpoint блокирует следующий сетевой этап: загрузку либо финальный addComment. */
it("storage refusal prevents upload and failed write checkpoint prevents addComment", async () => {
  const record = prepare(),
    port = api();
  await expect(
    savePrivateComment(record, port, task(), async () => {
      throw new Error("storage denied");
    }),
  ).rejects.toThrow("storage denied");
  expect(port.upload).not.toHaveBeenCalled();
  const second = prepare();
  await expect(
    savePrivateComment(second, port, task(), async (value) => {
      if (value.phase === "write") throw new Error("write checkpoint denied");
    }),
  ).rejects.toThrow("write checkpoint denied");
  expect(port.add).not.toHaveBeenCalled();
});
/** Не создаёт комментарий по недоверенной или ещё ожидающей квитанции. */
it.each([
  { usage: "postPhoto" },
  { url: "https://storage.example.test/private" },
  { objectKey: "private/key" },
  { state: "pending", url },
])(
  "rejects untrusted or pending receipt %j before comment creation",
  async (patch) => {
    const record = prepare(),
      port = api();
    port.upload.mockImplementation(async (input) => ready(input, patch));
    await expect(
      savePrivateComment(record, port, task(), saved().checkpoint),
    ).rejects.toThrow();
    expect(port.add).not.toHaveBeenCalled();
  },
);
/** Не применяет позднюю квитанцию загрузки после смены владельца операции. */
it("account change while awaiting upload ignores late receipt and never writes a comment", async () => {
  const record = prepare(),
    port = api(),
    scope = new OperationScope();
  const operation = scope.begin(
    "comment",
    new AbortController().signal,
    () => true,
  )!;
  port.upload.mockImplementation(async (input) => {
    scope.cancel();
    return ready(input);
  });
  await expect(
    savePrivateComment(record, port, operation, saved().checkpoint),
  ).rejects.toThrow();
  expect(record.files[0].receipt).toBeUndefined();
  expect(port.add).not.toHaveBeenCalled();
});
/** После потери ответа записи запрещает менять цель, текст, фото и ключ вместо создания другого комментария. */
it("rejects post/text/photo changes after a lost write instead of silently creating another comment", async () => {
  for (const mutate of [
    (r: PrivateCommentRecord) => {
      r.postId = 43;
    },
    (r: PrivateCommentRecord) => {
      r.text = "changed";
    },
    (r: PrivateCommentRecord) => {
      r.files = [];
    },
    (r: PrivateCommentRecord) => {
      r.key = "different-create-key-0001";
    },
  ]) {
    const record = prepare(),
      port = api();
    port.add.mockRejectedValueOnce(new Error("lost write"));
    await expect(
      savePrivateComment(record, port, task(), saved().checkpoint),
    ).rejects.toThrow("lost write");
    mutate(record);
    await expect(
      savePrivateComment(record, port, task(), saved().checkpoint),
    ).rejects.toThrow();
    expect(port.add).toHaveBeenCalledTimes(1);
  }
});
/** Не публикует по pending, но после ready status использует прежнюю квитанцию без нового PUT. */
it("pending upload cannot publish; ready status preserves the receipt without another PUT", async () => {
  const record = prepare(),
    port = api();
  port.upload.mockImplementation(async (input) =>
    ready(input, { state: "pending", url: undefined }),
  );
  await expect(
    savePrivateComment(record, port, task(), saved().checkpoint),
  ).rejects.toThrow();
  expect(port.add).not.toHaveBeenCalled();
  port.status.mockResolvedValueOnce(ready({ filename: "photo.png" }));
  expect(
    await savePrivateComment(record, port, task(), saved().checkpoint),
  ).toBe(99);
  expect(port.upload).toHaveBeenCalledTimes(1);
});
/** Игнорирует поздний успех status/addComment после отмены владельцем операции. */
it("account change during status or addComment rejects late success", async () => {
  for (const stage of ["status", "add"] as const) {
    const record = prepare(),
      port = api(),
      scope = new OperationScope();
    const operation = scope.begin(
      "comment",
      new AbortController().signal,
      () => true,
    )!;
    if (stage === "status") {
      record.files[0].attempted = true;
      port.status.mockImplementation(async () => {
        scope.cancel();
        return ready({ filename: "photo.png" });
      });
    } else
      port.add.mockImplementation(async () => {
        scope.cancel();
        return { id: 99 };
      });
    await expect(
      savePrivateComment(record, port, operation, saved().checkpoint),
    ).rejects.toThrow();
    expect(record.savedId).toBeNull();
    if (stage === "status") {
      expect(record.files[0].receipt).toBeUndefined();
      expect(port.upload).not.toHaveBeenCalled();
      expect(port.add).not.toHaveBeenCalled();
    }
  }
});
/** Не позволяет повтором обойти отказ сохранения замороженного payload. */
it("a failed frozen-payload checkpoint cannot be bypassed on retry", async () => {
  const record = prepare(),
    port = api();
  /** Имитирует отказ durable storage именно на стадии финальной записи комментария. */
  const denied = async (value: PrivateCommentRecord) => {
    if (value.phase === "write") throw new Error("storage denied");
  };
  for (let attempt = 0; attempt < 2; attempt++)
    await expect(
      savePrivateComment(record, port, task(), denied),
    ).rejects.toThrow("storage denied");
  expect(port.upload).toHaveBeenCalledTimes(1);
  expect(port.add).not.toHaveBeenCalled();
});
/** Проверяет порядок двух фото и запрещает подмену второй квитанции повторным assetId первого. */
it("two photos preserve order and a repeated asset cannot substitute for the second receipt", async () => {
  const second = {
    key: "comment-photo-intent-0002",
    file: new File(["other png"], "second.png", { type: "image/png" }),
  };
  const record = preparePrivateComment(
      101,
      { postId: 42, text: "two photos" },
      [file(), second],
    ),
    port = api();
  await expect(
    savePrivateComment(record, port, task(), saved().checkpoint),
  ).rejects.toThrow();
  expect(port.add).not.toHaveBeenCalled();
  const fresh = preparePrivateComment(101, { postId: 42, text: "two photos" }, [
    file(),
    second,
  ]);
  const ordered = api();
  ordered.upload.mockImplementation(async (input) =>
    ready(
      input,
      input.filename === "second.png"
        ? {
            assetId: "3af23d8c-140f-454b-a123-123456789abd",
            url: "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abd",
          }
        : {},
    ),
  );
  await savePrivateComment(fresh, ordered, task(), saved().checkpoint);
  expect(ordered.add.mock.calls[0][0].photos).toEqual([
    url,
    "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abd",
  ]);
});
/** Отклоняет некорректную цель, пустую или избыточную подборку и дубли intent до сетевых действий. */
it("refuses invalid targets, oversized selections and duplicate file intents before network", () => {
  for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() =>
      preparePrivateComment(101, { postId: id, text: "text" }, [file()]),
    ).toThrow();
  expect(() =>
    preparePrivateComment(101, { postId: 42, text: "text" }, []),
  ).toThrow();
  expect(() =>
    preparePrivateComment(101, { postId: 42, text: "text" }, [file(), file()]),
  ).toThrow();
  expect(() =>
    preparePrivateComment(101, { postId: 42, text: "text" }, [
      file(),
      file(),
      file(),
    ]),
  ).toThrow();
});
