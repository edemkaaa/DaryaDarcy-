// Преобразует исторические клубные записи в текущий формат без сетевых обращений. Разбор данных отделён от оператора, который выбирает БД и выполняет запись.
import { z } from "zod";

const id = z.number().int().min(1).max(2147483647);
const order = z.number().int().min(-2147483648).max(2147483647);
const flag = z
  .union([z.boolean(), z.literal(0), z.literal(1)])
  .transform((value) => (value ? 1 : 0));
const timestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  .refine((value) => {
    const date = new Date(value.replace(" ", "T") + "Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 19).replace("T", " ") === value
    );
  });
const asset = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "s3.twcstorage.ru" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.search &&
      !url.hash &&
      /^\/daryadarcy-s3\/(club|feed)\//.test(url.pathname)
    );
  });
const link = z
  .string()
  .max(2048)
  .url()
  .refine((value) =>
    ["https:", "http:", "mailto:", "tel:"].includes(new URL(value).protocol),
  );
function jsonField<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }, schema);
}
const richText = z.array(
  z
    .object({
      type: z.enum(["paragraph", "heading"]),
      children: z.array(
        z
          .object({
            text: z.string(),
            bold: z.boolean().optional(),
            italic: z.boolean().optional(),
            link: link.optional(),
          })
          .strict(),
      ),
    })
    .strict(),
);
const post = z
  .object({
    id,
    text: z.string(),
    photos: jsonField(z.array(asset)),
    tags: jsonField(z.array(z.string().max(64))),
    source: z.union([
      z.literal("manual"),
      z.literal("telegram"),
      z.string().regex(/^article:[1-9]\d*$/),
    ]),
    instagramId: z.string().max(128).nullable(),
    sortOrder: order,
    published: flag,
    status: z.enum(["draft", "scheduled", "published"]),
    target: z.enum(["club", "both"]),
    scheduledAt: timestamp.nullable(),
    publishedAt: timestamp.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
    richText: jsonField(richText.nullable()),
  })
  .strict();
const section = z
  .object({
    type: z.enum(["heading", "text", "photo", "png", "link", "carousel"]),
    text: z.string().optional(),
    url: z.string().max(2048).optional(),
    urls: z.array(asset).optional(),
    label: z.string().optional(),
    caption: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ["photo", "png"].includes(value.type) &&
      !asset.safeParse(value.url).success
    )
      ctx.addIssue({ code: "custom", message: "Invalid image reference" });
    if (value.type === "carousel" && !value.urls?.length)
      ctx.addIssue({ code: "custom", message: "Empty carousel" });
    if (value.type === "link" && !link.safeParse(value.url).success)
      ctx.addIssue({ code: "custom", message: "Invalid link" });
  });
const article = z
  .object({
    id,
    title: z.string().min(1).max(255),
    coverUrl: asset.nullable(),
    access: z.enum(["public", "club"]),
    published: flag,
    sortOrder: order,
    sections: jsonField(z.array(section)),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
const media = z
  .object({
    id,
    postId: id,
    type: z.enum(["video", "audio", "document"]),
    url: asset,
    filename: z.string().max(512).nullable(),
    mimeType: z.string().max(128).nullable(),
    fileSize: z.number().int().min(0).max(2147483647).nullable(),
    duration: z.number().int().min(0).nullable(),
    sortOrder: order,
    createdAt: timestamp,
  })
  .strict();
const snapshot = z
  .object({
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    posts: z.array(post).min(1).max(10000),
    articles: z.array(article).max(1000),
    media: z.array(media).max(10000),
    tags: z.array(z.unknown()).optional(),
  })
  .strict();
export type LegacyClubContent = Omit<z.output<typeof snapshot>, "tags">;

/** User approved only this known overdue source post to become an unscheduled draft. */
export function prepareLegacyClubStagingContent(
  input: unknown,
): LegacyClubContent {
  const content = prepareLegacyClubContent(input);
  if (
    content.sourceSha256 !==
    "2b2ccad2b74c74b2098760e168ea2c6daedacc62fff8957427095dfc27e3aa8b"
  )
    throw new Error("Unapproved source snapshot");
  const overdue = content.posts.find((row) => row.id === 928);
  if (
    !overdue ||
    overdue.status !== "scheduled" ||
    overdue.published !== 0 ||
    overdue.scheduledAt !== "2026-10-19 07:00:00"
  )
    throw new Error("Approved overdue post differs");
  return {
    ...content,
    posts: content.posts.map((row) =>
      row.id === 928
        ? { ...row, status: "draft", published: 0, scheduledAt: null }
        : row,
    ),
  };
}

/** Content-only boundary; no source accounts, payments, settings or video catalog. */
export function prepareLegacyClubContent(input: unknown): LegacyClubContent {
  const parsed = snapshot.safeParse(input);
  if (!parsed.success) throw new Error("Invalid legacy Club snapshot");
  const { tags: _tags, ...data } = parsed.data;
  const unique = (rows: { id: number }[]) =>
    new Set(rows.map((row) => row.id)).size === rows.length;
  const postIds = new Set(data.posts.map((row) => row.id));
  const articleIds = new Set(data.articles.map((row) => row.id));
  const cards = data.posts.filter((row) => row.source.startsWith("article:"));
  const telegramIds = data.posts
    .filter((row) => row.source === "telegram")
    .map((row) => row.instagramId);
  if (
    ![data.posts, data.articles, data.media].every(unique) ||
    data.media.some((row) => !postIds.has(row.postId)) ||
    cards.some((row) => !articleIds.has(Number(row.source.slice(8)))) ||
    new Set(cards.map((row) => row.source)).size !== cards.length ||
    telegramIds.some((value) => !value) ||
    new Set(telegramIds).size !== telegramIds.length
  ) {
    throw new Error("Invalid legacy Club snapshot");
  }
  return data;
}
