/** Отдельные чтения админки: список, детали, календарь и счётчики не требуют выгрузки всех постов. */
import { and, asc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import {
  posts,
  postMedia,
  type Post,
  type PostMedia,
} from "../../../../packages/database/src/schema";
import { postListOrder } from "./post-order";
import { attachPostMedia } from "./post-media-repository";
import { postEditRevision } from "./content-edit-revision";

export const adminPostsPageInput = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.number().int().min(0).max(1_000_000).nullish(),
    // tRPC infinite queries send this even for the first page; only forward is supported.
    direction: z.literal("forward").optional(),
    status: z.enum(["draft", "scheduled", "published"]).optional(),
    target: z.enum(["feed", "club", "both"]).optional(),
  })
  .strict()
  .default({ limit: 20 });

type Database = MySql2Database | null;
const strings = {
  mapFromDriverValue: (value: unknown): string[] =>
    typeof value === "string" ? JSON.parse(value) : (value as string[]),
};
// Do not transfer full bodies, photo galleries or attachments for list cards.
const card = {
  id: posts.id,
  text: sql<string>`LEFT(${posts.text},512)`.as("textPreview"),
  photos: sql<
    string[]
  >`IF(JSON_LENGTH(${posts.photos})>0,JSON_ARRAY(JSON_UNQUOTE(JSON_EXTRACT(${posts.photos},'$[0]'))),JSON_ARRAY())`
    .mapWith(strings)
    .as("cardPhotos"),
  tags: sql<
    string[]
  >`COALESCE(JSON_EXTRACT(${posts.tags},'$[0 to 2]'),JSON_ARRAY())`
    .mapWith(strings)
    .as("cardTags"),
  tagCount: sql<number>`JSON_LENGTH(${posts.tags})`
    .mapWith(Number)
    .as("tagCount"),
  hasVideo:
    sql<boolean>`EXISTS(SELECT 1 FROM ${postMedia} WHERE ${postMedia.postId}=${posts.id} AND ${postMedia.type}='video')`
      .mapWith(Boolean)
      .as("hasVideo"),
  published: posts.published,
  status: posts.status,
  target: posts.target,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  createdAt: posts.createdAt,
};

/** Читаем только страницу административного списка; календарь и счётчики запрашиваются отдельно. */
export async function getAdminPostsPage(
  db: Database,
  input: z.infer<typeof adminPostsPageInput>,
) {
  if (!db) throw new Error("Database not available");
  const offset = input.cursor ?? 0;
  const rows = await db
    .select(card)
    .from(posts)
    .where(
      and(
        input.status ? eq(posts.status, input.status) : undefined,
        input.target ? eq(posts.target, input.target) : undefined,
      ),
    )
    .orderBy(...postListOrder)
    .limit(input.limit + 1)
    .offset(offset);
  return {
    posts: rows.slice(0, input.limit),
    nextCursor: rows.length > input.limit ? offset + input.limit : null,
  };
}

/** Детали и вложения читаем согласованно, включая скрытые от общего каталога записи. */
export async function getAdminPostDetail(
  db: Database,
  id: number,
): Promise<(Post & { media: PostMedia[]; editRevision: string }) | null> {
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const rows = await tx.select().from(posts).where(eq(posts.id, id)).limit(1);
    const [post] = await attachPostMedia(tx, rows);
    return post ? { ...post, editRevision: postEditRevision(post, post.media) } : null;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export const adminPostCalendarInput = z
  .object({
    // Explicit adjacent local-day boundaries preserve browser timezone and DST.
    days: z
      .array(
        z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).strict(),
      )
      .min(1)
      .max(62)
      .superRefine((days, context) => {
        days.forEach((day, index) => {
          const duration = Date.parse(day.to) - Date.parse(day.from);
          if (
            duration < 20 * 60 * 60 * 1000 ||
            duration > 28 * 60 * 60 * 1000 ||
            (index > 0 &&
              Date.parse(days[index - 1].to) !== Date.parse(day.from))
          ) {
            context.addIssue({
              code: "custom",
              message: "Ожидаются смежные границы дней",
              path: [index],
            });
          }
        });
      }),
  })
  .strict();

/** Считаем состояния постов на сервере без передачи всего списка в браузер. */
export async function getAdminPostCounts(db: Database) {
  if (!db) throw new Error("Database not available");
  // These are the existing header semantics, not the status-only stats dashboard.
  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)`.mapWith(Number),
      published:
        sql<number>`COUNT(CASE WHEN ${posts.published}=TRUE THEN 1 END)`.mapWith(
          Number,
        ),
      scheduled:
        sql<number>`COUNT(CASE WHEN ${posts.status}='scheduled' THEN 1 END)`.mapWith(
          Number,
        ),
      draft:
        sql<number>`COUNT(CASE WHEN ${posts.status}='draft' OR (${posts.published}=FALSE AND COALESCE(${posts.status},'')<>'scheduled') THEN 1 END)`.mapWith(
          Number,
        ),
    })
    .from(posts);
  return counts;
}

/** Возвращаем данные выбранного интервала календаря, а не полные тела всех публикаций. */
export async function getAdminPostCalendar(
  db: Database,
  input: z.infer<typeof adminPostCalendarInput>,
) {
  if (!db) throw new Error("Database not available");
  const eventDate = sql`COALESCE(${posts.scheduledAt},${posts.publishedAt},${posts.createdAt})`;
  const dayIndex = sql<number>`CASE ${sql.join(
    input.days.map(
      (day, index) =>
        sql`WHEN ${eventDate} >= ${new Date(day.from)} AND ${eventDate} < ${new Date(day.to)} THEN ${index}`,
    ),
    sql` `,
  )} END`;
  const partition = sql`PARTITION BY ${dayIndex}`;
  // Window counts retain every record in a dense day; only its first card crosses
  // the SQL boundary. No LIMIT on events that would silently truncate day counts.
  const ranked = db
    .select({
      ...card,
      dayIndex: dayIndex.mapWith(Number).as("dayIndex"),
      position:
        sql<number>`ROW_NUMBER() OVER (${partition} ORDER BY ${sql.join([...postListOrder], sql`, `)})`.as(
          "position",
        ),
      total: sql<number>`COUNT(*) OVER (${partition})`
        .mapWith(Number)
        .as("total"),
      published:
        sql<number>`SUM(CASE WHEN ${posts.status}='published' THEN 1 ELSE 0 END) OVER (${partition})`
          .mapWith(Number)
          .as("publishedCount"),
      scheduled:
        sql<number>`SUM(CASE WHEN ${posts.status}='scheduled' THEN 1 ELSE 0 END) OVER (${partition})`
          .mapWith(Number)
          .as("scheduled"),
      draft:
        sql<number>`SUM(CASE WHEN ${posts.status}='draft' THEN 1 ELSE 0 END) OVER (${partition})`
          .mapWith(Number)
          .as("draft"),
    })
    .from(posts)
    .where(
      and(
        gte(eventDate, new Date(input.days[0].from)),
        lt(eventDate, new Date(input.days.at(-1)!.to)),
      ),
    )
    .as("calendarDays");
  const rows = await db
    .select()
    .from(ranked)
    .where(eq(ranked.position, 1))
    .orderBy(asc(ranked.dayIndex))
    .limit(62);
  const upcoming = await db
    .select(card)
    .from(posts)
    .where(and(eq(posts.status, "scheduled"), isNotNull(posts.scheduledAt)))
    .orderBy(asc(posts.scheduledAt), ...postListOrder)
    .limit(8);
  return {
    days: rows.map(({ position, ...day }) => day),
    upcoming,
  };
}
