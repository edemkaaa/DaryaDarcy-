import { asc, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  articles,
  type Article,
} from "../../../../packages/database/src/schema";
import { normalizeArticleBlocks } from "../../../../packages/shared/src/article-blocks";

// Connection ownership stays in db.ts; public visibility/body policy stays in
// ContentReadService. Internal detail and admin lists must retain hidden rows.
type Database = MySql2Database | null;

export async function listPublishedArticles(db: Database): Promise<Article[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.published, true))
    .orderBy(asc(articles.sortOrder), desc(articles.createdAt));
  return rows.map((row) => ({
    ...row,
    sections: normalizeArticleBlocks(row.sections),
  }));
}

export async function listAllArticles(db: Database): Promise<Article[]> {
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(articles)
    .orderBy(asc(articles.sortOrder), desc(articles.createdAt));
  return rows.map((row) => ({
    ...row,
    sections: normalizeArticleBlocks(row.sections),
  }));
}

export async function getArticleById(
  db: Database,
  id: number,
): Promise<Article | undefined> {
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row, sections: normalizeArticleBlocks(row.sections) };
}
