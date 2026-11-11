#!/usr/bin/env node
// Переносит согласованную музыку из Яндекс Диска в S3. Лицензия и целевой ключ проверяются оператором до внешней записи.
/** Download licensed club music from Yandex Disk and upload to S3. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_KEY = "https://disk.yandex.ru/d/2-3RIwTkLP-Q3w";
const API = "https://cloud-api.yandex.net/v1/disk/public/resources";
const MUSIC_PATH = "/MP3/Slava Onoprienko - Darcy's Autumn.mp3";
const S3_KEY = "app-assets/club/darcys-autumn.mp3";

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

async function publicMeta(filePath) {
  // Получает метаданные ровно указанного музыкального файла с публичного Яндекс Диска.

  const url = new URL(API);
  url.searchParams.set("public_key", PUBLIC_KEY);
  url.searchParams.set("path", filePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  // Скачивает согласованный трек, сохраняет локальную копию и публикует по фиксированному S3-ключу; повтор может заменить объект.

  const meta = await publicMeta(MUSIC_PATH);
  const href = meta.file;
  if (!href) throw new Error("No download href for music file");

  console.log("Downloading", meta.name, `(${(meta.size / 1024 / 1024).toFixed(1)} MB)...`);
  const res = await fetch(href);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());

  const tmp = path.join(root, ".tmp-media", "darcys-autumn.mp3");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, body);
  console.log("Saved locally", tmp, body.length, "bytes");

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "ru-1",
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: S3_KEY,
      Body: body,
      ContentType: "audio/mpeg",
      ACL: "public-read",
      CacheControl: "public, max-age=31536000",
    }),
  );

  const publicUrl = `https://s3.twcstorage.ru/${env.S3_BUCKET}/${S3_KEY}`;
  console.log("Uploaded:", publicUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
