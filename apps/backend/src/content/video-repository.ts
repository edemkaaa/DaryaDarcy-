import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { assertContentWriteActor, type ContentWriteActor } from "./content-write-actor";
import { requireContentDatabase } from "./read-database";
import {
  videos,
  type InsertVideo,
  type Video,
} from "../../../../packages/database/src/schema";

// Connection ownership stays in db.ts; unavailable reads must not look empty.
type Database = MySql2Database | null;
export type PublicVideo = Omit<
  Video,
  "provider" | "access" | "vkEmbedUrl" | "vkSourceKey" | "youtubeId" | "editRevision"
> & { youtubeId: string };
function publicVideo(row: Video): PublicVideo {
  if (typeof row.youtubeId !== "string" || !row.youtubeId)
    throw new Error("Invalid public video");
  const { provider, access, vkEmbedUrl, vkSourceKey, editRevision, ...legacy } = row;
  return {
    ...legacy,
    youtubeId: row.youtubeId,
    title: (row.title || "").normalize("NFC"),
  };
}

export async function getVideos(db: Database): Promise<PublicVideo[]> {
  requireContentDatabase(db);
  const rows = await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.published, true),
        eq(videos.access, "public"),
        eq(videos.provider, "youtube"),
      ),
    )
    .orderBy(asc(videos.sortOrder), desc(videos.createdAt));
  return rows.map(publicVideo);
}

/** Constant-size public authority for the legacy stream service, never a catalog. */
export async function isPublicYoutubeVideo(db: Database, youtubeId: string) {
  requireContentDatabase(db);
  const rows = await db.select({ id: videos.id }).from(videos).where(and(
    eq(videos.youtubeId, youtubeId), eq(videos.provider, "youtube"),
    eq(videos.access, "public"), eq(videos.published, true),
  )).limit(1);
  return rows.length === 1;
}

export async function getVideoById(
  db: Database,
  id: number,
): Promise<PublicVideo | undefined> {
  requireContentDatabase(db);
  const result = await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.id, id),
        eq(videos.published, true),
        eq(videos.access, "public"),
        eq(videos.provider, "youtube"),
      ),
    )
    .limit(1);
  const row = result[0];
  if (!row) return undefined;
  return publicVideo(row);
}

// Internal dedup includes unpublished rows and preserves the raw stored title.
export async function getVideoByYoutubeId(
  db: Database,
  youtubeId: string,
): Promise<Video | undefined> {
  requireContentDatabase(db);
  const result = await db
    .select()
    .from(videos)
    .where(eq(videos.youtubeId, youtubeId))
    .limit(1);
  return result[0];
}

export async function createVideo(
  db: Database,
  data: InsertVideo,
): Promise<number> {
  if (!db) throw new Error("Database not available");
  const result = await db.insert(videos).values(data);
  return Number(result[0].insertId);
}

export async function bulkImportVideos(
  db: Database,
  items: InsertVideo[],
  actor: ContentWriteActor,
): Promise<number> {
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    // Импорт читает права администратора до записи и удерживает блокировку
    // до коммита. Блокировка на чтение позволяет двум импортам идти параллельно.
    await assertContentWriteActor(tx, actor, "share");
    let imported = 0;
    for (const item of items) {
      if (typeof item.youtubeId !== "string" || !item.youtubeId)
        throw new Error("YouTube ID required for import");
      const [existing] = await tx
        .select({ id: videos.id })
        .from(videos)
        .where(eq(videos.youtubeId, item.youtubeId))
        .limit(1);
      if (existing) continue;
      await tx.insert(videos).values(item);
      imported++;
    }
    return imported;
  });
}

export async function updateVideo(
  db: Database,
  id: number,
  data: Partial<InsertVideo>,
): Promise<void> {
  if (!db) throw new Error("Database not available");
  await db.update(videos).set({ ...data, editRevision: sql`${videos.editRevision} + 1` }).where(eq(videos.id, id));
}

export async function deleteVideo(db: Database, id: number): Promise<void> {
  if (!db) throw new Error("Database not available");
  await db.delete(videos).where(eq(videos.id, id));
}
