/**
 * Optimize bundled assets/ images (quiz, home, results).
 * PNG → WebP when >40% smaller; JPG recompressed in-place.
 *
 * Usage: node scripts/optimize-local-assets.mjs [--dry-run] [--min-kb=180]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = path.join(root, "apps", "frontend", "assets");
const SKIP_BASENAMES = new Set([
  "icon.png",
  "splash-icon.png",
  "android-icon-foreground.png",
  "android-icon-background.png",
  "android-icon-monochrome.png",
]);
const dryRun = process.argv.includes("--dry-run");
const minKb = Number(process.argv.find((a) => a.startsWith("--min-kb="))?.split("=")[1] ?? 120);
const skipDir = /node_modules|\.git|web-dist/;

/** @type {{ from: string; to: string }[]} */
const pathMap = [];
let saved = 0;
let count = 0;

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (name) => {
      const full = path.join(dir, name.name);
      if (skipDir.test(full)) return;
      if (name.isDirectory()) await walk(full);
      else await processFile(full);
    }),
  );
}

async function processFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return;
  if (SKIP_BASENAMES.has(path.basename(file))) return;

  const stat = fs.statSync(file);
  if (stat.size < minKb * 1024) return;

  const bytes = fs.readFileSync(file);
  const rel = path.relative(root, file).replace(/\\/g, "/");

  if (ext === ".jpg" || ext === ".jpeg") {
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    if (out.length >= bytes.length * 0.95) return;
    console.log(`${dryRun ? "[dry] " : ""}${rel}: ${(bytes.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB`);
    if (!dryRun) fs.writeFileSync(file, out);
    saved += bytes.length - out.length;
    count++;
    return;
  }

  // PNG
  const pngOut = await sharp(bytes)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  const webpOut = await sharp(bytes)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();

  const useWebp = webpOut.length < pngOut.length * 0.6;
  const out = useWebp ? webpOut : pngOut;
  if (out.length >= bytes.length * 0.95) return;

  const outPath = useWebp ? file.replace(/\.png$/i, ".webp") : file;
  const outRel = path.relative(root, outPath).replace(/\\/g, "/");

  console.log(
    `${dryRun ? "[dry] " : ""}${rel}: ${(bytes.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB${useWebp ? " (webp)" : ""}`,
  );

  if (!dryRun) {
    fs.writeFileSync(outPath, out);
    if (useWebp) {
      fs.unlinkSync(file);
      pathMap.push({ from: rel, to: outRel });
    }
  } else if (useWebp) {
    pathMap.push({ from: rel, to: outRel });
  }

  saved += bytes.length - out.length;
  count++;
}

await walk(assetsDir);

if (pathMap.length && !dryRun) {
  const codeExt = new Set([".ts", ".tsx", ".js"]);
  const skip = /node_modules|web-dist|\.git/;
  let changed = 0;

  function walkCode(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (skip.test(full)) continue;
      if (name.isDirectory()) walkCode(full);
      else if (codeExt.has(path.extname(name.name))) {
        let text = fs.readFileSync(full, "utf8");
        let hit = false;
        for (const { from, to } of pathMap) {
          const fromBase = path.basename(from);
          const toBase = path.basename(to);
          if (text.includes(fromBase)) {
            text = text.split(fromBase).join(toBase);
            hit = true;
          }
        }
        if (hit) {
          fs.writeFileSync(full, text);
          changed++;
          console.log("updated ref", path.relative(root, full));
        }
      }
    }
  }

  walkCode(root);
  console.log(`Updated ${changed} source file(s) for webp paths`);
}

console.log(`\nDone: ${count} local assets, saved ~${(saved / 1024 / 1024).toFixed(1)} MB${dryRun ? " (dry run)" : ""}`);
