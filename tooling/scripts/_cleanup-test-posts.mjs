import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query("SELECT id FROM posts WHERE text LIKE '__cursor_test_post__%'");
for (const row of rows) {
  const id = row.id;
  await conn.query("DELETE FROM likes WHERE postId = ?", [id]);
  await conn.query("DELETE FROM saved_posts WHERE postId = ?", [id]);
  await conn.query("DELETE FROM post_media WHERE postId = ?", [id]);
  await conn.query("DELETE FROM post_comments WHERE postId = ?", [id]);
  await conn.query("DELETE FROM posts WHERE id = ?", [id]);
  console.log("deleted", id);
}
await conn.end();
console.log("done", rows.length);
