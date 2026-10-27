import { asc, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  articles,
  type Article,
} from "../../../../packages/database/src/schema";
import { normalizeArticleBlocks } from "../../../../packages/shared/src/article-blocks";
import { requireContentDatabase } from "./read-database";
import { boundedLegacyList, LEGACY_LIST_CAP } from "./legacy-list-limit";

// Connection ownership stays in db.ts; public visibility/body policy stays in
// ContentReadService. Internal detail and admin lists must retain hidden rows.
type Database = MySql2Database | null;
export async function listPublishedArticleCards(db: Database) {
  requireContentDatabase(db);
  return db.select({ id: articles.id, title: articles.title, coverUrl: articles.coverUrl, access: articles.access })
    .from(articles).where(eq(articles.published, true))
    .orderBy(asc(articles.sortOrder), desc(articles.createdAt));
}

export async function listPublishedArticles(db: Database): Promise<Article[]> {
  requireContentDatabase(db);
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
    .orderBy(asc(articles.sortOrder), desc(articles.createdAt)).limit(LEGACY_LIST_CAP + 1);
  return boundedLegacyList(rows).map((row) => ({
    ...row,
    sections: normalizeArticleBlocks(row.sections),
  }));
}

export async function getArticleById(
  db: Database,
  id: number,
): Promise<Article | undefined> {
  requireContentDatabase(db);
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row, sections: normalizeArticleBlocks(row.sections) };
}
