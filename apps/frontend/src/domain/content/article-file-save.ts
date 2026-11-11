/** Подготовленные закрытые файлы статьи загружаем и фиксируем поэтапно до записи итоговых блоков. */
import type {
  ArticleCreationJournal,
  ArticleCreationRecord,
} from "./article-creation-journal";
import { resolveArticleFiles } from "./private-article-files";
import {
  uploadPrivateContentFile,
  type PrivateContentApi,
} from "@/shared/media/private-content-upload";
import type { ScopedOperation } from "@/shared/browser/operation-scope";

/** Recover file receipts only. Creating/updating the article still requires an explicit save. */
export async function recoverArticleFileUploads(
  record: ArticleCreationRecord,
  journal: ArticleCreationJournal,
  api: PrivateContentApi,
  task: ScopedOperation,
  commit: (record: ArticleCreationRecord) => void,
) {
  let current = record;
  if (!current.media || current.media.phase !== "upload") return current;
  for (const file of current.media.files) {
    await journal.requireCurrent(current);
    task.assertCurrent();
    await uploadPrivateContentFile(file, file.usage, api, task, async () => {
      current = await journal.checkpoint(current, current.payload, "upload");
      task.assertCurrent();
      commit(current);
    });
  }
  return current;
}
/** Freeze resolved application URLs durably BEFORE a potentially ambiguous article write. */
export async function sealArticleFileWrite(
  record: ArticleCreationRecord,
  journal: ArticleCreationJournal,
  task: ScopedOperation,
) {
  if (!record.media || record.media.phase !== "upload")
    throw new Error("Операция статьи уже отправлена");
  const next = await journal.checkpoint(
    record,
    {
      ...record.payload,
      sections: resolveArticleFiles(
        record.payload.sections,
        record.media.files,
      ),
    },
    "write",
  );
  task.assertCurrent();
  return next;
}
