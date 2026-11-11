// Публикует конкретную обложку «Лошадки» с серверного /tmp по фиксированному публичному ключу.
import fs from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const env = Object.fromEntries(
  fs
    .readFileSync("/var/www/daryadarcy/.env", "utf8")
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

const file = "/tmp/loshadka-cover.jpg";
const Body = fs.readFileSync(file);
const Key = "app-assets/library/loshadka-cover.jpg";
// Ниже начинается внешняя запись S3 по историческим фиксированным ключам; исходные объекты и ACL нужно проверить до запуска.
await client.send(
  new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key,
    Body,
    ContentType: "image/jpeg",
    ACL: "public-read",
    CacheControl: "public, max-age=31536000",
  }),
);
console.log(Key, Body.length);
