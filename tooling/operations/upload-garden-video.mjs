// Загружает конкретные публичные ролик и постер главной в S3. Пишет по заданным ключам и не предназначен для клубных файлов.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const files = [
  { file: path.join(root, ".tmp-media", "secret-garden.mp4"), key: "app-assets/home/secret-garden.mp4", type: "video/mp4" },
  { file: path.join(root, ".tmp-media", "secret-garden.jpg"), key: "app-assets/home/secret-garden.jpg", type: "image/jpeg" },
];

for (const item of files) {
  const body = fs.readFileSync(item.file);
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: item.key,
      Body: body,
      ContentType: item.type,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000",
    }),
  );
  console.log(item.key, body.length);
}
