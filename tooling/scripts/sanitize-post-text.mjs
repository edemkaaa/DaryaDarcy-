/**
 * One-time cleanup: strip control chars from posts.text and normalize richText JSON.
 * Usage: node tooling/scripts/sanitize-post-text.mjs
 */
import mysql from "mysql2/promise";

function sanitizePlainPostText(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeRichTextForDisplay(value) {
  if (!Array.isArray(value)) return null;
  const blocks = value
    .filter((block) => block && typeof block === "object")
    .map((block) => ({
      type: block.type === "heading" ? "heading" : "paragraph",
      children: (Array.isArray(block.children) ? block.children : [])
        .filter((child) => child && typeof child === "object")
        .map((child) => ({
          text: String(child.text || "")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
            .replace(/\uFEFF/g, "")
            .replace(/\uFFFD/g, ""),
          ...(child.bold ? { bold: true } : {}),
          ...(child.italic ? { italic: true } : {}),
          ...(typeof child.link === "string" && child.link ? { link: child.link } : {}),
        }))
        .filter((child) => child.text.length > 0 || child.link),
    }))
    .filter((block) => block.children.length > 0);
  return blocks.length ? blocks : null;
}

const url = process.env.DATABASE_URL || process.env.NEW_DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
const [rows] = await conn.query("SELECT id, text, richText FROM posts");
let updated = 0;

for (const row of rows) {
  const cleanedText = sanitizePlainPostText(String(row.text || ""));
  let richText = row.richText;
  if (typeof richText === "string") {
    try {
      richText = JSON.parse(richText);
    } catch {
      richText = null;
    }
  }
  const cleanedRich = sanitizeRichTextForDisplay(richText);
  const textChanged = cleanedText !== row.text;
  const richChanged = JSON.stringify(cleanedRich) !== JSON.stringify(richText);
  if (!textChanged && !richChanged) continue;
  await conn.query("UPDATE posts SET text = ?, richText = ? WHERE id = ?", [
    cleanedText,
    cleanedRich ? JSON.stringify(cleanedRich) : null,
    row.id,
  ]);
  updated += 1;
}

await conn.end();
console.log(`sanitize-post-text: updated ${updated} posts`);
