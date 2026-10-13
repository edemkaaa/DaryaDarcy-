import { and, asc, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  videos,
  type InsertVideo,
  type Video,
} from "../../../../packages/database/src/schema";

// Connection ownership stays in db.ts; reads retain their unavailable-DB defaults.
type Database = MySql2Database | null;
export type PublicVideo = Omit<
  Video,
  "provider" | "access" | "vkEmbedUrl" | "vkSourceKey" | "youtubeId"
> & { youtubeId: string };
function publicVideo(row: Video): PublicVideo {
  if (typeof row.youtubeId !== "string" || !row.youtubeId)
    throw new Error("Invalid public video");
  const { provider, access, vkEmbedUrl, vkSourceKey, ...legacy } = row;
  return {
    ...legacy,
    youtubeId: row.youtubeId,
    title: (row.title || "").normalize("NFC"),
  };
}

export async function getVideos(db: Database): Promise<PublicVideo[]> {
  if (!db) return [];
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

export async function getVideoById(
  db: Database,
  id: number,
): Promise<PublicVideo | undefined> {
  if (!db) return undefined;
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
  if (!db) return undefined;
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
): Promise<number> {
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
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
  await db.update(videos).set(data).where(eq(videos.id, id));
}

export async function deleteVideo(db: Database, id: number): Promise<void> {
  if (!db) throw new Error("Database not available");
  await db.delete(videos).where(eq(videos.id, id));
}
