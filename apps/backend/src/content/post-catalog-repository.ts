/** Списки публикаций читаются вместе с медиа в согласованном снимке; старый числовой cursor остаётся offset. */
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { requireContentDatabase } from "./read-database";
import {
  posts,
  tags,
  type Post,
  type PostMedia,
  type Tag,
} from "../../../../packages/database/src/schema";
import { attachPostMedia } from "./post-media-repository";
import { clubPostListOrder, postListOrder } from "./post-order";
import { clubCategoryCondition, clubBoardTagCondition } from "./club-category-filter";
import type { ClubTabId } from "../../../../packages/shared/src/club-tags";
import { boundedLegacyList, LEGACY_LIST_CAP } from "./legacy-list-limit";

// db.ts owns the connection; services and adapters retain access decisions.
type Database = MySql2Database | null;

// The full reference catalog includes tags not yet used by published posts.
/** Справочник включает и ещё неиспользованные теги; это не выборка только по опубликованным постам. */
export async function getAllTags(db: Database): Promise<Tag[]> {
  requireContentDatabase(db);

  try {
    return await db.select().from(tags).orderBy(asc(tags.sortOrder));
  } catch (error) {
    console.error("[Feed] getAllTags failed");
    throw error;
  }
}

// Legacy list keeps its own fields; filter before the bounded SQL read.
/** Совместимое чтение списка сохраняет существующие фильтры и ограничение размера. */
export async function getPosts(
  db: Database,
  tagFilter?: string,
): Promise<(Post & { likeCount: number; media: PostMedia[] })[]> {
  if (!db) throw new Error("Database not available");

  // Карточка и вложения принадлежат одному снимку: параллельная правка
  // не должна подмешать закрытые файлы к ещё открытой версии поста.
  return db.transaction(async (tx) => {
    let query = tx
      .select({
        id: posts.id,
        publicId: posts.publicId,
        text: posts.text,
        photos: posts.photos,
        tags: posts.tags,
        source: posts.source,
        instagramId: posts.instagramId,
        sortOrder: posts.sortOrder,
        published: posts.published,
        status: posts.status,
        target: posts.target,
        scheduledAt: posts.scheduledAt,
        publishedAt: posts.publishedAt,
        richText: posts.richText,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        likeCount:
          sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
            "likeCount",
          ),
      })
      .from(posts)
      .where(
        and(
          ...feedFilterConditions({ tagFilter }),
        ),
      )
      .orderBy(...postListOrder).limit(LEGACY_LIST_CAP + 1);

    return attachPostMedia(tx, boundedLegacyList(await query));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

const postListColumns = {
  id: posts.id,
  publicId: posts.publicId,
  text: posts.text,
  photos: posts.photos,
  tags: posts.tags,
  source: posts.source,
  instagramId: posts.instagramId,
  sortOrder: posts.sortOrder,
  published: posts.published,
  status: posts.status,
  target: posts.target,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  richText: posts.richText,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  likeCount:
    sql<number>`(SELECT COUNT(*) FROM likes WHERE likes.postId = posts.id)`.as(
      "likeCount",
    ),
  commentCount:
    sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_comments.postId = posts.id)`.as(
      "commentCount",
    ),
};

/** Собираем обязательные признаки опубликованной Ленты, затем точный JSON-тег и поиск по нормализованному тексту; SQL-параметры отделены от запроса. */
function feedFilterConditions(options: {
  tagFilter?: string;
  search?: string;
}) {
  const conditions = [
    eq(posts.published, true),
    eq(posts.status, "published"),
    or(eq(posts.target, "feed"), eq(posts.target, "both")),
  ];
  if (options.tagFilter && options.tagFilter !== "all") {
    conditions.push(
      sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`,
    );
  }
  if (options.search && options.search.trim().length > 0) {
    const query = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(sql`LOWER(${posts.text}) LIKE ${query}`);
  }
  return conditions;
}

