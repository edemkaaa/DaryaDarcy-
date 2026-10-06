import { z } from "zod";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const integer = z.number().int().min(0).max(2147483647);
const id = integer.min(1);
const date = z.string().datetime();
const hostedUrl = (host) =>
  z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === host &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.hash
      );
    });
const post = z
  .object({
    id,
    text: z.string().max(65535),
    photos: z.array(hostedUrl("s3.twcstorage.ru")).max(20),
    tags: z.array(z.string().max(64)).max(32),
    source: z.literal("instagram"),
    instagramId: z.string().min(1).max(128),
    sortOrder: integer,
    published: z.literal(true),
    status: z.literal("published"),
    target: z.literal("feed"),
    scheduledAt: z.null(),
    publishedAt: date.nullable(),
    richText: z.null(),
    createdAt: date,
    updatedAt: date,
    media: z.array(z.never()).max(0),
  })
  .transform(({ media, ...content }) => content);
const video = z.object({
  id,
  youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().min(1).max(512),
  duration: z.string().max(16).nullable(),
  thumbnailUrl: hostedUrl("i.ytimg.com").nullable(),
  videoUrl: z.null(),
  views: z.string().max(32).nullable(),
  publishedText: z.string().max(64).nullable(),
  sortOrder: integer,
  published: z.literal(true),
  createdAt: date,
  updatedAt: date,
});
const tag = z.object({
  id,
  slug: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  category: z.enum(["season", "topic"]),
  sortOrder: integer,
});
const schema = z.object({
  posts: z.array(post).min(1).max(5000),
  videos: z.array(video).min(1).max(1000),
  tags: z.array(tag).min(1).max(100),
});

export function preparePublicSnapshot(input) {
  // Our own export omits the empty media field; still reject attached source media.
  const source =
    input && Array.isArray(input.posts)
      ? {
          ...input,
          posts: input.posts.map((row) => ({ media: [], ...row })),
        }
      : input;
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error("Invalid public content snapshot");
  const data = parsed.data;
  const unique = (rows, key) =>
    new Set(rows.map((row) => row[key])).size === rows.length;
  const slugs = new Set(data.tags.map((row) => row.slug));
  if (
    ![data.posts, data.videos, data.tags].every((rows) => unique(rows, "id")) ||
    !unique(data.posts, "instagramId") ||
    !unique(data.videos, "youtubeId") ||
    !unique(data.tags, "slug") ||
    data.posts.some((row) => row.tags.some((slug) => !slugs.has(slug)))
  ) {
    throw new Error("Invalid public content snapshot");
  }
  return data;
}

export function assertStagingDestination(database, app) {
  try {
    const db = new URL(database);
    if (
      db.protocol !== "mysql:" ||
      db.hostname !== "mysql" ||
      (db.port && db.port !== "3306") ||
      db.pathname !== "/daryadarcy_staging" ||
      (db.search && db.search !== "?charset=utf8mb4") ||
      db.hash ||
      app !== "https://daryadarcy.dev.reeskeen.ru"
    )
      throw new Error();
  } catch {
    throw new Error("Not the isolated staging destination");
  }
}

const tables = {
  tags: Object.keys(tag.shape),
  posts: [
    "id",
    "text",
    "photos",
    "tags",
    "source",
    "instagramId",
    "sortOrder",
    "published",
    "status",
    "target",
    "scheduledAt",
    "publishedAt",
    "richText",
    "createdAt",
    "updatedAt",
  ],
  videos: Object.keys(video.shape),
};
const lockName = "daryadarcy-staging-public-bootstrap";
const summary = (data, applied) => ({
  applied,
  posts: data.posts.length,
  videos: data.videos.length,
  tags: data.tags.length,
  photos: data.posts.reduce((count, row) => count + row.photos.length, 0),
});

