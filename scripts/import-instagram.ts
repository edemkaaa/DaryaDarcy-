/**
 * Instagram Import Script
 * 
 * Reads processed Instagram posts from ig_posts_processed.json
 * and inserts them into the database with proper chronological ordering.
 * 
 * Usage: npx tsx scripts/import-instagram.ts
 * 
 * Features:
 * - Removes hashtags from text (already done in processing)
 * - Preserves original Instagram publication dates via sortOrder
 * - Deduplicates by Instagram shortcode
 * - Uses Instagram CDN URLs directly (no re-upload needed for now)
 * - Sets posts as published
 */

import "../scripts/load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { posts } from "../drizzle/schema";
import * as fs from "fs";
import * as path from "path";

interface ProcessedPost {
  shortcode: string;
  timestamp: number;
  date: string;
  text: string;
  photos: string[];
  tags: string[];
  type: string;
  likes: number;
  comments: number;
  original_hashtags: string[];
}

async function main() {
  console.log("=== Instagram Import Script ===\n");

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set. Run from project root with .env loaded.");
    process.exit(1);
  }

  // Read processed posts
  const inputPath =
    process.env.IG_JSON_PATH ||
    path.resolve(__dirname, "../ig_posts_processed.json");
  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: File not found: ${inputPath}`);
    console.error("Run ig_process_posts.py first to generate processed data.");
    process.exit(1);
  }

  const rawData = fs.readFileSync(inputPath, "utf-8");
  const processedPosts: ProcessedPost[] = JSON.parse(rawData);
  console.log(`  Loaded ${processedPosts.length} processed posts`);

  // Connect to database
  const db = drizzle(process.env.DATABASE_URL);
  console.log("  Connected to database");

  // Get existing posts to check for duplicates
  const existingPosts = await db.select({ instagramId: posts.instagramId }).from(posts);
  const existingIds = new Set(existingPosts.map(p => p.instagramId).filter(Boolean));
  console.log(`  Found ${existingIds.size} existing imported posts`);

  // Sort posts by timestamp (oldest first for sortOrder assignment)
  const sortedPosts = [...processedPosts].sort((a, b) => a.timestamp - b.timestamp);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Import in batches
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < sortedPosts.length; i++) {
    const post = sortedPosts[i];
    const instagramId = post.shortcode;

    // Skip if already imported
    if (existingIds.has(instagramId)) {
      skipped++;
      continue;
    }

    // Skip posts with no photos
    if (!post.photos || post.photos.length === 0) {
      skipped++;
      continue;
    }

    try {
      // sortOrder: use negative timestamp so newest posts have lowest sortOrder
      // (feed sorts by asc(sortOrder), desc(createdAt))
      // We want newest Instagram posts first, so give them lower sortOrder
      const maxTimestamp = sortedPosts[sortedPosts.length - 1].timestamp;
      const sortOrder = maxTimestamp - post.timestamp;

      await db.insert(posts).values({
        text: post.text || "",
        photos: post.photos,
        tags: post.tags || [],
        source: "instagram",
        instagramId: instagramId,
        sortOrder: sortOrder,
        published: true,
      });

      imported++;
      existingIds.add(instagramId);

      if (imported % 50 === 0) {
        console.log(`  Progress: ${imported} imported, ${skipped} skipped, ${errors} errors`);
      }
    } catch (err: any) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error importing ${instagramId}: ${err.message}`);
      }
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates/no photos): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total in database: ${existingIds.size}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
