// Сверяет внешние публичные картинки и при явном разрешении сохраняет проверенные локальные копии меньшего размера. В S3 не записывает.
/** Audit public frontend images. --write vendors only verified lossless savings. No S3 writes. */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { optimizeLosslessPng } from "./lossless-png.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = path.join(root, "apps/frontend/src");
const publicDir = path.join(root, "apps/frontend/public");
const write = process.argv.includes("--write");
const argument = (name) => /* Читает только явную CLI-настройку указанного имени, не подгружая секретное окружение приложения. */ process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const cacheDir = argument("cache-dir") ?? await fs.mkdtemp(path.join(os.tmpdir(), "darcy-public-images-"));
const reportPath = argument("report") ?? "/tmp/darcy-external-image-audit.json";
const resumePath = argument("resume-report");
const downloadTimeout = Number(argument("download-timeout") ?? 30_000);
const attempts = Number(argument("attempts") ?? 3);
await fs.mkdir(cacheDir, { recursive: true });
const hash = (bytes) => /* Адресует сохранённый source и производные по точным байтам либо исходному URL для воспроизводимого продолжения аудита. */ createHash("sha256").update(bytes).digest("hex");
async function walk(dir) {
  // Собирает локальные исходники для извлечения публичных изображений и дальнейшей замены проверенных ссылок.

  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }))).flat().sort();
}
const sources = new Map(await Promise.all((await walk(sourceDir))
  .filter((file) => !file.endsWith("/static-image-catalog.ts"))
  .map(async (file) => [file, await fs.readFile(file, "utf8")])));