/** Старый числовой курсор остаётся offset; единый снимок защищает ответ, но не всю цепочку страниц. */
export async function getPostsPaginated(
  db: Database,
  options: {
    tagFilter?: string;
    search?: string;
    limit: number;
    cursor?: number; // offset (page number * limit)
  },
) {
  if (!db) throw new Error("Database not available");

  // Карточка и вложения принадлежат одному снимку: параллельная правка
  // не должна подмешать закрытые файлы к ещё открытой версии поста.
  return db.transaction(async (tx) => {
    const offset = options.cursor ?? 0;
    const rows = await tx
      .select(postListColumns)
      // MySQL может выбрать этот индекс для фильтра и всё равно сортировать
      // весь результат. Читаем по индексу в порядке страницы и останавливаемся на LIMIT.
      .from(posts, { forceIndex: "posts_feed_listing_idx" })
      .where(and(...feedFilterConditions(options)))
      .orderBy(...postListOrder)
      .limit(options.limit + 1)
      .offset(offset);

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      posts: await attachPostMedia(tx, page),
      nextCursor: hasMore ? offset + options.limit : null,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Восстанавливаем ограниченный набор карточек по известным ID через общий путь чтения медиа. */
/** Возвращаем опубликованные карточки в порядке запрошенных ID вместе с медиа из одного снимка; клубную видимость дополнительно ограничивает вызывающий сервис. */
export async function getPostsByIds(
  db: Database,
  ids: number[],
) {
  if (ids.length === 0) return [];
  if (!db) throw new Error("Database not available");

  // Карточка и вложения принадлежат одному снимку: параллельная правка
  // не должна подмешать закрытые файлы к ещё открытой версии поста.
  return db.transaction(async (tx) => {
    const rows = await tx
      .select(postListColumns)
      .from(posts)
      .where(
        and(
          inArray(posts.id, ids),
          eq(posts.published, true),
          eq(posts.status, "published"),
        ),
      );
    const withMedia = await attachPostMedia(tx, rows);
    const byId = new Map(withMedia.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

/** Фильтруем назначение Лента/Клуб до пагинации и гидратации вложений. */
/** Применяем назначение, рубрику и теги до чтения страницы; Лента и Клуб сохраняют разные правила сортировки, числовой cursor остаётся offset между отдельными снимками. */
export async function getPostsForTarget(
  db: Database,
  target: "feed" | "club",
  options?: {
    tagFilter?: string;
    search?: string;
    limit?: number;
    cursor?: number;
    category?: ClubTabId;
    clubTag?: string;
  },
) {
  if (!db) throw new Error("Database not available");

  // Карточка и вложения принадлежат одному снимку: параллельная правка
  // не должна подмешать закрытые файлы к ещё открытой версии поста.
  return db.transaction(async (tx) => {
    const offset = options?.cursor ?? 0;
    const limit = options?.limit ?? 20;
    const conditions = [
      eq(posts.published, true),
      eq(posts.status, "published"),
      or(eq(posts.target, target), eq(posts.target, "both")),
    ];
    if (options?.category) conditions.push(clubCategoryCondition(options.category));
    if (options?.clubTag) conditions.push(clubBoardTagCondition(options.clubTag));
    if (options?.tagFilter && options.tagFilter !== "all") {
      conditions.push(
        sql`JSON_CONTAINS(${posts.tags}, JSON_QUOTE(${options.tagFilter}))`,
      );
    }
    if (options?.search && options.search.trim().length > 0) {
      const query = `%${options.search.trim().toLowerCase()}%`;
      conditions.push(sql`LOWER(${posts.text}) LIKE ${query}`);
    }

    const rows = await tx
      .select(postListColumns)
      .from(posts)
      .where(and(...conditions))
      .orderBy(...(target === "club" ? clubPostListOrder : postListOrder))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      posts: await attachPostMedia(tx, page),
      nextCursor: hasMore ? offset + limit : null,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
