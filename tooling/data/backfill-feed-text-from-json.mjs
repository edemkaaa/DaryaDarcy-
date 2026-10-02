/**
 * Restore Instagram feed captions from ig_posts_processed.json.
 *
 * Usage:
 *   node tooling/data/backfill-feed-text-from-json.mjs
 *   DRY_RUN=1 LIMIT=5 node tooling/data/backfill-feed-text-from-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

async function ensureUtf8Mb4(conn) {
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
const LIMIT = Number(process.env.LIMIT || 0);
const JSON_PATH =
  process.env.IG_JSON_PATH || path.join(root, "ig_posts_processed.json");

async function main() {
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!fs.existsSync(JSON_PATH)) {
    console.error("JSON not found:", JSON_PATH);
    process.exit(1);
  }

  const processed = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const byShortcode = new Map(
    processed
      .filter((p) => p.shortcode && typeof p.text === "string" && p.text.trim())
      .map((p) => [p.shortcode, p]),
  );
  console.log(`loaded ${byShortcode.size} captions from JSON`);

  const conn = await mysql.createConnection(env.DATABASE_URL);
  await ensureUtf8Mb4(conn);
  const [rows] = await conn.query(
    `SELECT id, instagramId, text
     FROM posts
     WHERE source = 'instagram' AND instagramId IS NOT NULL`,
  );

  const todo = FORCE
    ? rows
    : rows.filter((r) => !r.text || String(r.text).trim().length === 0);
  const batch = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
  console.log(`posts to update: ${batch.length} / ${todo.length}${FORCE ? " (force)" : ""}`);

  let updated = 0;
  let missing = 0;

  for (const row of batch) {
    const entry = byShortcode.get(row.instagramId);
    if (!entry) {
      missing += 1;
      continue;
    }
    const text = entry.text.trim();
    const tags = JSON.stringify(Array.isArray(entry.tags) ? entry.tags : []);
    if (!DRY_RUN) {
      await conn.query(
        "UPDATE posts SET text = ?, tags = ?, richText = NULL WHERE id = ?",
        [text, tags, row.id],
      );
    }
    updated += 1;
    if (updated <= 3 || updated % 100 === 0) {
      console.log(DRY_RUN ? "dry" : "updated", row.instagramId, text.slice(0, 60));
    }
  }

  const [[after]] = await conn.query(
    `SELECT COUNT(*) AS c FROM posts
     WHERE source = 'instagram' AND text IS NOT NULL AND text != ''`,
  );
  console.log(`done: updated=${updated} missingJson=${missing} dry=${DRY_RUN}`);
  console.log(`instagram posts with text now: ${after.c}`);
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
