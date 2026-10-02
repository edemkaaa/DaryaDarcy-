import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

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

const files = [
  "folder-summer.png",
  "folder-autumn.jpg",
  "folder-winter.png",
  "folder-spring.png",
];

async function knockOutDark(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < 35 && g < 35 && b < 35) data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

for (const name of files) {
  const local = path.join(root, "apps", "frontend", "assets", "images", "moodboard", name);
  const buf = fs.readFileSync(local);
  const out = await knockOutDark(buf);
  const key = `app-assets/moodboard/ui/${name.replace(/\.(png|jpg|jpeg)$/i, ".webp")}`;
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: out,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  fs.writeFileSync(local.replace(/\.(png|jpg)$/i, "-alpha.webp"), out);
  console.log(key, out.length);
}
