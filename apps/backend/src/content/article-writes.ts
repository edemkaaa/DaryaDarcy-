/** Транзакционная запись статей, вложений и связанных публикаций с проверкой редакторской ревизии. */
import { TRPCError } from "@trpc/server";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  articles,
  articleCreationRequests,
  posts,
  type Article,
  type ArticleBlock,
} from "../../../../packages/database/src/schema";
import { normalizeArticleBlocks } from "../../../../packages/shared/src/article-blocks";
import { deletePostRows, type ContentTransaction } from "./post-deletion";
import type { ArticleCreationIntent } from "./article-creation-request";
import { requireArticleCreationSchema } from "./article-creation-request";
import { assertContentRecoveryWindow } from "./recovery-window";
import { assertContentRecoveryNotSpent } from "./recovery-markers";
import { assertContentWriteActor, type ContentWriteActor } from "./content-write-actor";
import { articleFileReferences, assertPublicContentCover, bindContentFiles, hasPrivateContent } from "./private-content-binding";
import { articleEditRevision, assertEditRevision, expectedEditRevision, type ContentEditPrecondition } from "./content-edit-revision";

export type CreateArticleInput = {
  title: string;
  coverUrl?: string | null;
  access: "public" | "club";
  published: boolean;
  sortOrder?: number;
  sections: ArticleBlock[];
};
export type UpdateArticleInput = Partial<CreateArticleInput>;

function sectionsForStorage(value: unknown): ArticleBlock[] {
  return normalizeArticleBlocks(value).filter((block) => {
    if (block.type === "photo" || block.type === "png")
      return Boolean(block.url);
    if (block.type === "link") return Boolean(block.url);
    if (block.type === "carousel") return Boolean(block.urls?.length);
    return Boolean(block.text?.trim());
  });
}

async function findTeasers(tx: ContentTransaction, articleId: number) {
  // Article writers acquire the article PK first. source has no index: a locking
  // source scan would block unrelated posts. Read IDs, then write by primary key.
  return tx
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.source, `article:${articleId}`))
    .orderBy(asc(posts.id));
}

async function syncTeaser(
  tx: ContentTransaction,
  article: Pick<Article, "id" | "title" | "coverUrl" | "published">,
): Promise<void> {
  const existing = await findTeasers(tx, article.id);
  if (!article.published) {
    for (const teaser of existing) await deletePostRows(tx, teaser.id);
    return;
  }
  const payload = {
    text: article.title,
    photos: article.coverUrl ? [article.coverUrl] : [],
    tags: ["exclusive"],
    source: `article:${article.id}`,
    target: "club" as const,
    published: true,
    status: "published" as const,
  };
  if (existing.length) {
    // Keep discussion on historical duplicates; synchronizing an article must
    // not silently erase their comments. New manual duplicates are rejected.
    await tx.update(posts).set(payload).where(inArray(posts.id, existing.map(row => row.id)));
  } else {
    await tx.insert(posts).values(payload);
  }
}

/** Article and teaser become visible together, only after the transaction commits. */
export async function createArticle(
  database: MySql2Database,
  data: CreateArticleInput,
  intent?: ArticleCreationIntent,
  actor?: ContentWriteActor,
): Promise<number> {
  assertPublicContentCover(data.coverUrl);
  if (!intent && hasPrivateContent(articleFileReferences(data.sections))) throw new TRPCError({ code: "BAD_REQUEST", message: "Для закрытых файлов нужен ключ создания статьи" });
  // A different nonce on a pre-existing incomplete row prevents unsafe takeover.
  const claimToken = randomUUID();
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,actor);
    if (intent) {
      await requireArticleCreationSchema(tx);
      await tx
        .insert(articleCreationRequests)
        .values({ ...intent, claimToken })
        .onDuplicateKeyUpdate({
          set: { requestKey: sql`${articleCreationRequests.requestKey}` },
        });
      const [request] = await tx
        .select()
        .from(articleCreationRequests)
        .where(eq(articleCreationRequests.requestKey, intent.requestKey))
        .for("update");
      if (!request) throw new Error("Article creation record unavailable");
      await assertContentRecoveryNotSpent(
        tx,
        "article",
        [intent.requestKey],
        intent.actorUserId,
      );
      if (
        request.actorUserId !== intent.actorUserId ||
        request.payloadHash !== intent.payloadHash
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ключ запроса уже использован для другого содержимого",
        });
      assertContentRecoveryWindow(request.createdAt);
      if (request.articleId !== null) {
        if (!Number.isSafeInteger(request.articleId) || request.articleId <= 0)
          throw new Error("Invalid article creation result");
        return request.articleId;
      }
      if (request.claimToken !== claimToken)
        throw new Error("Incomplete article creation record");
    }
    const values = {
      title: data.title,
      coverUrl: data.coverUrl ?? null,
      access: data.access,
      published: data.published,
      sortOrder: data.sortOrder ?? 0,
      sections: sectionsForStorage(data.sections),
    };
    const [result] = await tx.insert(articles).values(values);
    const id = Number(result.insertId);
    await bindContentFiles(tx, "article", id, articleFileReferences(values.sections), [], actor);
    // The insert owns this newly allocated article row until commit.
    await syncTeaser(tx, { ...values, id });
    if (intent)
      await tx
        .update(articleCreationRequests)
        .set({ articleId: id })
        .where(eq(articleCreationRequests.requestKey, intent.requestKey));
    return id;
  });
}

/** Проверяем ожидаемую версию и сохраняем изменение статьи вместе с её зависимостями. */
export async function updateArticle(
  database: MySql2Database,
  id: number,
  data: UpdateArticleInput,
  actor?: ContentWriteActor,
  condition?: ContentEditPrecondition,
): Promise<void> {
  assertPublicContentCover(data.coverUrl);
  await database.transaction(async (tx) => {
    await assertContentWriteActor(tx,actor);
    const expectedRevision = expectedEditRevision(condition);
    // A current read before any snapshot/teaser read serializes article writers.
    const [existing] = await tx
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .for("update");
    if (!existing)
      throw new TRPCError({ code: "NOT_FOUND", message: "Статья не найдена" });
    if (expectedRevision !== undefined)
      assertEditRevision(expectedRevision, articleEditRevision(existing));
    const patch = { ...data };
    if (data.sections) patch.sections = sectionsForStorage(data.sections);
    // Preserve the existing empty-patch error for an existing article.
    await tx.update(articles).set(patch).where(eq(articles.id, id));
    if (patch.sections !== undefined) await bindContentFiles(tx, "article", id, articleFileReferences(patch.sections), articleFileReferences(existing.sections), actor);
    const [article] = await tx
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    if (article) await syncTeaser(tx, article);
  });
}

/** Удаляем статью через её текущие связи; доступ проверяется на административной границе. */
export async function deleteArticle(
  database: MySql2Database,
  id: number,
  actor?: ContentWriteActor,
): Promise<void> {
  await database.transaction(async (tx) => {
    await assertContentWriteActor(tx,actor);
    await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .for("update");
    const teasers = await findTeasers(tx, id);
    // Missing articles still clean their legacy orphan teaser, as before.
    for (const teaser of teasers) await deletePostRows(tx, teaser.id);
    await tx.delete(articles).where(eq(articles.id, id));
  });
}
