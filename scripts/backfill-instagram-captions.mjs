/**
 * Backfill empty Instagram feed post captions via oEmbed API.
 *
 * Usage:
 *   node scripts/backfill-instagram-captions.mjs
 *   LIMIT=5 DRY_RUN=1 node scripts/backfill-instagram-captions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const LIMIT = Number(process.env.LIMIT || 0);
const DRY_RUN = process.env.DRY_RUN === "1";
const DELAY_MS = Number(process.env.DELAY_MS || 650);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

async function fetchCaption(shortcode) {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
  const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`;

  const res = await fetch(oembedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DaryadarcyBot/1.0; +https://daryadarcy.com)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`oEmbed HTTP ${res.status}`);
  }

  const data = await res.json();
  const title = typeof data.title === "string" ? decodeHtml(data.title).trim() : "";
  if (title) return title;

  const embedRes = await fetch(`${postUrl}embed/captioned/`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!embedRes.ok) {
    throw new Error(`embed HTTP ${embedRes.status}`);
  }
  const html = await embedRes.text();
  const og = html.match(/property="og:description"\s+content="([^"]*)"/i);
  if (og?.[1]) return decodeHtml(og[1]).trim();
  const caption = html.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (caption?.[1]) {
    return decodeHtml(caption[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }
  return "";
}

async function main() {
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [rows] = await conn.query(
    `SELECT id, instagramId
     FROM posts
     WHERE source = 'instagram'
       AND (text IS NULL OR text = '')
       AND instagramId IS NOT NULL
       AND instagramId NOT LIKE 'tg-%'
     ORDER BY sortOrder`,
  );

  const todo = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`posts to backfill: ${todo.length} / ${rows.length}`);

  let updated = 0;
  let empty = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i++) {
    const row = todo[i];
    const shortcode = row.instagramId;
    try {
      const text = await fetchCaption(shortcode);
      if (!text) {
        empty += 1;
        if (empty <= 5) console.log("empty", shortcode);
      } else if (!DRY_RUN) {
        await conn.query("UPDATE posts SET text = ?, richText = NULL WHERE id = ?", [text, row.id]);
        updated += 1;
        if (updated <= 5 || updated % 25 === 0) {
          console.log("updated", updated, shortcode, text.slice(0, 60));
        }
      } else {
        updated += 1;
        console.log("dry", shortcode, text.slice(0, 80));
      }
    } catch (error) {
      failed += 1;
      if (failed <= 10) console.error("fail", shortcode, error.message);
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`done: updated=${updated} empty=${empty} failed=${failed} dry=${DRY_RUN}`);
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
