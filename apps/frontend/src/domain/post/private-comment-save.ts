/** Отправка комментария объединяет текст и фото под одним намерением; сохранённый ключ позволяет восстановить ответ без второго комментария. */
import type { ApiInputs } from "@/shared/api/types";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import {
  uploadPrivateContentFile,
  validatePrivateContentFile,
  requirePrivateContentReceipt,
  type PrivateContentFile,
} from "@/shared/media/private-content-upload";
import { COMMENT_CHAR_LIMIT } from "./comment-count-label";

export type PrivateCommentPhoto = PrivateContentFile<"commentPhoto">;
type CommentDraft = Pick<
  ApiInputs["club"]["addComment"],
  "postId" | "text" | "parentId"
>;
export type PrivateCommentRecord = {
  version: 1;
  ownerId: number;
  postId: number;
  text: string;
  parentId?: number;
  key: string;
  files: PrivateCommentPhoto[];
  phase: "upload" | "write";
  payloadJson?: string;
  savedId: number | null;
};
export type PrivateCommentApi = {
  upload: (
    input: ApiInputs["club"]["uploadPrivateCommentPhoto"],
    signal: AbortSignal,
  ) => Promise<unknown>;
  status: (
    input: ApiInputs["club"]["privateCommentPhotoStatus"],
    signal: AbortSignal,
  ) => Promise<unknown>;
  add: (
    input: ApiInputs["club"]["addComment"],
    signal: AbortSignal,
  ) => Promise<unknown>;
};
/** Проверяем безопасный положительный ID для владельца, поста, родителя и ACK. */
const positive = (id: unknown): id is number =>
  Number.isSafeInteger(id) && (id as number) > 0;
/** Повреждение сохранённого intent не разрешает создать новый ключ и потенциальный дубль комментария. */
const error = () =>
  new Error(
    "Не удалось проверить сохранённую отправку комментария. Новая операция не создаётся.",
  );
/** Формируем неизменный write-payload из готовых фото и того же idempotency key. */
const payload = (record: PrivateCommentRecord) => ({
  postId: record.postId,
  text: record.text,
  ...(record.parentId !== undefined ? { parentId: record.parentId } : {}),
  photos: record.files.map(
    (file) =>
      requirePrivateContentReceipt(file.receipt, file.file, "commentPhoto")
        .url!,
  ),
  idempotencyKey: record.key,
});
/** Проверяем строгую структуру журнала, владельца и фазы; после write текст, родитель, файлы и сериализованный payload не могут расходиться. */
export function requirePrivateCommentRecord(
  value: unknown,
): PrivateCommentRecord {
  const record = value as PrivateCommentRecord | null;
  if (
    !record ||
    typeof record !== "object" ||
    Object.keys(record).some(
      (key) =>
        ![
          "version",
          "ownerId",
          "postId",
          "text",
          "parentId",
          "key",
          "files",
          "phase",
          "payloadJson",
          "savedId",
        ].includes(key),
    ) ||
    record.version !== 1 ||
    !positive(record.ownerId) ||
    !positive(record.postId) ||
    (record.parentId !== undefined && !positive(record.parentId)) ||
    typeof record.text !== "string" ||
    !record.text.trim() ||
    record.text !== record.text.trim() ||
    record.text.length > COMMENT_CHAR_LIMIT ||
    typeof record.key !== "string" ||
    !/^[A-Za-z0-9._:-]{16,128}$/.test(record.key) ||
    !["upload", "write"].includes(record.phase) ||
    !Array.isArray(record.files) ||
    record.files.length > 2 ||
    (record.savedId !== null && !positive(record.savedId))
  )
    throw error();
  const keys = new Set<string>(),
    assets = new Set<string>();
  for (const file of record.files) {
    if (
      !file ||
      Object.keys(file).some(
        (key) => !["key", "file", "attempted", "receipt"].includes(key),
      ) ||
      keys.has(file.key) ||
      (file.attempted !== undefined && typeof file.attempted !== "boolean")
    )
      throw error();
    validatePrivateContentFile(file, "commentPhoto");
    keys.add(file.key);
    if (file.receipt) {
      const receipt = requirePrivateContentReceipt(
        file.receipt,
        file.file,
        "commentPhoto",
      );
      if (!file.attempted || assets.has(receipt.assetId)) throw error();
      assets.add(receipt.assetId);
    }
    if (record.phase === "write" && file.receipt?.state !== "ready")
      throw error();
  }
  if (
    record.phase === "upload"
      ? record.payloadJson !== undefined || record.savedId !== null
      : record.payloadJson !== JSON.stringify(payload(record))
  )
    throw error();
  return record;
}
/** Создаём intent комментария с фото; пустой набор здесь не переводится молча в другой сценарий. */
export function preparePrivateComment(
  ownerId: number,
  input: CommentDraft,
  files: PrivateCommentPhoto[],
): PrivateCommentRecord {
  if (!files.length) throw error();
  return prepareComment(ownerId, input, files);
}
/** Создаём тот же восстанавливаемый протокол для текстового комментария без файлов. */
export function prepareTextComment(
  ownerId: number,
  input: CommentDraft,
): PrivateCommentRecord {
  return prepareComment(ownerId, input, []);
}
/** Фиксируем новый ключ и нормализованный текст до сети, копируя метаданные выбранных файлов в отдельный intent. */
function prepareComment(
  ownerId: number,
  input: CommentDraft,
  files: PrivateCommentPhoto[],
): PrivateCommentRecord {
  if (typeof globalThis.crypto?.randomUUID !== "function") throw error();
  return requirePrivateCommentRecord({
    version: 1,
    ownerId,
    postId: input.postId,
    text: input.text.trim(),
    ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    key: crypto.randomUUID(),
    files: files.map((file) => ({ ...file })),
    phase: "upload",
    savedId: null,
  });
}
/** Caller checkpoints real File bytes durably. No automatic retries or public upload fallback. */
// Фото и комментарий восстанавливаются под своим исходным намерением; промежуточное подтверждение сохраняется до следующего шага.
/** Сначала durable-checkpoint, затем загрузки и замороженный write; подтверждённый savedId сохраняется до возврата вызывающему коду. */
export async function savePrivateComment(
  record: PrivateCommentRecord,
  api: PrivateCommentApi,
  task: ScopedOperation,
  checkpoint: (record: PrivateCommentRecord) => Promise<void>,
): Promise<number> {
  task.assertCurrent();
  requirePrivateCommentRecord(record);
  if (record.savedId !== null) return record.savedId;
  /** Проверяем актуальность задачи до и после checkpoint, чтобы смена аккаунта не продолжила отправку. */
  const persist = async () => {
    task.assertCurrent();
    await checkpoint(record);
    task.assertCurrent();
  };
  // Also retried after a failed local checkpoint, BEFORE any external call.
  await persist();
  if (record.phase === "upload") {
    const postId = record.postId;
    for (const file of record.files)
      await uploadPrivateContentFile(
        file,
        "commentPhoto",
        {
          upload: (input, signal) => api.upload({ ...input, postId }, signal),
          status: api.status,
        },
        task,
        persist,
      );
    record.payloadJson = JSON.stringify(payload(record));
    record.phase = "write";
  }
  requirePrivateCommentRecord(record);
  await persist();
  const input = JSON.parse(
    record.payloadJson!,
  ) as ApiInputs["club"]["addComment"];
  const result = await api.add(input, task.signal);
  task.assertCurrent();
  const id = (result as { id?: unknown } | null)?.id;
  if (!positive(id))
    throw new Error("Сервер не подтвердил отправку комментария");
  record.savedId = id;
  await persist();
  return id;
}
