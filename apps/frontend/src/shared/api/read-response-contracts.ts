/** Ответы чтения проверяем на границе API; объявленный TypeScript-тип не заменяет проверку полученных данных. */
import { z } from "zod";
import { invalidResponse } from "./errors";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const publicPostId = z.uuidv4();
const postAddress = z.union([
  z.object({ id }),
  z.object({ publicId: publicPostId }).strict(),
]);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// SuperJSON supplies Date; older JSON readers also supply ISO timestamps.
const date = z.union([z.date(), z.iso.datetime({ offset: true })]);
const strings = z.array(z.string());
const target = z.enum(["feed", "club", "both"]);
const status = z.enum(["published", "draft", "scheduled"]);
const access = z.enum(["public", "club"]);
const articleCard = z.object({
  id,
  title: z.string(),
  coverUrl: z.string().nullable(),
  access,
});
const articleBlock = z.object({
  type: z.enum(["link", "text", "heading", "photo", "png", "carousel"]),
  text: z.string().optional(),
  url: z.string().optional(),
  label: z.string().optional(),
  urls: strings.optional(),
  caption: z.string().optional(),
});
const article = articleCard.extend({
  locked: z.boolean(),
  sections: z.array(articleBlock),
});
const video = z.object({
  id,
  title: z.string(),
  youtubeId: z.string().min(1),
  duration: z.string().nullable(),
  views: z.string().nullable(),
  publishedText: z.string().nullable(),
  videoUrl: z.string().nullable(),
  // Legacy public cards do not require a custom thumbnail or ORM metadata.
  thumbnailUrl: z.string().nullable().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  createdAt: date.optional(),
  updatedAt: date.optional(),
});
const richText = z.array(
  z.object({
    type: z.enum(["paragraph", "heading"]),
    children: z.array(
      z.object({
        text: z.string(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        link: z.string().optional(),
      }),
    ),
  }),
);
const media = z.object({
  id,
  type: z.enum(["video", "audio", "document"]),
  url: z.string(),
  duration: z.number().nonnegative().nullable(),
  filename: z.string().nullable(),
  mimeType: z.string().nullable(),
  posterUrl: z.string().nullable(),
  fileSize: count.nullable(),
  postId: id,
  sortOrder: z.number().int(),
  createdAt: date,
});
const post = z.object({
  id,
  publicId: publicPostId.optional(),
  text: z.string(),
  photos: strings,
  tags: strings,
  target,
  media: z.array(media),
  richText: richText.nullable(),
  createdAt: date,
  publishedAt: date.nullable(),
  // Older public cards omit editorial metadata; validate it when present.
  source: z.string().optional(),
  instagramId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
  status: status.optional(),
  scheduledAt: date.nullable().optional(),
  updatedAt: date.optional(),
  likeCount: count,
  commentCount: count.optional(),
});
const postCard = post.extend({ commentCount: count });
const adminPostCard = z.object({
  id,
  text: z.string(),
  photos: strings,
  tags: strings,
  tagCount: count,
  hasVideo: z.boolean(),
  published: z.boolean(),
  status,
  target,
  scheduledAt: date.nullable(),
  publishedAt: date.nullable(),
  createdAt: date,
});
const adminArticleCard = articleCard.extend({
  published: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: date,
  updatedAt: date,
});
const counts = z.object({
  total: count,
  published: count,
  scheduled: count,
  draft: count,
});
const calendarDay = adminPostCard.omit({ published: true }).extend({
  ...counts.shape,
  dayIndex: count,
});
const stats = z.object({
  totalPosts: count,
  publishedPosts: count,
  scheduledPosts: count,
  draftPosts: count,
  feedPosts: count,
  clubPosts: count,
  bothPosts: count,
  totalLikes: count,
  totalSaves: count,
  postsThisMonth: count,
  postsLastMonth: count,
  topLikedPosts: z.array(z.object({ id, text: z.string(), likeCount: count })),
});
const numericPage = <T extends z.ZodType>(row: T) =>
  z.object({ posts: z.array(row), nextCursor: id.nullable() });
const cursorPage = <T extends z.ZodType>(row: T) =>
  z.object({ items: z.array(row), nextCursor: z.string().min(1).nullable() });
const member = z.object({
  id,
  email: z.string().nullable(),
  contactPhone: z.string().nullable(),
  name: z.string().nullable(),
  role: z.enum(["user", "moderator", "admin"]),
  createdAt: date,
  clubExpiresAt: date.nullable(),
  blockedAt: date.nullable(),
  blockedReason: z.string().nullable(),
});
const payment = z.object({
  id,
  userId: id,
  orderId: z.string(),
  email: z.string().nullable(),
  sum: z.string().nullable(),
  status: z.enum(["pending", "paid", "failed"]),
  paidAt: date.nullable(),
  expiresAt: date.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  cancelledAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
});
const comment = z.object({
  id,
  postId: id,
  userId: id,
  parentId: id.nullable(),
  text: z.string(),
  photos: strings.nullable(),
  createdAt: date,
  authorName: z.string().nullable(),
  authorAvatarUrl: z.string().nullable(),
  likeCount: count,
  likedByMe: z.boolean(),
  replyCount: count,
});
const commentReport = z.object({
  id,
  commentId: id,
  reason: z.string(),
  createdAt: date,
  commentText: z.string(),
  commentPhotos: strings.nullable(),
  postId: id,
  authorUserId: id,
  authorName: z.string().nullable(),
  reporterUserId: id,
  reporterName: z.string().nullable(),
  // canBlockAuthor is a compatible UI hint; the view only acts on literal true.
});

// These are read/view contracts, not ORM models. Unknown fields stay compatible.
// Checkout, private files and the new video catalog already validate their own
// documented protocols; mutations retain their existing receipt/revision readers.
const readContracts: Record<string, z.ZodType> = {
  "articles.list": z.array(articleCard),
  "articles.getById": article.nullish(),
  "videos.list": z.array(video),
  "videos.getById": video.nullish(),
  "feed.listPaginated": numericPage(postCard),
  "feed.getById": post.nullish(),
  "feed.savedPostsPage": cursorPage(postCard),
  "club.listByCategory": numericPage(postCard),
  "feed.tags": z.array(
    z.object({
      id,
      slug: z.string(),
      label: z.string(),
      category: z.enum(["season", "topic"]),
      sortOrder: z.number().int(),
    }),
  ),
  "admin.postsPage": numericPage(adminPostCard),
  "admin.articlesPage": cursorPage(adminArticleCard),
  "admin.stats": stats,
  "admin.postCounts": counts,
  "admin.postCalendar": z.object({
    days: z.array(calendarDay),
    upcoming: z.array(adminPostCard),
  }),
  "admin.membersPage": cursorPage(member),
  "admin.paymentsPage": cursorPage(payment),
  "club.commentsPage": cursorPage(comment).extend({ totalCount: count }),
  "moderation.listCommentReports": z.array(commentReport),
};

/** Assert before caching; never strip unknown fields, coerce or replace data. */
export function validateReadResponse(
  path: string,
  value: unknown,
  input: unknown,
): void {
  const schema = Object.hasOwn(readContracts, path)
    ? readContracts[path]
    : undefined;
  if (!schema) return;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidResponse();
  if (
    ["articles.getById", "videos.getById", "feed.getById"].includes(path) &&
    value != null
  ) {
    if (path === "feed.getById") {
      const expected = postAddress.safeParse(input);
      if (!expected.success) throw invalidResponse();
      const received = value as { id: number; publicId?: string };
      const matches = "id" in expected.data
        ? received.id === expected.data.id
        : received.publicId === expected.data.publicId.toLowerCase();
      if (!matches) throw invalidResponse();
    } else {
      const expected = z.object({ id }).safeParse(input);
      if (!expected.success || (value as { id: number }).id !== expected.data.id)
        throw invalidResponse();
    }
  }
  if (path === "admin.postCalendar") {
    const requested = z.object({ days: z.array(z.unknown()) }).safeParse(input);
    const days = (value as { days: { dayIndex: number }[] }).days;
    if (
      !requested.success ||
      days.some((day) => day.dayIndex >= requested.data.days.length) ||
      new Set(days.map((day) => day.dayIndex)).size !== days.length
    )
      throw invalidResponse();
  }
  if (path === "club.commentsPage") {
    const requested = z
      .object({ postId: id, parentId: id.nullish() })
      .safeParse(input);
    const rows = (value as { items: z.infer<typeof comment>[] }).items;
    if (
      !requested.success ||
      rows.some(
        (row) =>
          row.postId !== requested.data.postId ||
          row.parentId !== (requested.data.parentId ?? null),
      )
    )
      throw invalidResponse();
  }
}
