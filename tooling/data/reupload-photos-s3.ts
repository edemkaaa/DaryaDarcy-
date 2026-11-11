// Переносит фотографии Instagram CDN в S3 с журналом прогресса и обновляет ссылки. Скачивание и запись происходят во внешних системах.
/**
 * Re-upload Instagram CDN photos to Timeweb S3
 * 
 * Downloads each photo from Instagram CDN and uploads to S3,
 * then updates the database record with the new S3 URL.
 * 
 * Usage: npx tsx tooling/data/reupload-photos-s3.ts
 * 
 * Features:
 * - Processes posts in batches to avoid memory issues
 * - Skips photos already on S3 (idempotent)
 * - Saves progress so it can be resumed if interrupted
 * - Respects rate limits with delays between downloads
 */

import "../scripts/load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { posts } from "../../packages/database/src/schema";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

const BATCH_SIZE = 10; // posts per batch
const DELAY_BETWEEN_PHOTOS = 300; // ms between photo downloads
const DELAY_BETWEEN_BATCHES = 2000; // ms between batches
const PROGRESS_FILE = path.resolve(__dirname, "../.s3-upload-progress.json");

interface Progress {
  processedPostIds: number[];
  totalUploaded: number;
  totalFailed: number;
  lastRun: string;
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { processedPostIds: [], totalUploaded: 0, totalFailed: 0, lastRun: "" };
}

function saveProgress(progress: Progress) {
  progress.lastRun = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error("S3 env vars not set (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY)");
  }
  
  return new S3Client({
    endpoint,
    region: "ru-1",
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
    forcePathStyle: true,
  });
}

function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com") || url.includes("cdninstagram.com") || url.includes("fbcdn.net");
}

function getContentType(url: string): string {
  if (url.includes(".webp")) return "image/webp";
  if (url.includes(".png")) return "image/png";
  return "image/jpeg";
}

async function downloadPhoto(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      console.error(`    Download failed (${response.status}): ${url.slice(0, 80)}...`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error(`    Download error: ${err.message} | ${url.slice(0, 80)}...`);
    return null;
  }
}

async function uploadToS3(
  client: S3Client,
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );
  
  return `${process.env.S3_ENDPOINT}/${bucket}/${key}`;
}

async function main() {
  console.log("=== Re-upload Instagram Photos to Timeweb S3 ===\n");

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const bucket = process.env.S3_BUCKET || "daryadarcy-s3";
  const s3 = getS3Client();
  const db = drizzle(process.env.DATABASE_URL);
  
  // Load progress
  const progress = loadProgress();
  const processedSet = new Set(progress.processedPostIds);
  console.log(`  Resuming: ${processedSet.size} posts already processed`);
  console.log(`  Previously uploaded: ${progress.totalUploaded} photos\n`);

  // Get all posts with Instagram photos
  const allPosts = await db.select().from(posts);
  const postsWithIgPhotos = allPosts.filter(
    (p) => !processedSet.has(p.id) && p.photos.some((url) => isInstagramUrl(url))
  );
  
  console.log(`  Total posts in DB: ${allPosts.length}`);
  console.log(`  Posts with Instagram photos to process: ${postsWithIgPhotos.length}`);
  console.log(`  Starting upload...\n`);

  let uploaded = 0;
  let failed = 0;
  let batchCount = 0;

  for (let i = 0; i < postsWithIgPhotos.length; i += BATCH_SIZE) {
    const batch = postsWithIgPhotos.slice(i, i + BATCH_SIZE);
    batchCount++;
    
    for (const post of batch) {
      const newPhotos: string[] = [];
      let postModified = false;
      
      for (let j = 0; j < post.photos.length; j++) {
        const photoUrl = post.photos[j];
        
        if (!isInstagramUrl(photoUrl)) {
          // Already on S3 or other storage, keep as-is
          newPhotos.push(photoUrl);
          continue;
        }
        
        // Download from Instagram
        const data = await downloadPhoto(photoUrl);
        
        if (!data) {
          // Keep original URL if download fails
          newPhotos.push(photoUrl);
          failed++;
          continue;
        }
        
        // Upload to S3
        const ext = photoUrl.includes(".webp") ? "webp" : "jpg";
        const s3Key = `feed/${post.instagramId || post.id}/photo_${j + 1}.${ext}`;
        const contentType = getContentType(photoUrl);
        
        try {
          const s3Url = await uploadToS3(s3, bucket, s3Key, data, contentType);
          newPhotos.push(s3Url);
          uploaded++;
          postModified = true;
        } catch (err: any) {
          console.error(`    S3 upload error: ${err.message}`);
          newPhotos.push(photoUrl); // Keep original
          failed++;
        }
        
        await sleep(DELAY_BETWEEN_PHOTOS);
      }
      
      // Update DB if any photos were re-uploaded
      if (postModified) {
        await db.update(posts).set({ photos: newPhotos }).where(eq(posts.id, post.id));
      }
      
      // Mark post as processed
      progress.processedPostIds.push(post.id);
      processedSet.add(post.id);
    }
    
    // Save progress after each batch
    progress.totalUploaded += uploaded;
    progress.totalFailed += failed;
    saveProgress(progress);
    
    const totalProcessed = processedSet.size;
    const totalRemaining = postsWithIgPhotos.length - (i + batch.length);
    console.log(`  Batch ${batchCount}: +${uploaded} uploaded, +${failed} failed | Total processed: ${totalProcessed} | Remaining: ${totalRemaining}`);
    
    uploaded = 0;
    failed = 0;
    
    if (totalRemaining > 0) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  // Final save
  saveProgress(progress);
  
  console.log(`\n=== Upload Complete ===`);
  console.log(`  Total photos uploaded to S3: ${progress.totalUploaded}`);
  console.log(`  Total failed: ${progress.totalFailed}`);
  console.log(`  Progress saved to: ${PROGRESS_FILE}`);
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
