import { serializePostDraft } from "./draft";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { getHttpStatus } from "@/shared/api/errors";
import { attachmentBase64 } from "@/shared/media/read-attachment";
import { validateFileSize } from "@/shared/browser/file-operations";
import { requireUploadedMedia } from "@/shared/media/upload-result";
import type { ApiInputs } from "@/shared/api/types";

export type PostPayload = ReturnType<typeof serializePostDraft>;
type Payload = PostPayload;
type UploadedAttachment = NonNullable<
  ApiInputs["admin"]["createPost"]["attachments"]
>[number];
export type SavePayload = Payload & {
  attachments?: UploadedAttachment[];
  removedMediaIds?: number[];
};
type CreatePayload = SavePayload & { idempotencyKey: string };
type UpdatePayload = Partial<SavePayload>;
export type PostAttachment = {
  type: "audio" | "document";
  name: string;
  mimeType: string;
  file?: File;
  id?: number;
  url?: string;
};
export type PostSaveApi = {
  create: (payload: CreatePayload, signal: AbortSignal) => Promise<unknown>;
  update: (
    id: number,
    payload: UpdatePayload,
    signal: AbortSignal,
  ) => Promise<unknown>;
  upload: (
    input: {
      base64: string;
      filename: string;
      mimeType: string;
      type: "audio" | "document";
    },
    signal: AbortSignal,
  ) => Promise<unknown>;
};
export type PostSaveSnapshot = {
  savedId: number | null;
  original?: Payload;
  phase: "idle" | "upload" | "create" | "update" | "complete";
  creationIntent?: { key: string; payloadJson: string };
  uploaded: [PostAttachment, UploadedAttachment][];
};
export class PostSaveError extends Error {
  public data?: { httpStatus: number };
  constructor(
    message: string,
    public uncertain: boolean,
    error?: unknown,
  ) {
    super(message);
    const status = getHttpStatus(error);
    if (status) this.data = { httpStatus: status };
  }
}