export async function importPublicContent(
  db,
  input,
  { database, app, apply = false },
) {
  assertStagingDestination(database, app);
  const data = preparePublicSnapshot(input);
  let locked = false;
  let transaction = false;
  try {
    const [engines] = await db.query(
      "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('tags', 'posts', 'videos')",
    );
    if (engines.length !== 3 || engines.some((row) => row.ENGINE !== "InnoDB"))
      throw new Error();
    if (apply) {
      const [[lock]] = await db.query("SELECT GET_LOCK(?, 0) AS acquired", [
        lockName,
      ]);
      if (lock.acquired !== 1) throw new Error();
      locked = true;
      await db.query("SET time_zone = '+00:00'");
      await db.beginTransaction();
      transaction = true;
    }
    for (const table of Object.keys(tables)) {
      const [rows] = await db.query(
        `SELECT id FROM \`${table}\` LIMIT 1${apply ? " FOR UPDATE" : ""}`,
      );
      if (rows.length) throw new Error("Content tables are not empty");
    }
    if (!apply) return summary(data, false);
    for (const [table, columns] of Object.entries(tables)) {
      const sql = `INSERT INTO \`${table}\` (${columns.map((key) => `\`${key}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      for (const row of data[table]) {
        const values = columns.map((key) => {
          if (["createdAt", "updatedAt", "publishedAt"].includes(key))
            return row[key] ? new Date(row[key]) : null;
          if (["photos", "tags"].includes(key)) return JSON.stringify(row[key]);
          return row[key];
        });
        await db.execute(sql, values);
      }
    }
    await db.commit();
    transaction = false;
    return summary(data, true);
  } catch (error) {
    if (transaction) await db.rollback().catch(() => {});
    throw new Error(
      error.message === "Content tables are not empty"
        ? error.message
        : "Public content import failed",
    );
  } finally {
    if (locked)
      await db.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
  }
}

export async function exportPublicSnapshot() {
  const input = {};
  for (const [key, method] of Object.entries({
    posts: "feed.list",
    videos: "videos.list",
    tags: "feed.tags",
  })) {
    const response = await fetch(`https://daryadarcy.com/api/trpc/${method}`, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Public content export failed");
    const body = await response.text();
    if (Buffer.byteLength(body) > 20 * 1024 * 1024)
      throw new Error("Public content export failed");
    input[key] = JSON.parse(body)?.result?.data?.json;
  }
  return preparePublicSnapshot(input);
}

async function main(args) {
  if (args.length === 2 && args[0] === "--export") {
    const data = await exportPublicSnapshot();
    await writeFile(args[1], JSON.stringify(data), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(summary(data, false)));
    return;
  }
  const mode = args.length === 2 ? args[0] : "--dry-run";
  const path = args.length === 2 ? args[1] : args[0];
  if (
    !["--apply", "--dry-run", "--validate"].includes(mode) ||
    !path ||
    args.length > 2
  ) {
    throw new Error(
      "Usage: import-public-staging.mjs [--export|--validate|--dry-run|--apply] snapshot.json",
    );
  }
  const data = preparePublicSnapshot(JSON.parse(await readFile(path, "utf8")));
  if (mode === "--validate") {
    console.log(JSON.stringify(summary(data, false)));
    return;
  }
  assertStagingDestination(
    process.env.DATABASE_URL,
    process.env.PUBLIC_APP_URL,
  );
  const { createConnection } = await import("mysql2/promise");
  const url = new URL(process.env.DATABASE_URL);
  const db = await createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: "daryadarcy_staging",
    charset: "utf8mb4",
    timezone: "Z",
    connectTimeout: 10000,
  });
  try {
    console.log(
      JSON.stringify(
        await importPublicContent(db, data, {
          database: process.env.DATABASE_URL,
          app: process.env.PUBLIC_APP_URL,
          apply: mode === "--apply",
        }),
      ),
    );
  } finally {
    await db.end();
  }
}

// Supports direct execution from a file or stdin inside the isolated API container.
if (
  process.argv[1] === "-" ||
  (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
) {
  main(process.argv.slice(2)).catch((error) => {
    const safe = [
      "Invalid public content snapshot",
      "Not the isolated staging destination",
      "Content tables are not empty",
      "Public content import failed",
      "Public content export failed",
    ];
    console.error(
      safe.includes(error.message)
        ? error.message
        : "Public content operation failed; no credentials or source values logged",
    );
    process.exitCode = 1;
  });
}
