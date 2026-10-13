import { createHash } from "node:crypto";
import { z } from "zod";
import type { CreateArticleInput } from "./article-writes";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import {
  articleCreationRequests,
  articles,
} from "../../../../packages/database/src/schema";

export const articleCreationKey = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export function articleRequestKey(actorUserId: number, key: string) {
  return hash(JSON.stringify(["admin.createArticle:v1", actorUserId, key]));
}

export function articleCreationIntent(
  actorUserId: number,
  key: string,
  data: CreateArticleInput,
) {
  const canonical = JSON.stringify(
    {
      ...data,
      coverUrl: data.coverUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
    (_name, value) => {
      if (value && typeof value === "object" && !Array.isArray(value))
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((name) => [name, value[name]]),
        );
      return value;
    },
  );
  return {
    requestKey: articleRequestKey(actorUserId, key),
    actorUserId,
    payloadHash: hash(canonical),
  };
}

export type ArticleCreationIntent = ReturnType<typeof articleCreationIntent>;

/** Inside the transaction: the table metadata lock lasts until commit. No DDL. */
export async function requireArticleCreationSchema(
  reader: Pick<MySql2Database, "select" | "execute">,
) {
  await reader.select().from(articleCreationRequests).limit(0);
  const [indexes] = await reader.execute(sql`
    SELECT s.COLUMN_NAME AS columnName, s.SEQ_IN_INDEX AS position, t.ENGINE AS engine
    FROM information_schema.STATISTICS s JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='article_creation_requests'
      AND s.INDEX_NAME='PRIMARY' AND s.NON_UNIQUE=0`);
  const rows: unknown = indexes;
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows[0].columnName !== "requestKey" ||
    rows[0].position !== 1 ||
    rows[0].engine !== "InnoDB"
  )
    throw new Error("Article creation schema unavailable");
}

export type ArticleCreationStatus =
  | { status: "notRecorded" }
  | { status: "created" | "deleted"; articleId: number };

export async function articleCreationStatus(
  database: MySql2Database,
  actorUserId: number,
  key: string,
): Promise<ArticleCreationStatus> {
  return database.transaction(async (tx) => {
    await requireArticleCreationSchema(tx);
    const [request] = await tx
      .select({
        actorUserId: articleCreationRequests.actorUserId,
        articleId: articleCreationRequests.articleId,
        currentId: articles.id,
      })
      .from(articleCreationRequests)
      .leftJoin(articles, eq(articles.id, articleCreationRequests.articleId))
      .where(
        eq(
          articleCreationRequests.requestKey,
          articleRequestKey(actorUserId, key),
        ),
      );
    if (!request) return { status: "notRecorded" };
    if (
      request.actorUserId !== actorUserId ||
      !Number.isSafeInteger(request.articleId) ||
      !request.articleId ||
      request.articleId <= 0
    )
      throw new Error("Invalid article creation result");
    return {
      status: request.currentId === null ? "deleted" : "created",
      articleId: request.articleId,
    };
  });
}
