// Разрушительный исторический перенос может очистить целевые таблицы и переключить env; fallback не восстанавливает весь контент и аккаунты.
/**
 * Migrate all app data to Timeweb MySQL.
 *
 * 1) Try full copy from OLD_DATABASE_URL (TiDB)
 * 2) Fallback: schema + tags + feed from S3 + YouTube list + owner user
 *
 * Usage:
 *   node tooling/legacy/migrate-to-timeweb.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

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

const OLD_URL = env.OLD_DATABASE_URL || env.DATABASE_URL;
const NEW_URL = env.NEW_DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  throw new Error("OLD_DATABASE_URL/DATABASE_URL and NEW_DATABASE_URL are required");
}

const S3_BASE = `https://s3.twcstorage.ru/${env.S3_BUCKET}/`;

const TAGS = [
  ["spring", "Весна", "season", 1],
  ["summer", "Лето", "season", 2],
  ["autumn", "Осень", "season", 3],
  ["winter", "Зима", "season", 4],
  ["home", "Дом", "topic", 5],
  ["garden", "Сад", "topic", 6],
  ["outfits", "Образы", "topic", 7],
  ["video", "Видео", "topic", 8],
  ["recipes", "Рецепты", "topic", 9],
  ["styling", "Стилизации", "topic", 10],
  ["masterclass", "Мастер-классы", "topic", 11],
  ["travel", "Путешествия", "topic", 12],
  ["personal", "Личное", "topic", 13],
  ["podborki", "Подборки", "topic", 14],
  ["community", "Комьюнити", "topic", 15],
  ["exclusive", "Эксклюзив", "topic", 16],
  ["life", "Лайф", "topic", 17],
];

const TABLE_ORDER = [
  "users",
  "tags",
  "posts",
  "post_media",
  "videos",
  "likes",
  "saved_posts",
  "push_tokens",
  "pen_pal_profiles",
  "pen_pal_shown",
  "club_payments",
  "shop_purchases",
  "post_comments",
  "articles",
  "sms_codes",
];

function shortcodeToUnix(shortcode) {
  // Извлекает приблизительную дату Instagram по известной структуре shortcode, отклоняя неподходящий алфавит.

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = 0n;
  for (const char of shortcode) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) return null;
    id = id * 64n + BigInt(idx);
  }
  const ms = Number(id >> 23n) + 1314220021721;
  if (!Number.isFinite(ms) || ms < 1_000_000_000_000) return null;
  return Math.floor(ms / 1000);
}

async function connect(url, label) {
  // Открывает выбранную БД и возвращает null при ошибке; ошибка источника далее может включить неполное восстановление.

  try {
    // С этого места выбранная БД реально изменяется; текущая история и рабочее назначение автоматически не проверены.
    const conn = await mysql.createConnection(url);
    console.log(`${label}: connected`);
    return conn;
  } catch (error) {
    console.log(`${label}: FAIL`, error.message);
    return null;
  }
}

async function applySchema(conn) {
  // Применяет старый journal с исторического drizzle-пути и пропускает совпадения DDL; актуальную историю миграций не гарантирует.

  const journal = JSON.parse(
    fs.readFileSync(
      path.join(root, "packages/database/drizzle/meta/_journal.json"),
      "utf8",
    ),
  );
  for (const entry of journal.entries) {
    const raw = fs.readFileSync(path.join(root, "drizzle", `${entry.tag}.sql`), "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .flatMap((chunk) => chunk.split(/;\s*(?:\r?\n|$)/))
      .map((s) => s.trim().replace(/DEFAULT \(now\(\)\)/gi, "DEFAULT CURRENT_TIMESTAMP"))
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await conn.query(statement);
      } catch (error) {
        const msg = String(error?.message || error);
        if (
          msg.includes("Duplicate column") ||
          msg.includes("Duplicate key name") ||
          msg.includes("already exists")
        ) {
          continue;
        }
        throw error;
      }
    }
  }
  console.log("schema applied");
}

async function tableCount(conn, table) {
  // Считает строки разрешённой вызывающим кодом таблицы; -1 объединяет отсутствие таблицы и ошибки чтения.

  try {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    return Number(row.c);
  } catch {
    return -1;
  }
}

async function copyTable(oldConn, newConn, table) {
  // Читает всю старую таблицу в память и вставляет партиями по 100, преобразуя объектные поля в JSON.

  const [rows] = await oldConn.query(`SELECT * FROM \`${table}\``);
  if (!rows.length) {
    console.log(`  ${table}: 0 rows (skip)`);
    return 0;
  }
  const [cols] = await oldConn.query(`SHOW COLUMNS FROM \`${table}\``);
  const columns = cols.map((c) => c.Field);
  const colList = columns.map((c) => `\`${c}\``).join(", ");
  let copied = 0;
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    const values = batch.flatMap((row) =>
      columns.map((col) => {
        const val = row[col];
        if (val !== null && typeof val === "object" && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        return val;
      }),
    );
    await newConn.query(
      `INSERT INTO \`${table}\` (${colList}) VALUES ${placeholders}`,
      values,
    );
    copied += batch.length;
  }
  console.log(`  ${table}: ${copied} rows copied`);
  return copied;
}

async function copyAllFromOld(oldConn, newConn) {
  // Отключает FK-проверки и удаляет целевые таблицы перед копированием; это разрушительный исторический путь без общей транзакции.

  await newConn.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of TABLE_ORDER) {
    const existsOld = (await tableCount(oldConn, table)) >= 0;
    if (!existsOld) continue;
    await newConn.query(`DELETE FROM \`${table}\``);
    await copyTable(oldConn, newConn, table);
  }
  await newConn.query("SET FOREIGN_KEY_CHECKS=1");
}

async function seedTags(conn) {
  // Записывает фиксированный исторический словарь тегов, обновляя совпавшие slug.

  for (const [slug, label, category, sortOrder] of TAGS) {
    await conn.query(
      `INSERT INTO tags (slug, label, category, sortOrder)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label=VALUES(label), category=VALUES(category), sortOrder=VALUES(sortOrder)`,
      [slug, label, category, sortOrder],
    );
  }
  console.log(`tags seeded: ${TAGS.length}`);
}

async function seedOwner(conn) {
  // Создаёт/обновляет администратора по env; это реальная выдача роли, не сохранение действующих входов по умолчанию.

  const email = (env.OWNER_EMAIL || "daryadarcy19@gmail.com").toLowerCase();
  const openId = env.OWNER_OPEN_ID || `e_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
  const name = env.OWNER_NAME || "Дарья Левина";
  let passwordHash = null;
  if (env.OWNER_PASSWORD && env.OWNER_PASSWORD.length >= 8) {
    const { hashPassword } = await import("../../apps/backend/src/_core/password.ts");
    passwordHash = await hashPassword(env.OWNER_PASSWORD);
  }
  await conn.query(
    `INSERT INTO users (openId, name, email, loginMethod, passwordHash, role, lastSignedIn)
     VALUES (?, ?, ?, 'email', ?, 'admin', NOW())
     ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role='admin',
       passwordHash=COALESCE(VALUES(passwordHash), passwordHash)`,
    [openId, name, email, passwordHash],
  );
  console.log("owner user seeded");
}

async function importFeedFromS3(conn) {
  // Восстанавливает только фотографии Instagram по именам S3, создавая пустые тексты; исходные статьи и клуб так не восстановить.

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "ru-1",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  const groups = new Map();
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: "feed/",
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of res.Contents || []) {
      const key = obj.Key || "";
      const m = key.match(/^feed\/([^/]+)\/photo_(\d+)\.\w+$/i);
      if (!m) continue;
      const shortcode = m[1];
      const index = Number(m[2]);
      const url = S3_BASE + key;
      const modified = obj.LastModified ? new Date(obj.LastModified).getTime() : 0;
      if (!groups.has(shortcode)) {
        groups.set(shortcode, { photos: [], modified: 0 });
      }
      const g = groups.get(shortcode);
      g.photos[index - 1] = url;
      g.modified = Math.max(g.modified, modified);
    }
    token = res.NextContinuationToken;
  } while (token);

  const [[existing]] = await conn.query(
    "SELECT COUNT(*) AS c FROM posts WHERE source='instagram'",
  );
  if (Number(existing.c) > 0) {
    console.log(`feed S3: skip, already ${existing.c} instagram posts`);
    return;
  }

  const entries = [...groups.entries()].map(([shortcode, data]) => {
    const photos = data.photos.filter(Boolean);
    const ts = shortcodeToUnix(shortcode) ?? Math.floor(data.modified / 1000);
    return { shortcode, photos, ts };
  });

  entries.sort((a, b) => a.ts - b.ts);
  const maxTs = entries[entries.length - 1]?.ts || Math.floor(Date.now() / 1000);

  let imported = 0;
  for (const entry of entries) {
    if (!entry.photos.length) continue;
    const sortOrder = maxTs - entry.ts;
    const publishedAt = new Date(entry.ts * 1000);
    await conn.query(
      `INSERT INTO posts (text, photos, tags, source, instagramId, sortOrder, published, status, target, publishedAt)
       VALUES (?, ?, ?, 'instagram', ?, ?, 1, 'published', 'feed', ?)`,
      ["", JSON.stringify(entry.photos), JSON.stringify([]), entry.shortcode, sortOrder, publishedAt],
    );
    imported += 1;
  }
  console.log(`feed S3: imported ${imported} posts from ${groups.size} shortcodes`);
}

async function importVideos(conn) {
  // Добавляет опубликованные старые YouTube-записи из JSON через INSERT IGNORE; нынешний VK-каталог здесь не поддерживается.

  const file = path.join(root, "tooling/data/youtube-videos.json");
  if (!fs.existsSync(file)) return;
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  let imported = 0;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (!v.id || !v.title) continue;
    const [res] = await conn.query(
      `INSERT IGNORE INTO videos (youtubeId, title, duration, thumbnailUrl, sortOrder, published)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        v.id,
        String(v.title).slice(0, 512),
        v.duration || null,
        v.thumbnail || `https://daryadarcy.com/media/yt-thumb/${v.id}/hqdefault.jpg`,
        i,
      ],
    );
    if (res.affectedRows) imported += 1;
  }
  console.log(`videos: imported ${imported}/${list.length}`);
}

async function report(conn, label) {
  // Печатает только счётчики выбранных таблиц; равенство чисел не доказывает полноту или целостность переноса.

  const summary = {};
  for (const table of ["users", "tags", "posts", "post_media", "videos", "articles", "post_comments"]) {
    summary[table] = await tableCount(conn, table);
  }
  console.log(label, summary);
}

async function updateEnvDatabaseUrl(newUrl) {
  // Переписывает локальное подключение приложения на новую БД; это фактическое переключение после переноса.

  const envPath = path.join(root, ".env");
  let text = fs.readFileSync(envPath, "utf8");
  if (!text.includes("OLD_DATABASE_URL=") && text.includes("DATABASE_URL=")) {
    const oldLine = text.match(/^DATABASE_URL=.*$/m)?.[0];
    if (oldLine && oldLine.includes("tidbcloud")) {
      text = `OLD_DATABASE_URL=${oldLine.slice("DATABASE_URL=".length)}\n${text}`;
    }
  }
  if (text.match(/^DATABASE_URL=.*$/m)) {
    text = text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${newUrl}`);
  } else {
    text += `\nDATABASE_URL=${newUrl}\n`;
  }
  if (!text.includes("NEW_DATABASE_URL=")) {
    text += `NEW_DATABASE_URL=${newUrl}\n`;
  } else {
    text = text.replace(/^NEW_DATABASE_URL=.*$/m, `NEW_DATABASE_URL=${newUrl}`);
  }
  fs.writeFileSync(envPath, text);
  console.log(".env updated (DATABASE_URL -> Timeweb MySQL)");
}

async function main() {
  // Выбирает полный разрушительный перенос либо неполный fallback, затем переключает env; не использовать как современное восстановление.

  console.log("=== migrate to Timeweb MySQL ===\n");

  const newConn = await connect(NEW_URL, "NEW");
  if (!newConn) process.exit(1);

  const postsBefore = await tableCount(newConn, "posts");
  if (postsBefore <= 0) {
    await applySchema(newConn);
  }

  const oldConn = await connect(OLD_URL, "OLD");
  if (oldConn) {
    console.log("\n-- full copy from OLD --");
    await copyAllFromOld(oldConn, newConn);
    await oldConn.end();
  } else {
    console.log("\n-- OLD unavailable, rebuilding from S3 + exports --");
    await seedTags(newConn);
    await seedOwner(newConn);
    await importFeedFromS3(newConn);
    await importVideos(newConn);
  }

  await report(newConn, "\nfinal counts:");
  await newConn.end();
  await updateEnvDatabaseUrl(NEW_URL);
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
