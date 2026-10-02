import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "apps", "frontend", "assets");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAD/2Q==",
  "base64",
);

function writeIfMissing(rel, buf) {
  const full = path.join(assets, rel);
  if (fs.existsSync(full) && fs.statSync(full).size > 100) return false;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  return true;
}

const list = fs
  .readFileSync(path.join(root, "scripts/missing-local-assets.txt"), "utf8")
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

let created = 0;
for (const rel of list) {
  if (rel.endsWith(".ttf")) continue;
  const buf = rel.toLowerCase().endsWith(".jpg") || rel.toLowerCase().endsWith(".jpeg") ? JPG : PNG;
  if (writeIfMissing(rel, buf)) created++;
}

const icons = [
  "images/icon.png",
  "images/favicon.png",
  "images/splash-icon.png",
  "images/android-icon-foreground.png",
  "images/android-icon-background.png",
  "images/android-icon-monochrome.png",
];
for (const rel of icons) {
  if (writeIfMissing(rel, PNG)) created++;
}

console.log(`placeholders created: ${created}`);
