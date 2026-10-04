import { serializePostDraft } from "./draft";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { getHttpStatus } from "@/shared/api/errors";
import { attachmentBase64 } from "@/shared/media/read-attachment";
import { validateFileSize } from "@/shared/browser/file-operations";
import { requireUploadedUrl } from "@/shared/media/upload-result";

type Payload = ReturnType<typeof serializePostDraft>;
export type PostAttachment = {
  type: "audio" | "document";
  name: string;
  mimeType: string;
  file?: File;
  id?: number;
  url?: string;
};
export type PostSaveApi = {
  create: (payload: Payload, signal: AbortSignal) => Promise<unknown>;
  update: (
    id: number,
    payload: Payload,
    signal: AbortSignal,
  ) => Promise<unknown>;
  upload: (
    input: {
      postId: number;
      base64: string;
      filename: string;
      mimeType: string;
      type: "audio" | "document";
    },
    signal: AbortSignal,
  ) => Promise<unknown>;
  remove: (id: number, signal: AbortSignal) => Promise<unknown>;
};
export class PostSaveError extends Error {
  public data?: { httpStatus: number };
  constructor(
    message: string,
    public draftId: number | null,
    public uncertain: boolean,
    error?: unknown,
  ) {
    super(message);
    const status = getHttpStatus(error);
    if (status) this.data = { httpStatus: status };
  }
}

/** Retain confirmed progress across explicit retries; never replay an unconfirmed server write. */
export class PostSaveCoordinator {
  private savedId: number | null;
  private uploaded = new Map<PostAttachment, number>();
  private removed = new Set<number>();
  private uncertain = false;
  constructor(editingId: number | null = null) {
    this.savedId = editingId;
  }
  getUploadedId(attachment: PostAttachment) {
    return this.uploaded.get(attachment);
  }
  async save(
    payload: Payload,
    attachments: PostAttachment[],
    removedIds: number[],
    api: PostSaveApi,
    operation: ScopedOperation,
  ): Promise<number> {
    if (this.uncertain)
      throw new PostSaveError(
        "Результат предыдущего сохранения не подтверждён. Проверьте публикацию в списке перед новой попыткой.",
        this.savedId,
        true,
      );
    for (const attachment of attachments)
      if (attachment.file) validateFileSize(attachment.file);
    operation.assertCurrent();
    const needsMediaWork =
      attachments.some((a) => a.file && !this.uploaded.has(a)) ||
      removedIds.some((id) => !this.removed.has(id));
    // The existing API has no atomic publish-with-media operation. Keep intermediate work in a draft.
    const staged = needsMediaWork
      ? {
          ...payload,
          status: "draft" as const,
          published: false,
          scheduledAt: null,
        }
      : payload;
    let writing = false;
    try {
      writing = true;
      if (this.savedId === null) {
        const id = await api.create(staged, operation.signal);
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
          throw new Error("Сервер не подтвердил номер публикации");
        this.savedId = id;
      } else {
        const result = await api.update(this.savedId, staged, operation.signal);
        this.assertUpdate(result);
      }
      writing = false;
      operation.assertCurrent();
      for (const attachment of attachments) {
        if (!attachment.file || this.uploaded.has(attachment)) continue;
        const base64 = await attachmentBase64(
          attachment.file,
          operation.signal,
        );
        operation.assertCurrent();
        writing = true;
        const result = await api.upload(
          {
            postId: this.savedId,
            base64,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            type: attachment.type,
          },
          operation.signal,
        );
        requireUploadedUrl(result);
        const id = (result as { mediaId?: unknown }).mediaId;
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
          throw new Error("Сервер не подтвердил вложение");
        this.uploaded.set(attachment, id);
        writing = false;
        operation.assertCurrent();
      }
      for (const id of removedIds) {
        if (this.removed.has(id)) continue;
        operation.assertCurrent();
        writing = true;
        await api.remove(id, operation.signal);
        this.removed.add(id);
        writing = false;
        operation.assertCurrent();
      }
      if (needsMediaWork && payload.status !== "draft") {
        writing = true;
        this.assertUpdate(
          await api.update(this.savedId, payload, operation.signal),
        );
        writing = false;
        operation.assertCurrent();
      }
      return this.savedId;
    } catch (error) {
      const status = getHttpStatus(error);
      // A network failure, 5xx or malformed success can follow a committed write.
      this.uncertain = writing && (!status || status >= 500);
      const message = this.uncertain
        ? "Результат сохранения не подтверждён. Проверьте публикацию в списке перед новой попыткой."
        : error instanceof Error
          ? error.message
          : "Не удалось сохранить публикацию";
      throw new PostSaveError(
        message,
        needsMediaWork ? this.savedId : null,
        this.uncertain,
        error,
      );
    }
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
