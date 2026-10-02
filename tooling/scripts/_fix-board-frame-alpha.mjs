import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "apps", "frontend", "assets", "images", "moodboard", "board-frame-alpha.png");

function isBackground(r, g, b, a, threshold = 48) {
  if (a < 8) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max < threshold && max - min < 24;
}

function floodBackground(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (!isBackground(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    visited[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    data[p * 4 + 3] = 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

const input = path.join(root, "apps", "frontend", "assets", "images", "moodboard", "board-frame.png");
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
floodBackground(data, info.width, info.height);

await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(out);

let t = 0;
for (let i = 3; i < data.length; i += 4) if (data[i] < 20) t++;
console.log("saved", out, `${info.width}x${info.height}`, "transparent", t);
