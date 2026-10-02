/**
 * Fix tags/text/richText for already-imported Telegram club posts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { buildTelegramPostContent } from "../../apps/frontend/lib/telegram-post-tags.mjs";

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

const RESULT_JSON = process.env.TG_RESULT_JSON || "C:/Users/Иван/Downloads/result 2.json";

async function main() {
  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const byId = new Map(data.messages.filter((m) => m.type === "message").map((m) => [m.id, m]));
  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [posts] = await conn.query(
    "SELECT id, instagramId, text, tags, richText FROM posts WHERE target = 'club' AND instagramId LIKE 'tg-%'",
  );

  let updated = 0;
  for (const post of posts) {
    const msgId = Number(String(post.instagramId).replace("tg-", ""));
    const msg = byId.get(msgId);
    if (!msg) continue;

    const { text, richText, tags } = buildTelegramPostContent(msg);
    const nextTags = JSON.stringify(tags);
    const nextRichText = richText ? JSON.stringify(richText) : null;
    const prevTagsRaw = post.tags;
    const prevTags = JSON.stringify(
      Array.isArray(prevTagsRaw) ? prevTagsRaw : JSON.parse(prevTagsRaw || "[]"),
    );
    if (post.text === text && prevTags === nextTags && (post.richText || null) === (nextRichText || null)) {
      continue;
    }

    await conn.query("UPDATE posts SET text = ?, tags = ?, richText = ? WHERE id = ?", [
      text,
      nextTags,
      nextRichText,
      post.id,
    ]);
    updated += 1;
    if (updated % 20 === 0) console.log("updated", updated, post.instagramId);
  }

  await conn.end();
  console.log(JSON.stringify({ total: posts.length, updated }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
