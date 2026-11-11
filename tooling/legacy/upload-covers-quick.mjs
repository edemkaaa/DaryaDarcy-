// Заменяет три заранее заданных публичных ключа обложек из локальных файлов; расширение jpg не гарантирует JPEG-байты.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const uploads = [
  {
    file: path.join(root, "tooling/legacy/loshadka-cover-cropped.jpg"),
    key: "app-assets/library/loshadka-cover.jpg",
    type: "image/jpeg",
  },
  {
    file: path.join(root, ".tmp-media/secret-garden-poster-new.png"),
    key: "app-assets/home/secret-garden-poster.png",
    type: "image/png",
  },
  {
    file: path.join(root, ".tmp-media/secret-garden-poster-new.png"),
    key: "app-assets/home/secret-garden.jpg",
    type: "image/png",
  },
];

// Ниже начинается внешняя запись S3 по историческим фиксированным ключам; исходные объекты и ACL нужно проверить до запуска.
for (const item of uploads) {
  if (!fs.existsSync(item.file)) {
    console.log("SKIP missing", item.file);
    continue;
  }
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: item.key,
      Body: fs.readFileSync(item.file),
      ContentType: item.type,
      CacheControl: "public, max-age=3600",
    }),
  );
  console.log("OK", item.key);
}
