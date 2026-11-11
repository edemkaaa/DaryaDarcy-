/** Отмечаем отозванные квитанции и привязки закрытых файлов, сохраняя правила восстановления операций. */
import { asc, eq, sql } from "drizzle-orm";
import {
  commentCreationRequests,
  privateContentFiles,
} from "../../../../packages/database/src/schema";
import { digest } from "../media/private-upload-object";
import type { ContentTransaction } from "./post-deletion";
import { requireCommentFileSchema } from "./comment-file-creation";
import { requirePrivateContentSchema } from "./private-content-uploads";

/** Optional on pre-CF installations; partial or unsafe migrations fail the whole retirement. */
/** Допускаем отсутствие обеих таблиц только до внедрения выключенной функции; частичная схема или не-InnoDB запрещает весь отзыв. */
async function requireSchema(tx: ContentTransaction) {
  const [rows] =
    await tx.execute(sql`SELECT t.TABLE_NAME AS name,t.ENGINE AS engine,c.IS_NULLABLE AS nullable
    FROM information_schema.TABLES t LEFT JOIN information_schema.COLUMNS c
    ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME AND c.COLUMN_NAME='actorUserId'
    WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME IN ('private_content_files','comment_creation_requests')`);
  if (
    Array.isArray(rows) &&
    rows.length === 0 &&
    process.env.PRIVATE_CONTENT_FILES_ENABLED !== "true"
  )
    return false;
  if (
    !Array.isArray(rows) ||
    rows.length !== 2 ||
    rows.some((row) => row.engine !== "InnoDB" || row.nullable !== "YES")
  ) {
    throw new Error("Private content retirement schema unavailable");
  }
  await requirePrivateContentSchema(tx);
  await requireCommentFileSchema(tx);
  return true;
}

/** Called under the retiring user's PK lock, regardless of the upload feature flag. No storage effects. */
/** Под блокировкой удаляемого пользователя удаляем его ключи создания комментариев и обезличиваем квитанции пачками; непривязанные файлы отзываем, доказательство доступа у сохранившегося материала оставляем. */
export async function retirePrivateContent(
  tx: ContentTransaction,
  actorUserId: number,
) {
  if (!(await requireSchema(tx))) return;
  await tx
    .delete(commentCreationRequests)
    .where(eq(commentCreationRequests.actorUserId, actorUserId));
  while (true) {
    const receipts = await tx
      .select()
      .from(privateContentFiles)
      .where(eq(privateContentFiles.actorUserId, actorUserId))
      .orderBy(asc(privateContentFiles.requestKey))
      .limit(100)
      .for("update");
    if (!receipts.length) return;
    for (const row of receipts) {
      await tx
        .update(privateContentFiles)
        .set({
          requestKey: digest(
            JSON.stringify(["retired-private-content:v1", row.assetId]),
          ),
          actorUserId: null,
          filename: "",
          // Bound receipts still prove file integrity/access for the surviving parent.
          retiredAt:
            row.retiredAt ?? (row.parentId === null ? new Date() : null),
        })
        .where(eq(privateContentFiles.requestKey, row.requestKey));
    }
  }
}
