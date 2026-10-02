import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { isTaggedClubMessage } from "../apps/frontend/lib/telegram-post-tags.mjs";
import { buildAlbumGroups } from "../apps/frontend/lib/telegram-albums.mjs";

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

const data = JSON.parse(fs.readFileSync("C:/Users/Иван/Downloads/result 2.json", "utf8"));
const msgs = data.messages.filter((m) => m.type === "message");
const { absorbedBy } = buildAlbumGroups(msgs);
const progress = JSON.parse(fs.readFileSync(path.join(root, ".tmp-telegram-import.json"), "utf8"));
const imported = new Set(progress.importedIds);

const remaining = [];
for (const m of msgs) {
  if (imported.has(m.id) || absorbedBy.has(m.id)) continue;
  if (!isTaggedClubMessage(m)) continue;
  remaining.push({
    id: m.id,
    date: m.date,
    file_name: m.file_name,
    media: m.media_type,
    duration_min: m.duration_seconds ? Math.round(m.duration_seconds / 60) : null,
    hasFileOnDiskHint: Boolean(m.file_name && !String(m.file).includes("not included") ? false : m.file_name),
  });
}

const voiceMissing = msgs.filter(
  (m) => m.media_type === "voice_message" && String(m.file).includes("not included"),
);
const taggedTotal = msgs.filter(isTaggedClubMessage).length;

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT
    COUNT(*) AS tgTotal,
    SUM(target = 'club') AS clubTotal,
    SUM(JSON_LENGTH(tags) > 0) AS withTags
  FROM posts WHERE source = 'telegram'
`);
await conn.end();

console.log(
  JSON.stringify(
    {
      export: "result 2.json (23.08.2026)",
      messagesInExport: msgs.length,
      taggedPostsInExport: taggedTotal,
      importedIdsInProgress: imported.size,
      db: rows[0],
      taggedRemaining: remaining.length,
      remaining,
      voiceMissingInExport: voiceMissing.map((m) => ({
        id: m.id,
        date: m.date,
        file_name: m.file_name,
        duration_min: m.duration_seconds ? Math.round(m.duration_seconds / 60) : null,
        tagged: isTaggedClubMessage(m),
      })),
    },
    null,
    2,
  ),
);
