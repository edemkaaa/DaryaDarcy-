// Нормализует только локальные статические изображения и сохраняет отчёт. Удалённые S3-объекты и медиа API не являются целями операции.
/** Normalize local static assets; API media and remote objects are never changed. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontend = path.join(root, "apps/frontend");
const publicDir = path.join(frontend, "public");
const manifestPath = path.join(frontend, "image-variants.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const iconUris = new Set(["/assets/images/icon.png", "/assets/images/favicon.png"]);
const pattern = /\/assets\/[^\s"'`<>)]*\.(?:jpe?g|png|webp|avif)/gi;

function isLosslessWebp(bytes) {
  if (bytes.toString("ascii", 8, 12) !== "WEBP") return false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    if (bytes.toString("ascii", offset, offset + 4) === "VP8L") return true;
    const length = bytes.readUInt32LE(offset + 4);
    offset += 8 + length + (length % 2);
  }
  return false;
}

async function walk(dir) {
  return (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }))).flat().sort();
}

export async function normalizeFrontendImages({ write = false, quality = 85 } = {}) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const files = (await walk(path.join(frontend, "src")))
    .filter((file) => !file.endsWith("/static-image-catalog.ts"));
  const sources = new Map(await Promise.all(files.map(async (file) => [file, await fs.readFile(file, "utf8")])));
  const refs = new Set([...sources.values()].flatMap((text) => [...text.matchAll(pattern)].map((m) => m[0])));
  for (const uri of iconUris) refs.add(uri);
  const images = manifest.images.filter((entry) => refs.has(entry.full) || entry.variants.some((v) => refs.has(v.uri)));
  const used = new Set([...refs, ...images.flatMap((entry) => [entry.full, ...entry.variants.map((v) => v.uri)])]);
  const protectedFull = new Set(images.filter((entry) => entry.zoomable).map((entry) => entry.full));
  const photoPreviews = new Set(images.filter((entry) => /\.jpe?g$/i.test(entry.origin))
    .flatMap((entry) => entry.variants.map((variant) => variant.uri)));
  const publicFiles = (await walk(path.join(publicDir, "assets"))).filter((file) => /\.(?:jpe?g|png|webp|avif)$/i.test(file));
  const conversions = new Map();
  const obsolete = [];
  const outputs = new Map();
  let before = 0;
  let after = 0;
  for (const file of publicFiles) {
    const uri = "/" + path.relative(publicDir, file).split(path.sep).join("/");
    const original = await fs.readFile(file);
    before += original.length;
    if (!used.has(uri)) {
      obsolete.push(file);
      continue;
    }
    const recompressPreview = uri.startsWith("/assets/responsive/") &&
      photoPreviews.has(uri) && !protectedFull.has(uri) && isLosslessWebp(original);
    if (iconUris.has(uri) || (uri.endsWith(".webp") && !recompressPreview)) {
      after += original.length;
      continue;
    }
    const meta = await sharp(original).metadata();
    if ((meta.pages ?? 1) > 1 || (meta.bitsPerSample ?? 8) > 8) {
      throw new Error(`Asset needs a separate conversion policy: ${uri}`);
    }
    const lossless = meta.format === "png" || meta.hasAlpha || protectedFull.has(uri);
    const pipeline = () => sharp(original).autoOrient().toColourspace("srgb");
    // Cache only by source bytes and encoder policy, never by a mutable URL.
    const cacheDir = path.join("/tmp", "daryadarcy-webp-conversions");
    await fs.mkdir(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, `${hash(original)}.${lossless ? "lossless" : quality}.webp`);
    let bytes = await fs.readFile(cacheFile).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!bytes) {
      bytes = await pipeline().webp({ lossless, quality, effort: 5 }).toBuffer();
      await fs.writeFile(cacheFile, bytes);
    }
    if (recompressPreview && bytes.length >= original.length) {
      after += original.length;
      continue;
    }
    const decoded = await sharp(bytes).metadata();
    const oriented = meta.autoOrient ?? meta;
    if (decoded.width !== oriented.width || decoded.height !== oriented.height || decoded.hasAlpha !== meta.hasAlpha) {
      throw new Error(`Dimensions or transparency changed: ${uri}`);
    }
    if (lossless) {
      const expected = await pipeline().ensureAlpha().raw().toBuffer();
      const actual = await sharp(bytes).ensureAlpha().raw().toBuffer();
      // RGB underneath fully transparent pixels is not displayed by browsers.
      for (let i = 0; i < expected.length; i += 4) {
        if (expected[i + 3] !== actual[i + 3] || (expected[i + 3] &&
            (expected[i] !== actual[i] || expected[i + 1] !== actual[i + 1] || expected[i + 2] !== actual[i + 2]))) {
          throw new Error(`Lossless pixel comparison failed: ${uri}`);
        }
      }
    }
    const sha256 = hash(bytes);
    const target = uri.startsWith("/assets/responsive/")
      ? uri.replace(/\.[a-f0-9]{16}\.[^.]+$/, `.${sha256.slice(0, 16)}.webp`)
      : uri.replace(/\.[^.]+$/, ".webp");
    const targetFile = path.join(publicDir, target);
    if (target === uri || !target.endsWith(".webp")) throw new Error(`Invalid output path: ${target}`);
    const existing = await fs.readFile(targetFile).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if ((existing && hash(existing) !== sha256) || (outputs.has(target) && outputs.get(target).sha256 !== sha256)) {
      throw new Error(`Output collision: ${target}`);
    }
    conversions.set(uri, { uri: target, bytes: bytes.length, sha256, lossless });
    outputs.set(target, { bytes, sha256 });
    after += bytes.length;
    if (write) await fs.writeFile(targetFile, bytes);
    if (conversions.size % 25 === 0) console.log(`Converted ${conversions.size} static images`);
  }
  // Share identical files too, including duplicates inherited from the old app.
  const canonical = new Map();
  let deduplicated = 0;
  const currentUris = new Set([...used].map((uri) => conversions.get(uri)?.uri ?? uri));
  for (const uri of [...currentUris].sort()) {
    if (iconUris.has(uri)) continue;
    const bytes = outputs.get(uri)?.bytes ?? await fs.readFile(path.join(publicDir, uri));
    const sha256 = hash(bytes);
    const first = canonical.get(sha256);
    if (first) {
      conversions.set(uri, { uri: first, bytes: bytes.length, sha256, lossless: true, deduplicated: true });
      after -= bytes.length;
      deduplicated++;
    } else canonical.set(sha256, uri);
  }
  const replace = (uri) => {
    while (conversions.has(uri)) uri = conversions.get(uri).uri;
    return uri;
  };
  let previewsCreated = 0;
  for (const entry of images) {
    entry.full = replace(entry.full);
    const full = outputs.get(entry.full)?.bytes ?? await fs.readFile(path.join(publicDir, entry.full));
    entry.fullBytes = full.length;
    entry.fullSha256 = hash(full);
    entry.variants = entry.variants.map((variant) => {
      const converted = conversions.get(variant.uri);
      return converted ? { ...variant, uri: replace(variant.uri), bytes: converted.bytes, sha256: converted.sha256 } : variant;
    });
    // Previously a cheap JPEG original could serve both a thumbnail and a
    // detail viewer. A lossless full WebP must not become the thumbnail.
    if (entry.zoomable && /\.jpe?g$/i.test(entry.origin) &&
        entry.variants.some((variant) => variant.uri === entry.full)) {
      entry.variants = entry.variants.filter((variant) => variant.uri !== entry.full);
      const maxWidth = Math.min(entry.width, 1440);
      for (const width of new Set([320, 640, 960, maxWidth].filter((w) => w <= maxWidth))) {
        if (entry.variants.some((variant) => variant.width === width)) continue;
        const bytes = await sharp(full).resize({ width, withoutEnlargement: true })
          .webp({ quality, effort: 5 }).toBuffer();
        const sha256 = hash(bytes);
        const stem = path.basename(entry.full).replace(/\.(?:full|w\d+)\.[a-f0-9]{16}\.webp$/, "");
        const uri = `/assets/responsive/${stem}.w${width}.${sha256.slice(0, 16)}.webp`;
        if (!outputs.has(uri)) {
          outputs.set(uri, { bytes, sha256 });
          after += bytes.length;
          previewsCreated++;
          if (write) await fs.writeFile(path.join(publicDir, uri), bytes);
        }
        entry.variants.push({ uri, width, bytes: bytes.length, sha256 });
      }
      entry.variants.sort((a, b) => a.width - b.width);
    }
  }
  // A previous interrupted run may have already written a valid output.
  const live = new Set([...refs].map(replace));
  for (const entry of images) for (const uri of [entry.full, ...entry.variants.map((v) => v.uri)]) live.add(uri);
  for (let index = obsolete.length - 1; index >= 0; index--) {
    const uri = "/" + path.relative(publicDir, obsolete[index]).split(path.sep).join("/");
    if (live.has(uri)) obsolete.splice(index, 1);
  }
  if (write) {
    for (const [file, original] of sources) {
      let text = original;
      for (const [from, to] of conversions) text = text.replaceAll(from, to.uri);
      if (text !== original) await fs.writeFile(file, text);
    }
    // original* fields retain source provenance; full* describes the delivered WebP.
    const uniqueImages = [...new Map(images.map((entry) => [entry.full, entry])).values()];
    await fs.writeFile(manifestPath, JSON.stringify({ ...manifest, format: "webp", photoQuality: quality, images: uniqueImages }, null, 2) + "\n");
    // Source references and manifest are switched before deleting their old files.
    for (const uri of conversions.keys()) await fs.unlink(path.join(publicDir, uri));
    for (const file of obsolete) await fs.unlink(file);
  }
  const report = { mode: write ? "applied" : "preview", converted: conversions.size,
    lossless: [...conversions.values()].filter((item) => item.lossless && !item.deduplicated).length,
    deduplicated,
    previewsCreated,
    removedUnused: obsolete.length, before, after, difference: after - before,
    conversions: Object.fromEntries(conversions), removed: obsolete.map((file) => path.relative(publicDir, file)) };
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await normalizeFrontendImages({ write: process.argv.includes("--write") });
  const reportPath = process.argv.find((arg) => arg.startsWith("--report="))?.slice(9);
  if (reportPath) await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, conversions: undefined, removed: undefined }, null, 2));
}
