import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import {
  buildTelegramPostContent,
  isTaggedClubMessage,
  resolveRubricTags,
} from "../lib/telegram-post-tags.mjs";
import { buildAlbumGroups } from "../lib/telegram-albums.mjs";

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

const RESULT_JSON = process.env.TG_RESULT_JSON || "C:/Users/Иван/Downloads/result 2.json";
const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
const msgs = data.messages.filter((m) => m.type === "message");
const { absorbedBy, albumPhotos } = buildAlbumGroups(msgs);
const progress = fs.existsSync(path.join(root, ".tmp-telegram-import.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, ".tmp-telegram-import.json"), "utf8"))
  : { importedIds: [] };
const imported = new Set(progress.importedIds);

const tagCounts = {};
for (const m of msgs) {
  if (!isTaggedClubMessage(m)) continue;
  const { tags } = buildTelegramPostContent(m);
  for (const t of tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
}

const remaining = [];
for (const m of msgs) {
  if (imported.has(m.id) || absorbedBy.has(m.id)) continue;
  if (!isTaggedClubMessage(m)) continue;
  remaining.push({
    id: m.id,
    date: m.date,
    file_name: m.file_name || null,
    media: m.media_type || null,
    tags: buildTelegramPostContent(m).tags,
  });
}

const untaggedTotal = msgs.filter((m) => !isTaggedClubMessage(m)).length;
const voiceMissing = msgs.filter(
  (m) => m.media_type === "voice_message" && String(m.file).includes("not included"),
);
const videoMissingExport = msgs.filter(
  (m) => m.media_type === "video_file" && String(m.file).includes("not included"),
).length;

const conn = await mysql.createConnection(env.DATABASE_URL);
const [dbStats] = await conn.query(`
  SELECT
    COUNT(*) AS total,
    SUM(target = 'club') AS club,
    SUM(JSON_LENGTH(tags) > 0) AS withTags,
    MIN(publishedAt) AS oldest,
    MAX(publishedAt) AS newest
  FROM posts WHERE source = 'telegram'
`);
const [tagDb] = await conn.query(`
  SELECT jt.tag, COUNT(*) AS cnt
  FROM posts p,
  JSON_TABLE(p.tags, '$[*]' COLUMNS(tag VARCHAR(64) PATH '$')) jt
  WHERE p.source = 'telegram'
  GROUP BY jt.tag
  ORDER BY cnt DESC
`);
const [mediaStats] = await conn.query(`
  SELECT pm.type, COUNT(*) AS cnt
  FROM post_media pm
  JOIN posts p ON p.id = pm.postId
  WHERE p.source = 'telegram'
  GROUP BY pm.type
`);
const [recent] = await conn.query(`
  SELECT instagramId, publishedAt, tags, JSON_LENGTH(photos) AS photoCount
  FROM posts
  WHERE source = 'telegram'
  ORDER BY publishedAt DESC
  LIMIT 5
`);
await conn.end();

console.log(
  JSON.stringify(
    {
      export: {
        file: path.basename(RESULT_JSON),
        edited: data.personal_information ? undefined : data.name,
        totalMessages: msgs.length,
        taggedInExport: msgs.filter(isTaggedClubMessage).length,
        untaggedInExport: untaggedTotal,
        voiceMissingFileInExport: voiceMissing.length,
        videoMissingFileInExport: videoMissingExport,
        tagCountsInExport: tagCounts,
      },
      import: {
        progressIds: imported.size,
        dbPosts: dbStats[0],
        dbTags: tagDb,
        dbMedia: mediaStats,
        taggedRemaining: remaining.length,
        remainingPosts: remaining,
        voiceMissingDetails: voiceMissing.map((m) => ({
          id: m.id,
          date: m.date,
          file_name: m.file_name,
          tagged: isTaggedClubMessage(m),
        })),
        lastImported: recent,
      },
      infrastructure: {
        yandexDisk: "https://disk.yandex.ru/d/zW0PCeuErNdIAg",
        mediaCache: ".tmp-telegram-media/",
        progressFile: ".tmp-telegram-import.json",
      },
    },
    null,
    2,
  ),
);
