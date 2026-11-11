// Заменяет фиксированный постер сада в S3: расширение ключа jpg исторически не совпадает с ContentType PNG.
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

const file = path.join(root, ".tmp-media", "secret-garden-poster-new.png");
const body = fs.readFileSync(file);
// Ниже начинается внешняя запись S3 по историческим фиксированным ключам; исходные объекты и ACL нужно проверить до запуска.
await client.send(
  new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: "app-assets/home/secret-garden.jpg",
    Body: body,
    ContentType: "image/png",
    ACL: "public-read",
    CacheControl: "public, max-age=3600",
  }),
);
console.log("uploaded secret-garden.jpg", body.length);
