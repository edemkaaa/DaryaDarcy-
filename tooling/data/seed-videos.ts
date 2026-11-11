// Исторически наполняет таблицу YouTube-каталога. Для нынешнего VK-каталога это не штатный источник данных.
/**
 * Seed YouTube videos into the database.
 * Run with: npx tsx tooling/data/seed-videos.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { videos } from "../../packages/database/src/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

const videoData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "youtube-videos.json"), "utf-8")
) as Array<{
  id: string;
  title: string;
  duration: string;
  views: string;
  published: string;
  thumbnail: string;
}>;

async function main() {
  // Добавляет отсутствующие youtubeId из исторического JSON как опубликованные; для нынешнего VK-каталога запуск не нужен.

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(dbUrl);
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < videoData.length; i++) {
    const v = videoData[i];
    if (!v.id || !v.title) {
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await db
      .select()
      .from(videos)
      .where(eq(videos.youtubeId, v.id))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Use YouTube thumbnail URL directly (maxresdefault for best quality)
    const thumbnailUrl = `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`;

    await db.insert(videos).values({
      youtubeId: v.id,
      title: v.title,
      duration: v.duration || null,
      thumbnailUrl,
      videoUrl: null, // Will be set when video is uploaded to S3
      views: v.views || null,
      publishedText: v.published || null,
      sortOrder: i,
      published: true,
    });
    imported++;
  }

  console.log(`Done! Imported: ${imported}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
