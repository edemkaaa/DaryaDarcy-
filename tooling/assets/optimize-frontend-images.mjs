/** Lossless only. Preview by default; --write applies verified smaller files. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicDir = path.join(root, "apps/frontend/public");
const sourceDir = path.join(root, "apps/frontend/src");
const write = process.argv.includes("--write");
const reportPath = process.argv.find((arg) => arg.startsWith("--report="))?.slice(9);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }));
  return groups.flat().sort();
}

// Compare displayed, oriented RGBA pixels, including transparent pixels.
async function pixels(bytes) {
  return sharp(bytes).autoOrient().toColourspace("srgb").ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
}

const sources = new Map(await Promise.all((await walk(sourceDir))
  .filter((file) => !file.endsWith("/static-image-catalog.ts"))
  .map(async (file) => [file, await fs.readFile(file, "utf8")])));
const results = [];
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "darcy-lossless-"));
let jpegtranAvailable = true;
try { execFileSync("jpegtran", ["-version"], { stdio: "ignore" }); }
catch { jpegtranAvailable = false; }

for (const file of await walk(publicDir)) {
  if (!/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(file)) continue;
  const original = await fs.readFile(file);
  const meta = await sharp(original).metadata();
  const uri = "/" + path.relative(publicDir, file).split(path.sep).join("/");
  // Content-addressed derivatives must never be rewritten in place.
  if (uri.startsWith("/assets/responsive/")) continue;
  const result = { uri, width: meta.width, height: meta.height, format: meta.format,
    before: original.length, after: original.length, status: "unchanged",
    originalSha256: createHash("sha256").update(original).digest("hex") };
  if ((meta.pages ?? 1) > 1 || (meta.bitsPerSample ?? 8) > 8 || !["jpeg", "png", "webp"].includes(meta.format)) {
    result.status = "unsupported-preserved";
    results.push(result);
    continue;
  }
  const candidates = [];
  if (meta.format === "jpeg" && jpegtranAvailable) {
    // Huffman/progressive coding changes only; preserve DCT coefficients, ICC and EXIF.
    for (const progressive of [false, true]) {
      const output = path.join(tempDir, "candidate.jpg");
      execFileSync("jpegtran", ["-copy", "all", "-optimize", ...(progressive ? ["-progressive"] : []), "-outfile", output, file], { stdio: "ignore" });
      candidates.push({ bytes: await fs.readFile(output), file, uri });
    }
  } else if (meta.format === "png") {
    candidates.push({ bytes: await sharp(original).keepMetadata().png({ compressionLevel: 9, effort: 10, palette: false }).toBuffer(), file, uri });
  }
  // A lossless WebP may be smaller for drawings, but rarely for photographs.
  // Keep PNG icons compatible with manifest/apple-touch-icon consumers.
  if (["png", "webp"].includes(meta.format) && !/\/(?:icon|favicon)\.png$/.test(uri)) {
    const newUri = uri.replace(/\.png$/i, ".lossless.webp");
    if (newUri === uri || [...sources.values()].some((text) => text.includes(uri))) {
      candidates.push({ bytes: await sharp(original).keepMetadata().webp({ lossless: true, effort: 6 }).toBuffer(),
        file: file.replace(/\.png$/i, ".lossless.webp"), uri: newUri });
    }
  }
  candidates.sort((a, b) => a.bytes.length - b.bytes.length);
  let decoded;
  for (const candidate of candidates) {
    if (candidate.bytes.length >= original.length) continue;
    decoded ??= await pixels(original);
    const check = await pixels(candidate.bytes);
    if (decoded.info.width !== check.info.width || decoded.info.height !== check.info.height || !decoded.data.equals(check.data)) continue;
    result.after = candidate.bytes.length;
    result.status = "pixel-identical";
    result.output = candidate.uri;
    result.outputSha256 = createHash("sha256").update(candidate.bytes).digest("hex");
    result.rgbaSha256 = createHash("sha256").update(decoded.data).digest("hex");
    if (write) {
      await fs.writeFile(candidate.file, candidate.bytes);
      if (candidate.uri !== uri) {
        for (const [source, text] of sources) sources.set(source, text.replaceAll(uri, candidate.uri));
        // Retain the original PNG for older clients and external links.
      }
    }
    break;
  }
  if (meta.format === "jpeg" && !jpegtranAvailable) result.status = "jpegtran-unavailable";
  results.push(result);
  if (results.length % 40 === 0) console.log(`Checked ${results.length} images`);
}
if (write) {
  for (const [file, content] of sources) {
    if (content !== await fs.readFile(file, "utf8")) await fs.writeFile(file, content);
  }
}
const before = results.reduce((sum, item) => sum + item.before, 0);
const after = results.reduce((sum, item) => sum + item.after, 0);
const report = { mode: write ? "applied" : "preview", images: results.length,
  changed: results.filter((item) => item.status === "pixel-identical").length,
  before, after, saved: before - after, jpegtranAvailable, results };
if (reportPath) await fs.writeFile(path.resolve(root, reportPath), JSON.stringify(report, null, 2) + "\n");
await fs.rm(tempDir, { recursive: true, force: true });
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
