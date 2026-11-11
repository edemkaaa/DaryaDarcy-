// Дополняет имена видео в выбранной БД по сохранённым данным. Переменная подключения должна быть проверена до ручного запуска.
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL || process.env.NEW_DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
const [result] = await conn.query(
  "UPDATE post_media SET filename = SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', -1), '?', 1) WHERE type = 'video' AND (filename IS NULL OR filename = '')",
);
await conn.end();
console.log(`backfill-video-filenames: updated ${result.affectedRows} rows`);
