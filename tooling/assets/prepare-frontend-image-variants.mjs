/** Offline static assets only. Resize previews; never alter uploads or S3 objects. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontend = path.join(root, "apps/frontend");
const publicDir = path.join(frontend, "public");
const sourceDir = path.join(frontend, "src");
const manifestPath = path.join(frontend, "image-variants.json");
const write = process.argv.includes("--write");
const reuse = process.argv.includes("--reuse");
const cacheDir = process.argv.find((arg) => arg.startsWith("--cache-dir="))?.slice(12)
  ?? "/tmp/darcy-public-images-2026-10-06";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const imagePattern = /(?:https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/app-assets\/|\/assets\/)[^\s"'`<>)]*\.(?:jpe?g|png|webp|avif)/gi;
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }))).flat().sort();
}
const sources = new Map(await Promise.all((await walk(sourceDir))
  .filter((file) => !file.endsWith("/static-image-catalog.ts"))
  .map(async (file) => [file, await fs.readFile(file, "utf8")])));
const refs = new Set([...sources.values()].flatMap((text) => [...text.matchAll(imagePattern)].map((m) => m[0])));
// Include direct imports such as the home hero.
for (const text of sources.values()) {
  for (const m of text.matchAll(/public(\/assets\/[^"']+\.(?:jpe?g|png|webp|avif))/gi)) refs.add(m[1]);
}
const audit = JSON.parse(await fs.readFile(path.join(root, "tooling/data/frontend-audits/frontend-external-image-audit-2026-10-06.json"), "utf8"));
const external = new Map(audit.results.map((item) => [item.url, item]));
const previousOutputs = new Map(audit.results.filter((item) => item.output).map((item) => [item.output, item]));
const previous = await fs.readFile(manifestPath, "utf8").then(JSON.parse).catch((error) => {
  if (error.code === "ENOENT") return { images: [] };
  throw error;
});
// Re-runs retain original provenance after literals have been localized.
const previousByFull = new Map(previous.images.map((item) => [item.full, item]));
const zoomable = new Set();
const about = sources.get(path.join(sourceDir, "features/library/about-screen.content.ts"));
for (const m of about.split("export const PART_TITLES")[0].matchAll(imagePattern)) {
  if (!m[0].includes("d0db18ed8f2e")) zoomable.add(m[0]);
}
const patterns = sources.get(path.join(sourceDir, "features/library/patterns-screen.content.ts"));
for (const m of patterns.split("export const CHRISTMAS_PATTERNS")[1].split("export const LOSHADKA")[0].matchAll(imagePattern)) zoomable.add(m[0]);
const products = sources.get(path.join(sourceDir, "domain/product/catalog.ts"));
for (const block of products.matchAll(/(?:gallery|reviewImages):\s*\[([\s\S]*?)\]/g)) {
  for (const m of block[1].matchAll(imagePattern)) zoomable.add(m[0]);
}

const replacements = new Map();
const images = [];
const widths = [320, 640, 960, 1440]; // 480 CSS px frame, including 3x screens.
const outputDir = path.join(publicDir, "assets/responsive");
if (write) await fs.mkdir(outputDir, { recursive: true });
const existingNames = reuse ? await fs.readdir(outputDir).catch(() => []) : [];
for (const ref of [...refs].sort()) {
  const old = previousByFull.get(ref);
  const origin = old?.origin ?? previousOutputs.get(ref)?.url ?? ref;
  const item = external.get(origin);
  const original = await fs.readFile(item
    ? path.join(cacheDir, sha(origin) + ".source")
    : path.join(publicDir, origin));
  if (item && sha(original) !== item.originalSha256) throw new Error(`Original checksum mismatch: ${origin}`);
  const meta = await sharp(original).metadata();
  if ((meta.pages ?? 1) > 1) throw new Error(`Animated static asset needs a separate policy: ${origin}`);
  const size = meta.autoOrient ?? meta;
  const maxWidth = Math.min(size.width, 1440);
  const stem = path.basename(origin).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-");
  const variants = [];
  if (reuse && old) {
    for (const variant of old.variants) {
      if (sha(await fs.readFile(path.join(publicDir, variant.uri))) !== variant.sha256) {
        throw new Error(`Derivative checksum mismatch: ${variant.uri}`);
      }
      variants.push(variant);
    }
  } else for (const width of [...new Set([...widths.filter((w) => w < maxWidth), maxWidth])]) {
    // Lossless WebP encoding after resizing: no additional JPEG/WebP artifacts.
    const pipeline = () => sharp(original).autoOrient().resize({ width, withoutEnlargement: true }).toColourspace("srgb");
    let bytes;
    // Recover verified partial output after an interrupted offline run.
    const names = existingNames.filter((name) => name.startsWith(`${stem}.w${width}.`) && name.endsWith(".webp"));
    if (names.length) {
      const expected = sha(await pipeline().ensureAlpha().raw().toBuffer());
      for (const name of names) {
        const candidate = await fs.readFile(path.join(outputDir, name));
        if (!name.includes(sha(candidate).slice(0, 16))) continue;
        if (sha(await sharp(candidate).ensureAlpha().raw().toBuffer()) === expected) {
          bytes = candidate;
          break;
        }
      }
    }
    bytes ??= await pipeline().webp({ lossless: true, effort: 4 }).toBuffer();
    let ext = "webp";
    // A small original can be cheaper than another encoding at the same width.
    if (width === size.width && original.length <= bytes.length && (meta.orientation ?? 1) === 1 && (meta.bitsPerSample ?? 8) <= 8) {
      bytes = original;
      ext = meta.format === "jpeg" ? "jpg" : meta.format;
    }
    const uri = `/assets/responsive/${stem}.w${width}.${sha(bytes).slice(0, 16)}.${ext}`;
    if (write) await fs.writeFile(path.join(publicDir, uri), bytes);
    variants.push({ uri, width, bytes: bytes.length, sha256: sha(bytes) });
  }
  const canZoom = old?.zoomable ?? zoomable.has(ref);
  // Already compressed JPEG/WebP can be lighter even at a larger resolution.
  // Keep that option instead of forcing a heavier lossless resized encoding.
  if (size.width > maxWidth && original.length < variants.at(-1).bytes &&
      (meta.orientation ?? 1) === 1 && (meta.bitsPerSample ?? 8) <= 8) {
    const ext = meta.format === "jpeg" ? "jpg" : meta.format;
    const uri = `/assets/responsive/${stem}.w${size.width}.${sha(original).slice(0, 16)}.${ext}`;
    if (write) await fs.writeFile(path.join(publicDir, uri), original);
    variants.push({ uri, width: size.width, bytes: original.length, sha256: sha(original) });
  }
  // A preview must save transfer bytes. Drop encodings heavier than a larger
  // candidate (common for already efficient JPEG originals).
  const economical = variants.filter((variant, index) => {
    return !variants.slice(index + 1).some((larger) => larger.bytes <= variant.bytes);
  });
  variants.splice(0, variants.length, ...economical);
  let full = item ? variants.at(-1).uri : origin;
  if (item && canZoom) {
    // Detail viewers and printable patterns retain the exact original bytes.
    const ext = meta.format === "jpeg" ? "jpg" : meta.format;
    full = `/assets/responsive/${stem}.full.${sha(original).slice(0, 16)}.${ext}`;
    if (write) await fs.writeFile(path.join(publicDir, full), original);
  }
  // Reuse source bytes by URL too, avoiding duplicate copies of small originals.
  for (const variant of variants) {
    if (variant.sha256 === sha(original)) {
      if (!item) variant.uri = origin;
      else if (canZoom) variant.uri = full;
    }
  }
  if (full !== ref) replacements.set(ref, full);
  images.push({ origin, full, zoomable: canZoom, width: size.width, height: size.height,
    originalBytes: original.length, originalSha256: sha(original), variants });
  if (images.length % 50 === 0) console.log(`Prepared ${images.length}/${refs.size}`);
}
if (write) {
  for (const [file, original] of sources) {
    let text = original;
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    if (text !== original) await fs.writeFile(file, text);
  }
  await fs.writeFile(manifestPath, JSON.stringify({ version: 1, images }, null, 2) + "\n");
  // Remove only obsolete derivatives owned by this tool; keep source originals.
  const used = new Set(images.flatMap((item) => [item.full, ...item.variants.map((v) => v.uri)]));
  for (const file of await walk(outputDir)) {
    const uri = "/" + path.relative(publicDir, file);
    if (/\.(?:w\d+|full)\.[a-f0-9]{16}\.(?:jpg|png|webp|avif)$/.test(uri) && !used.has(uri)) await fs.unlink(file);
  }
}
console.log(JSON.stringify({ mode: write ? "applied" : "preview", images: images.length,
  localizedExternal: images.filter((i) => external.has(i.origin)).length,
  zoomable: images.filter((i) => i.zoomable).length,
  originalBytes: images.reduce((sum, i) => sum + i.originalBytes, 0),
  preview640Bytes: images.reduce((sum, i) => sum + i.variants.find((v) => v.width >= Math.min(640, i.width)).bytes, 0),
}, null, 2));
