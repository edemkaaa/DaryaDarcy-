/**
 * Creates temporary test posts, verifies fields, then deletes them.
 * Usage: node scripts/_test-admin-posts.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const MARKER = "__cursor_test_post__";
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [sampleRows] = await conn.query(
  "SELECT photos FROM posts WHERE JSON_LENGTH(photos) >= 2 AND published = 1 LIMIT 1",
);
const samplePhotos =
  sampleRows[0]?.photos && typeof sampleRows[0].photos === "string"
    ? JSON.parse(sampleRows[0].photos)
    : sampleRows[0]?.photos ?? [];

const photos = Array.isArray(samplePhotos) && samplePhotos.length >= 2
  ? samplePhotos.slice(0, 3)
  : [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg",
    ];

const richText = [
  {
    type: "paragraph",
    children: [
      { text: "Жирный ", bold: true },
      { text: "и " },
      { text: "курсив", italic: true },
    ],
  },
];

const payloads = [
  {
    text: `${MARKER} plain text post`,
    photos: JSON.stringify(photos.slice(0, 1)),
    tags: JSON.stringify(["summer"]),
    richText: null,
  },
  {
    text: `${MARKER} formatted post with ${photos.length} photos`,
    photos: JSON.stringify(photos),
    tags: JSON.stringify(["garden", "summer"]),
    richText: JSON.stringify(richText),
  },
];

const ids = [];
try {
  for (const p of payloads) {
    const [result] = await conn.query(
      `INSERT INTO posts (text, photos, tags, source, sortOrder, published, status, target, publishedAt, richText)
       VALUES (?, ?, ?, 'manual', 9999, 1, 'published', 'feed', NOW(), ?)`,
      [p.text, p.photos, p.tags, p.richText],
    );
    ids.push(result.insertId);
    console.log("created", result.insertId, p.text.slice(0, 60));
  }

  const [rows] = await conn.query(
    `SELECT id, text, JSON_LENGTH(photos) AS photoCount, richText IS NOT NULL AS hasRich
     FROM posts WHERE text LIKE ? ORDER BY id`,
    [`${MARKER}%`],
  );
  console.log("verify", rows);

  if (rows.length !== payloads.length) {
    throw new Error(`Expected ${payloads.length} test posts, got ${rows.length}`);
  }
} finally {
  for (const id of ids) {
    try {
      await conn.query("DELETE FROM likes WHERE postId = ?", [id]);
      await conn.query("DELETE FROM saved_posts WHERE postId = ?", [id]);
      await conn.query("DELETE FROM post_media WHERE postId = ?", [id]);
      await conn.query("DELETE FROM post_comments WHERE postId = ?", [id]);
      await conn.query("DELETE FROM posts WHERE id = ?", [id]);
      console.log("deleted", id);
    } catch (err) {
      console.error("delete failed for", id, err.message);
    }
  }
  try {
    await conn.end();
  } catch {
    // ignore
  }
}

console.log("OK: test posts created, verified, removed");
