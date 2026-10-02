import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "apps", "frontend", "assets", "images", "moodboard");
fs.mkdirSync(outDir, { recursive: true });

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

const UI_DISK = "https://disk.yandex.ru/d/LHrZMBKItiPdiw";
const AUTUMN_DISK = "https://disk.yandex.ru/d/PKw6NoYl1hln8g";

async function listPublic(publicKey, dirPath = "") {
  const url = new URL("https://cloud-api.yandex.net/v1/disk/public/resources");
  url.searchParams.set("public_key", publicKey);
  url.searchParams.set("limit", "500");
  if (dirPath) url.searchParams.set("path", dirPath);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list failed ${dirPath}: ${res.status}`);
  return res.json();
}

async function walkPublic(publicKey, dirPath = "") {
  const node = await listPublic(publicKey, dirPath);
  const items = node._embedded?.items ?? [];
  const files = [];
  for (const item of items) {
    if (item.type === "file") files.push(item);
    else if (item.type === "dir") {
      files.push(...(await walkPublic(publicKey, item.path)));
    }
  }
  return files;
}

async function downloadFile(item) {
  const href = item.file || item.sizes?.find((s) => s.name === "ORIGINAL")?.url;
  if (!href) throw new Error(`no download url for ${item.name}`);
  const res = await fetch(href);
  if (!res.ok) throw new Error(`download failed ${item.name}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function safeName(name) {
  const map = {
    "лето.png": "folder-summer.png",
    "осень.JPG": "folder-autumn.jpg",
    "осень.jpg": "folder-autumn.jpg",
    "зима.png": "folder-winter.png",
    "весна.png": "folder-spring.png",
    "доска.png": "board-frame.png",
  };
  return map[name] ?? name.replace(/[^\w.-]+/g, "-").toLowerCase();
}

async function toWebp(buf, quality = 82) {
  return sharp(buf).webp({ quality }).toBuffer();
}

async function main() {
  console.log("Listing UI disk…");
  const uiFiles = await walkPublic(UI_DISK);
  console.log(
    "UI files:",
    uiFiles.map((f) => f.path),
  );

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "ru-1",
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });

  const uploaded = {};

  for (const item of uiFiles) {
    const localName = safeName(item.name);
    const localPath = path.join(outDir, localName);
    console.log(`Downloading ${item.name} → ${localName}`);
    let buf = await downloadFile(item);

    if (localName === "board-frame.png") {
      // PSD masquerading as PNG — use large preview JPEG instead
      const preview = item.sizes?.find((s) => s.name === "XL")?.url || item.preview;
      if (preview) {
        const res = await fetch(preview);
        buf = Buffer.from(await res.arrayBuffer());
      }
    }

    fs.writeFileSync(localPath, buf);

    let key = `app-assets/moodboard/ui/${localName.replace(/\.(png|jpg|jpeg)$/i, ".webp")}`;
    let body = buf;
    let contentType = "image/webp";

    if (/\.(png|jpg|jpeg)$/i.test(localName)) {
      body = await toWebp(buf);
    } else {
      key = `app-assets/moodboard/ui/${localName}`;
      contentType = item.mime_type || "application/octet-stream";
    }

    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
    uploaded[localName] = url;
    console.log("  uploaded", url, body.length);
  }

  console.log("\nListing autumn catalog disk…");
  const autumnFiles = await walkPublic(AUTUMN_DISK);
  console.log("Autumn files count:", autumnFiles.length);

  const catalog = [];
  let idx = 0;
  for (const item of autumnFiles) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(item.name)) continue;
    idx += 1;
    const id = `a${idx}`;
    const base = `${id}-${item.name.replace(/[^\w.-]+/g, "-").toLowerCase()}`;
    console.log(`Autumn ${item.name}`);
    let buf = await downloadFile(item);
    const meta = await sharp(buf).metadata();
    const aspect = (meta.width || 1) / (meta.height || 1);
    const cutout = /\.png$/i.test(item.name);

    let key = `app-assets/moodboard/autumn/${base.replace(/\.(png|jpg|jpeg)$/i, ".webp")}`;
    let body = await toWebp(buf, cutout ? 90 : 82);
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    const url = `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
    catalog.push({ id, uri: url, aspect, cutout });
    console.log("  ", url, `${meta.width}x${meta.height}`);
  }

  fs.writeFileSync(
    path.join(root, "apps", "frontend", "lib", "moodboard", "autumn-catalog.generated.json"),
    JSON.stringify(catalog, null, 2),
  );
  console.log("\nUploaded UI:", uploaded);
  console.log("Catalog entries:", catalog.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
