import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  articles,
  posts,
  type Article,
  type ArticleBlock,
} from "../../../../packages/database/src/schema";
import { normalizeArticleBlocks } from "../../../../packages/shared/src/article-blocks";
import { deletePostRows, type ContentTransaction } from "./post-deletion";

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

async function findTeaser(tx: ContentTransaction, articleId: number) {
  // Article writers acquire the article PK first. source has no index: a locking
  // source scan would block unrelated posts. Legacy first-match behavior remains.
  const [teaser] = await tx
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.source, `article:${articleId}`))
    .limit(1);
  return teaser;
}

async function syncTeaser(
  tx: ContentTransaction,
  article: Pick<Article, "id" | "title" | "coverUrl" | "published">,
): Promise<void> {
  const existing = await findTeaser(tx, article.id);
  if (!article.published) {
    if (existing) await deletePostRows(tx, existing.id);
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
  if (existing) {
    await tx.update(posts).set(payload).where(eq(posts.id, existing.id));
  } else {
    await tx.insert(posts).values(payload);
  }
}

/** Article and teaser become visible together, only after the transaction commits. */
export async function createArticle(
  database: MySql2Database,
  data: CreateArticleInput,
): Promise<number> {
  return database.transaction(async (tx) => {
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
    // The insert owns this newly allocated article row until commit.
    await syncTeaser(tx, { ...values, id });
    return id;
  });
}

export async function updateArticle(
  database: MySql2Database,
  id: number,
  data: UpdateArticleInput,
): Promise<void> {
  await database.transaction(async (tx) => {
    // A current read before any snapshot/teaser read serializes article writers.
    const [existing] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .for("update");
    if (!existing)
      throw new TRPCError({ code: "NOT_FOUND", message: "Статья не найдена" });
    const patch = { ...data };
    if (data.sections) patch.sections = sectionsForStorage(data.sections);
    // Preserve the existing empty-patch error for an existing article.
    await tx.update(articles).set(patch).where(eq(articles.id, id));
    const [article] = await tx
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    if (article) await syncTeaser(tx, article);
  });
}

export async function deleteArticle(
  database: MySql2Database,
  id: number,
): Promise<void> {
  await database.transaction(async (tx) => {
    await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .for("update");
    const teaser = await findTeaser(tx, id);
    // Missing articles still clean their legacy orphan teaser, as before.
    if (teaser) await deletePostRows(tx, teaser.id);
    await tx.delete(articles).where(eq(articles.id, id));
  });
}