/** Upload without binding files, then commit the whole post once. Never replay an unknown write. */
export class PostSaveCoordinator {
  private savedId: number | null;
  private uploaded = new Map<PostAttachment, UploadedAttachment>();
  private uncertain = false;
  private completed = false;
  private postWritePending = false;
  private creationIntent?: { key: string; payloadJson: string };
  private original?: Payload;
  private phase: PostSaveSnapshot["phase"] = "idle";
  private checkpoint?: (state: PostSaveSnapshot) => Promise<void>;
  constructor(editingId: number | null = null, original?: Payload) {
    this.savedId = editingId;
    this.original = original ? structuredClone(original) : undefined;
  }
  snapshot(): PostSaveSnapshot {
    return {
      savedId: this.savedId,
      original: this.original,
      phase: this.phase,
      creationIntent: this.creationIntent,
      uploaded: [...this.uploaded],
    };
  }
  restore(state: PostSaveSnapshot): void {
    this.savedId = state.savedId;
    this.original = state.original;
    this.creationIntent = state.creationIntent;
    this.uploaded = new Map(state.uploaded);
    this.phase = state.phase;
    this.completed = state.phase === "complete";
    this.uncertain = state.phase !== "idle" && !this.completed;
    this.postWritePending =
      state.phase === "create" || state.phase === "update";
  }
  setCheckpoint(checkpoint: (state: PostSaveSnapshot) => Promise<void>): void {
    this.checkpoint = checkpoint;
  }
  private async remember(phase: PostSaveSnapshot["phase"]): Promise<void> {
    this.phase = phase;
    await this.checkpoint?.(this.snapshot());
  }
  /** Explicit user action only: replay the exact durable create, never uploads or edits. */
  async recoverCreation(
    api: PostSaveApi,
    operation: ScopedOperation,
  ): Promise<number> {
    if (
      this.phase !== "create" ||
      !this.creationIntent ||
      this.savedId !== null
    )
      throw new Error(
        "Для этой операции нужна ручная проверка списка публикаций",
      );
    const payload = JSON.parse(this.creationIntent.payloadJson) as SavePayload;
    operation.assertCurrent();
    await this.remember("create");
    operation.assertCurrent();
    const id = await api.create(
      { ...payload, idempotencyKey: this.creationIntent.key },
      operation.signal,
    );
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
      throw new PostSaveError("Сервер не подтвердил номер публикации", true);
    this.savedId = id;
    this.completed = true;
    this.uncertain = false;
    this.postWritePending = false;
    await this.remember("complete");
    operation.assertCurrent();
    return id;
  }
  assertCanClose(): void {
    if (this.postWritePending)
      throw new PostSaveError(
        "Сохранение ещё выполняется или его результат не подтверждён. Проверьте публикацию в отдельной вкладке. Черновик остаётся в редакторе; закрытие сейчас может привести к повторному созданию.",
        true,
      );
  }
  async save(
    payload: Payload,
    attachments: PostAttachment[],
    removedIds: number[],
    api: PostSaveApi,
    operation: ScopedOperation,
  ): Promise<number> {
    this.assertCanSave();
    for (const attachment of attachments)
      if (attachment.file) validateFileSize(attachment.file);
    operation.assertCurrent();
    let writing = false;
    try {
      for (const attachment of attachments) {
        if (!attachment.file || this.uploaded.has(attachment)) continue;
        const base64 = await attachmentBase64(
          attachment.file,
          operation.signal,
        );
        operation.assertCurrent();
        await this.remember("upload");
        operation.assertCurrent();
        writing = true;
        const result = await api.upload(
          {
            base64,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            type: attachment.type,
          },
          operation.signal,
        );
        this.uploaded.set(attachment, {
          ...requireUploadedMedia(result),
          filename: attachment.name,
          type: attachment.type,
        });
        writing = false;
        if (!this.completed && !this.postWritePending && !this.uncertain)
          await this.remember("idle");
        operation.assertCurrent();
      }
      const uploads = attachments.flatMap((attachment) => {
        const uploaded = this.uploaded.get(attachment);
        return uploaded ? [uploaded] : [];
      });
      const savePayload: SavePayload = {
        ...payload,
        ...(uploads.length ? { attachments: uploads } : {}),
        ...(this.savedId !== null && removedIds.length
          ? { removedMediaIds: [...new Set(removedIds)] }
          : {}),
      };
      operation.assertCurrent();
      this.assertCanSave();
      if (this.savedId === null) {
        const createPayload = this.withCreationKey(savePayload);
        this.postWritePending = true;
        if (this.checkpoint) await this.remember("create");
        else this.phase = "create";
        operation.assertCurrent();
        writing = true;
        this.postWritePending = true;
        const id = await api.create(createPayload, operation.signal);
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
          throw new Error("Сервер не подтвердил номер публикации");
        this.savedId = id;
      } else {
        const changes: UpdatePayload = this.original
          ? Object.fromEntries(
              Object.entries(payload).filter(
                ([key, value]) =>
                  JSON.stringify(value) !==
                  JSON.stringify(this.original![key as keyof Payload]),
              ),
            )
          : { ...payload };
        // The backend normalizes richText against the text supplied in this request.
        if ("text" in changes || "richText" in changes) {
          changes.text = payload.text;
          changes.richText = payload.richText;
        }
        if (uploads.length) changes.attachments = uploads;
        if (removedIds.length)
          changes.removedMediaIds = [...new Set(removedIds)];
        this.postWritePending = true;
        if (this.checkpoint) await this.remember("update");
        else this.phase = "update";
        operation.assertCurrent();
        writing = true;
        this.postWritePending = true;
        this.assertUpdate(
          await api.update(this.savedId, changes, operation.signal),
        );
      }
      // A confirmed commit is terminal, even if closing/refreshing the UI is cancelled.
      // Reusing this coordinator must never insert its new attachments a second time.
      this.completed = true;
      this.postWritePending = false;
      writing = false;
      await this.remember("complete");
      operation.assertCurrent();
      return this.savedId;
    } catch (error) {
      const status = getHttpStatus(error);
      if (status && status >= 400 && status < 500)
        this.postWritePending = false;
      this.uncertain =
        this.uncertain || (writing && (!status || status >= 500));
      if (!this.completed && !this.uncertain) {
        this.postWritePending = false;
        this.phase = "idle";
        // Failure to journal must not turn an undispatched request into success.
        try {
          await this.remember("idle");
        } catch {
          /* The editor reports the storage failure. */
        }
      }
      const message = this.completed
        ? "Публикация сохранена. Обновите список перед новой правкой."
        : this.uncertain
          ? "Результат сохранения не подтверждён. Проверьте публикацию в списке перед новой попыткой."
          : error instanceof Error
            ? error.message
            : "Не удалось сохранить публикацию";
      throw new PostSaveError(message, this.uncertain, error);
    }
  }
  private assertCanSave(): void {
    if (this.completed)
      throw new PostSaveError(
        "Публикация уже сохранена. Обновите список перед новой правкой.",
        false,
      );
    if (this.uncertain)
      throw new PostSaveError(
        "Результат предыдущего сохранения не подтверждён. Проверьте публикацию в списке перед новой попыткой.",
        true,
      );
    this.assertCanClose();
  }
  private withCreationKey(payload: SavePayload): CreatePayload {
    // Only definite rejections permit another save. Changed confirmed data is a
    // new intent; an identical retry keeps the key and must not conflict on SQL.
    const payloadJson = JSON.stringify(payload);
    if (this.creationIntent?.payloadJson !== payloadJson) {
      if (typeof globalThis.crypto?.randomUUID !== "function")
        throw new Error(
          "Для безопасного сохранения откройте сайт через HTTPS в актуальном браузере.",
        );
      this.creationIntent = {
        key: globalThis.crypto.randomUUID(),
        payloadJson,
      };
    }
    return { ...payload, idempotencyKey: this.creationIntent.key };
  }
  private assertUpdate(result: unknown) {
    if (
      !result ||
      typeof result !== "object" ||
      (result as { success?: unknown }).success !== true
    )
      throw new Error("Сервер не подтвердил сохранение публикации");
  }
}
