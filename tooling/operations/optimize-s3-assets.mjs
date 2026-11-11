// Прежний оптимизатор может перезаписывать JPEG по тому же S3-ключу и создавать WebP-соседей. Перед применением нужны оригиналы, карта ссылок и отдельное разрешение.
/**
 * Optimize heavy S3 images referenced in the codebase.
 * JPG/JPEG: re-upload optimized in-place (same key).
 * Large PNG: upload .webp sibling + write url-map for code updates.
 *
 * Usage: node tooling/operations/optimize-s3-assets.mjs [--dry-run] [--min-kb=200]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const minKb = Number(process.argv.find((a) => a.startsWith("--min-kb="))?.split("=")[1] ?? 200);

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

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});

const S3_PREFIX = "https://s3.twcstorage.ru/daryadarcy-s3/";
const codeExt = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html"]);
const skipDir = /node_modules|web-dist|\.git|\.tmp-/;

/** @type {Set<string>} */
const urls = new Set();

function walkCode(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (skipDir.test(full)) continue;
    if (name.isDirectory()) walkCode(full);
    else if (codeExt.has(path.extname(name.name))) {
      const text = fs.readFileSync(full, "utf8");
      for (const m of text.matchAll(/https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/[^\s"'`)]+/g)) {
        const u = m[0].replace(/[),.;]+$/, "");
        if (/\.(png|jpg|jpeg|webp|PNG|JPG|JPEG)(\?|$)/.test(u)) urls.add(u);
      }
    }
  }
}

walkCode(root);

/** Per-asset max display width (px @2x retina). */
const widthHints = [
  { match: /d0db18ed8f2e-MasrlKbgCBdeyOhE/, width: 1600 }, // paper texture
  { match: /c2a4341558e8-dZtWbRtaJLWFOYGX/, width: 1400 }, // tag board
  { match: /ed5c0d6e67b1-XTxEeqUQaizDpkGL/, width: 1400 }, // shop shelf
  { match: /film-strip/, width: 1200 },
  { match: /rose-hip/, width: 800 },
  { match: /cc53a49e1416|597ab82580a0|6ac128a122fc|7e8f673737d1|8283ecb861ab/, width: 640 }, // tab banners
  { match: /51246f8b81ec|43aa6a138c7a|f6dc8eaf6752|e933a044db55/, width: 900 }, // hero
  { match: /banner-shelf/, width: 800 },
  { match: /cover\.png|book-\d|digital|priceTag|labelFrame|\.PNG$|\.png$/, width: 900 },
  { match: /9e3aec1f0a5d/, width: 1000 }, // club hero
];

function hintWidth(url) {
  for (const h of widthHints) if (h.match.test(url)) return h.width;
  return 1200;
}

async function optimize(url, bytes) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const img = sharp(bytes).rotate();
  const meta = await img.metadata();
  const maxW = Math.min(hintWidth(url), meta.width ?? 9999);

  if (ext === ".jpg" || ext === ".jpeg") {
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: maxW, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return { out, contentType: "image/jpeg", newUrl: url, inPlace: true };
  }

  if (ext === ".png") {
    const pngOut = await sharp(bytes)
      .rotate()
      .resize({ width: maxW, withoutEnlargement: true })
      .png({ compressionLevel: 9, effort: 10 })
      .toBuffer();
    const webpOut = await sharp(bytes)
      .rotate()
      .resize({ width: maxW, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90 })
      .toBuffer();

    if (webpOut.length < pngOut.length * 0.65) {
      const newUrl = url.replace(/\.png$/i, ".webp");
      return { out: webpOut, contentType: "image/webp", newUrl, inPlace: false };
    }
    return { out: pngOut, contentType: "image/png", newUrl: url, inPlace: true };
  }

  if (ext === ".webp") {
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: maxW, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { out, contentType: "image/webp", newUrl: url, inPlace: true };
  }

  return null;
}

/** @type {{ from: string; to: string; before: number; after: number }[]} */
const urlMap = [];
let saved = 0;
let processed = 0;

for (const url of [...urls].sort()) {
  let headSize = 0;
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) continue;
    headSize = Number(head.headers.get("content-length") ?? 0);
    if (headSize < minKb * 1024) continue;
  } catch {
    continue;
  }

  const res = await fetch(url);
  if (!res.ok) continue;
  const bytes = Buffer.from(await res.arrayBuffer());
  const result = await optimize(url, bytes);
  if (!result) continue;

  const key = url.slice(S3_PREFIX.length);
  const newKey = result.newUrl.slice(S3_PREFIX.length);
  const pct = (((bytes.length - result.out.length) / bytes.length) * 100).toFixed(0);

  console.log(
    `${dryRun ? "[dry] " : ""}${path.basename(key)}: ${(bytes.length / 1024).toFixed(0)}KB → ${(result.out.length / 1024).toFixed(0)}KB (-${pct}%)${result.inPlace ? "" : " → webp"}`,
  );

  if (!dryRun) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: newKey,
        Body: result.out,
        ContentType: result.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  if (result.newUrl !== url) urlMap.push({ from: url, to: result.newUrl, before: bytes.length, after: result.out.length });
  saved += bytes.length - result.out.length;
  processed++;
}

if (urlMap.length && !dryRun) {
  const mapPath = path.join(root, "tooling", "data", ".s3-url-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(urlMap, null, 2));
  console.log(`\nWrote ${urlMap.length} URL changes to tooling/data/.s3-url-map.json — run: node tooling/data/apply-s3-url-map.mjs`);
}

console.log(`\nDone: ${processed} assets, saved ~${(saved / 1024 / 1024).toFixed(1)} MB${dryRun ? " (dry run)" : ""}`);
