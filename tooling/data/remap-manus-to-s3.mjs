// Сопоставляет прежние CDN-ресурсы с ключами S3 и меняет локальные ссылки. Совпадение имени не подтверждает правильность файла без проверки результата.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
const bucket = env.S3_BUCKET;
const client = new S3Client({
  endpoint,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const MANUS_PREFIX =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663475213159/";

async function listKeys(prefix) {
  // Читает ключи S3 постранично только для сопоставления локальных ссылок, без записи в бакет.

  const keys = [];
  let token;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of res.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

function originalName(key) {
  // Убирает исторический префикс хеша для сопоставления ключа с исходным именем.

  const base = key.split("/").pop() || "";
  return base.replace(/^[0-9a-f]{8,}-/i, "");
}

function walk(dir, acc = []) {
  // Обходит только выбранные текстовые расширения, исключая служебные каталоги; замена ссылок затрагивает локальные исходники.

  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".expo") continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js)$/.test(name)) acc.push(full);
  }
  return acc;
}

const keys = await listKeys("app-assets/");
const byName = new Map();
for (const key of keys) {
  const orig = originalName(key);
  const url = `${endpoint}/${bucket}/${key}`;
  if (!byName.has(orig)) byName.set(orig, url);
  byName.set(orig.toLowerCase(), url);
}

function resolveFile(filename) {
  // Подбирает единственный известный ключ по имени с учётом регистра; неоднозначности требуют ручной проверки.

  return byName.get(filename) || byName.get(filename.toLowerCase()) || null;
}

const files = walk(root);
let replaced = 0;
const missing = new Set();

for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;

  text = text.replace(/\$\{CDN_BASE\}([A-Za-z0-9._-]+)/g, (m, filename) => {
    const url = resolveFile(filename);
    if (!url) {
      missing.add(filename);
      return m;
    }
    replaced++;
    return url;
  });

  text = text.replace(
    /https:\/\/files\.manuscdn\.com\/user_upload_by_module\/session_file\/310519663475213159\/([A-Za-z0-9._-]*)/g,
    (m, filename) => {
      if (!filename) {
        return m;
      }
      const url = resolveFile(filename);
      if (!url) {
        missing.add(filename);
        return m;
      }
      replaced++;
      return url;
    },
  );

  if (text.includes("const CDN_BASE") && !text.includes("${CDN_BASE}")) {
    text = text.replace(/\nconst CDN_BASE =\s*\n\s*"[^"]*";\n/g, "\n");
    text = text.replace(/\nconst CDN_BASE = "[^"]*";\n/g, "\n");
  }

  if (text !== before) fs.writeFileSync(file, text);
}

console.log("s3 keys", keys.length);
console.log("url replacements", replaced);
console.log("missing", [...missing]);
console.log(
  "manuscdn left",
  walk(root).filter((f) => fs.readFileSync(f, "utf8").includes("files.manuscdn.com")).length,
  "files",
);
