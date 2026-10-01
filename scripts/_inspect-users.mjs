import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [users] = await conn.query(
  "SELECT id, email, name, role, LEFT(openId, 20) AS oid, createdAt FROM users ORDER BY id DESC LIMIT 30",
);
console.log("users", JSON.stringify(users, null, 2));
const [media] = await conn.query(
  "SELECT id, postId, type, filename, LEFT(url, 80) AS url FROM post_media ORDER BY id DESC LIMIT 40",
);
console.log("media", JSON.stringify(media, null, 2));
const [posts] = await conn.query(
  "SELECT id, target, LEFT(text, 80) AS text, published, status FROM posts ORDER BY id DESC LIMIT 25",
);
console.log("posts", JSON.stringify(posts, null, 2));
await conn.end();
