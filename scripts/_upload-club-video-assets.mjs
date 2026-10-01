import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const tmpDir = path.join(root, ".tmp-media");
fs.mkdirSync(tmpDir, { recursive: true });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const filmUrl =
  "https://downloader.disk.yandex.ru/disk/b8e946723a587003a94ed38ac4afd0e263cdfff1b6d9f3fc2318beb8f8e36e5c/6a8866bc/A4uQ1O2BtrDUheJA2S2k8fiD_piOXb8dqtdd1_sTY2tDpLL890LHaKoEcV6kxAieZHvE2G2Z_wmkBgbjEO563g%3D%3D?uid=0&filename=IMG_6468.png&disposition=attachment&hash=&limit=0&content_type=image%2Fpng&owner_uid=0&fsize=1632351&hid=4642ff08a42e43aab863a9d7c7a85af9&media_type=image&tknv=v3&is_direct_zip_experiment=1&etag=d8d1def5b705023d480435c2a38fb0b9";

const rosePreviewUrl =
  "https://downloader.disk.yandex.ru/preview/f6d501a382890eb49193cc81be717b35945aabc40ec0f340ae9a4d2836867bec/6a8866bc/A4uQ1O2BtrDUheJA2S2k8fe9kvegSK1RGJ5n1itDXfXQYDKcEkYWstgs6tog6wJn2Dlfe8A9WXqu2N4sfLTuiw%3D%3D?uid=0&filename=%D1%88%D0%B8%D0%BF%D0%BE%D0%B2%D0%BD%D0%B8%D0%BA.png&disposition=inline&hash=&limit=0&content_type=image%2Fjpeg&owner_uid=0&tknv=v3&is_direct_zip_experiment=1&size=XL&crop=0";

const musicUrl =
  "https://downloader.disk.yandex.ru/disk/4e40fe75a2c62eea65b2c0962236f09d0b811febed436d72153a3d8f90bfaa82/6a8866bc/A4uQ1O2BtrDUQpe8cuPSIQpP43YnrgnievcXNK1fon632JoCCqUtJHQ%3D%3D?uid=0&filename=Rural%20Autumn%20Ambience%20and%20Music%20%F0%9F%8E%83%20cozy%20autumn%20village%20ambience%20with%20positive%20ambient%20music%20-%20Martia%27s%20Muses.mp3&disposition=attachment&hash=&limit=0&content_type=audio%2Fmpeg&owner_uid=0&fsize=148910576&hid=254dec47893908a5c00bb9c1cb643415&media_type=audio&tknv=v3&is_direct_zip_experiment=1&etag=f03bf10e2c30c8b1d8c5d40d5d7dc7ab";

// Fix music URL from API response
const musicUrlFixed =
  "https://downloader.disk.yandex.ru/disk/4e40fe75a2c62eea65b2c0962236f09d0b811febed436d72153a3d8f90bfaa82/6a8866bc/A4uQ1O2BtrDUheJA2S2k8fW-52xyS-HqpL3Fur-G5QiQpe8cuPSIQpP43YnrgnievcXNK1fon632JoCCqUtJHQ%3D%3D?uid=0&filename=Rural%20Autumn%20Ambience%20and%20Music%20%F0%9F%8E%83%20cozy%20autumn%20village%20ambience%20with%20positive%20ambient%20music%20-%20Martia%27s%20Muses.mp3&disposition=attachment&hash=&limit=0&content_type=audio%2Fmpeg&owner_uid=0&fsize=148910576&hid=254dec47893908a5c00bb9c1cb643415&media_type=audio&tknv=v3&is_direct_zip_experiment=1&etag=f03bf10e2c30c8b1d8c5d40d5d7dc7ab";

const files = [
  { url: filmUrl, file: path.join(tmpDir, "film-strip.png"), key: "app-assets/videos/film-strip.png", type: "image/png" },
  { url: rosePreviewUrl, file: path.join(tmpDir, "rose-hip-branches.jpg"), key: "app-assets/videos/rose-hip-branches.jpg", type: "image/jpeg" },
  { url: musicUrlFixed, file: path.join(tmpDir, "club-ambient.mp3"), key: "app-assets/club/club-ambient.mp3", type: "audio/mpeg" },
];

for (const item of files) {
  console.log("Downloading", item.key, "...");
  const size = await download(item.url, item.file);
  console.log("  downloaded", size, "bytes");
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
  console.log("  uploaded", item.key);
}

console.log("done");