const urls = new Set();
const dynamicPatterns = new Set();
if (resumePath) {
  const previous = JSON.parse(await fs.readFile(path.resolve(root, resumePath), "utf8"));
  for (const item of previous.results) urls.add(item.url);
  for (const pattern of previous.dynamicPatterns) dynamicPatterns.add(pattern);
}
for (const text of sources.values()) {
  for (const match of text.matchAll(/https:\/\/[^\s"'`<>)]*\.(?:jpe?g|png|webp|gif|svg|avif)/gi)) {
    if (match[0].includes("${")) dynamicPatterns.add(match[0]);
    else if (match[0].startsWith("https://s3.twcstorage.ru/daryadarcy-s3/app-assets/")) urls.add(match[0]);
  }
}
async function download(url) {
  // Возобновляет чтение из собственного кеша либо ограниченно скачивает источник, сохраняя заголовки и время для отчёта.

  const key = hash(url);
  const file = path.join(cacheDir, key + ".source");
  const metadata = path.join(cacheDir, key + ".json");
  try {
    return { file, bytes: await fs.readFile(file), ...JSON.parse(await fs.readFile(metadata, "utf8")) };
  } catch { /* Explicit cache directory allows resuming this audit. */ }
  const started = Date.now();
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(downloadTimeout) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const info = { cacheControl: response.headers.get("cache-control"), etag: response.headers.get("etag"),
        downloadMs: Date.now() - started, fetchedAt: new Date().toISOString() };
      await fs.writeFile(file, bytes);
      await fs.writeFile(metadata, JSON.stringify(info));
      return { file, bytes, ...info };
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
async function pixels(bytes) {
  // Приводит source и кандидата к одинаковому ориентированному RGBA перед разрешением замены.

  return sharp(bytes).autoOrient().toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
let jpegtranAvailable = true;
try { execFileSync("jpegtran", ["-version"], { stdio: "ignore" }); }
catch { jpegtranAvailable = false; }
const results = [];
const replacements = new Map();
let index = 0;
const queue = [...urls].sort();
await Promise.all(Array.from({ length: 3 }, async () => {
  while (index < queue.length) {
    const url = queue[index++];
    const result = { url };
    try {
      const { bytes, file, ...headers } = await download(url);
      const meta = await sharp(bytes).metadata();
      Object.assign(result, headers, { before: bytes.length, after: bytes.length, width: meta.width,
        height: meta.height, format: meta.format, originalSha256: hash(bytes), status: "unchanged" });
      if ((meta.pages ?? 1) > 1 || ((meta.bitsPerSample ?? 8) > 8 && meta.format !== "png")) {
        result.status = "unsupported-preserved";
      } else {
        const candidates = [];
        if (meta.format === "jpeg" && jpegtranAvailable) {
          for (const progressive of [false, true]) {
            const output = file + ".jpg";
            execFileSync("jpegtran", ["-copy", "all", "-optimize", ...(progressive ? ["-progressive"] : []), "-outfile", output, file], { stdio: "ignore" });
            candidates.push({ bytes: await fs.readFile(output), ext: "jpg" });
          }
        } else if (meta.format === "png") {
          candidates.push({ bytes: (meta.bitsPerSample ?? 8) > 8
            ? optimizeLosslessPng(bytes)
            : await sharp(bytes).keepMetadata().png({ compressionLevel: 9, palette: false }).toBuffer(), ext: "png" });
        }
        if (["png", "webp"].includes(meta.format) && (meta.bitsPerSample ?? 8) <= 8) {
          candidates.push({ bytes: await sharp(bytes).keepMetadata().webp({ lossless: true, effort: 6 }).toBuffer(), ext: "webp" });
        }
        candidates.sort((a, b) => a.bytes.length - b.bytes.length);
        let decoded;
        for (const candidate of candidates) {
          // Avoid adding files/dependencies for negligible remote savings.
          if (bytes.length - candidate.bytes.length < Math.max(4096, bytes.length * 0.05)) continue;
          decoded ??= await pixels(bytes);
          const check = await pixels(candidate.bytes);
          if (decoded.info.width !== check.info.width || decoded.info.height !== check.info.height || !decoded.data.equals(check.data)) continue;
          if ((meta.bitsPerSample ?? 8) > 8) {
            const nativePixels = (data) => /* Дополнительно сравнивает 16-битные образцы; обычного RGBA8 недостаточно для доказательства сохранения глубины PNG. */ sharp(data).toColourspace("rgb16").raw({ depth: "ushort" }).toBuffer();
            if (!(await nativePixels(bytes)).equals(await nativePixels(candidate.bytes))) continue;
            const outputMeta = await sharp(candidate.bytes).metadata();
            if (outputMeta.bitsPerSample !== meta.bitsPerSample || !(meta.icc ?? Buffer.alloc(0)).equals(outputMeta.icc ?? Buffer.alloc(0))) continue;
            result.bitsPerSample = meta.bitsPerSample;
            result.nativeSamplesPreserved = true;
          }
          const sha = hash(candidate.bytes);
          const basename = path.basename(new URL(url).pathname, path.extname(new URL(url).pathname));
          const uri = `/assets/optimized/${basename}.${sha.slice(0, 16)}.${candidate.ext}`;
          Object.assign(result, { after: candidate.bytes.length, output: uri, outputSha256: sha,
            rgbaSha256: hash(decoded.data), status: "pixel-identical" });
          if (write) {
            await fs.mkdir(path.join(publicDir, "assets/optimized"), { recursive: true });
            await fs.writeFile(path.join(publicDir, uri), candidate.bytes);
            replacements.set(url, uri);
          }
          break;
        }
      }
    } catch (error) {
      result.status = "error";
      result.error = error.message;
      if (error.cause?.code) result.errorCode = error.cause.code;
      console.log(`Could not download ${url}: ${result.error}`);
    }
    results.push(result);
    if (results.length % 10 === 0) console.log(`Checked ${results.length}/${queue.length} external images`);
  }
}));
if (write) {
  for (const [file, original] of sources) {
    let text = original;
    for (const [url, uri] of replacements) text = text.replaceAll(url, uri);
    if (text !== original) await fs.writeFile(file, text);
  }
}
results.sort((a, b) => a.url.localeCompare(b.url));
const before = results.reduce((sum, item) => sum + (item.before ?? 0), 0);
const after = results.reduce((sum, item) => sum + (item.after ?? 0), 0);
const report = { mode: write ? "applied" : "preview", requested: queue.length,
  checked: results.filter((item) => item.status !== "error").length,
  changed: results.filter((item) => item.status === "pixel-identical").length,
  before, after, saved: before - after, dynamicPatterns: [...dynamicPatterns], jpegtranAvailable, results };
await fs.writeFile(path.resolve(root, reportPath), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
if (results.some((item) => item.status === "error")) process.exitCode = 1;
