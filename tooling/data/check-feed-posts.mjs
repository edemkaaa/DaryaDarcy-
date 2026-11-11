// Исследует импортированные посты ленты и их поля в БД. Счётчики не подтверждают полноту исходного экспорта без отдельного сравнения.
import fs from "fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(
  "SELECT id, target, photos, tags, richText FROM posts WHERE published = 1 AND target IN ('feed', 'both') ORDER BY sortOrder LIMIT 30"
);

let issues = 0;
for (const r of rows) {
  let photos = r.photos;
  let tags = r.tags;
  let richText = r.richText;

  if (typeof photos === "string") {
    try {
      photos = JSON.parse(photos);
    } catch {
      console.log("BAD photos JSON", r.id);
      issues++;
      continue;
    }
  }
  if (typeof tags === "string") {
    try {
      tags = JSON.parse(tags);
    } catch {
      console.log("BAD tags JSON", r.id);
      issues++;
    }
  }
  if (!Array.isArray(photos)) {
    console.log("photos not array", r.id, typeof photos);
    issues++;
  }
  if (tags != null && !Array.isArray(tags)) {
    console.log("tags not array", r.id, typeof tags);
    issues++;
  }

  if (richText) {
    if (typeof richText === "string") {
      try {
        richText = JSON.parse(richText);
      } catch {
        console.log("BAD richText JSON", r.id);
        issues++;
        continue;
      }
    }
    if (!Array.isArray(richText)) {
      console.log("richText not array", r.id, typeof richText);
      issues++;
    } else {
      for (let i = 0; i < richText.length; i++) {
        const b = richText[i];
        if (!b || !Array.isArray(b.children)) {
          console.log("richText block missing children", r.id, i, b?.type);
          issues++;
        }
      }
    }
  }
}

const [all] = await conn.query(
  "SELECT id, text, photos, tags FROM posts WHERE published = 1 AND target IN ('feed', 'both')"
);
let nullText = 0;
let nullPhotos = 0;
let badPhotos = 0;
for (const r of all) {
  if (r.text == null) nullText++;
  if (r.photos == null) nullPhotos++;
  else {
    let ph = r.photos;
    if (typeof ph === "string") {
      try {
        ph = JSON.parse(ph);
      } catch {
        badPhotos++;
        continue;
      }
    }
    if (!Array.isArray(ph)) badPhotos++;
  }
}
console.log("Total feed posts", all.length);
console.log("null text", nullText, "null photos", nullPhotos, "bad photos", badPhotos);
console.log("Checked sample", rows.length, "posts,", issues, "issues");
await conn.end();
