import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "apps", "frontend", "assets", "images", "moodboard");

function knockOutBackground(data, width, height, threshold = 72) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const neutral = max - min < 18;
      if ((r < threshold && g < threshold && b < threshold && neutral) || (r < 20 && g < 20 && b < 20)) {
        data[i + 3] = 0;
      }
    }
  }
}

async function toTransparentPng(inputName, outputName, threshold) {
  const input = path.join(outDir, inputName);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockOutBackground(data, info.width, info.height, threshold);
  const out = path.join(outDir, outputName);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(out);
  console.log("wrote", outputName, info.width + "x" + info.height);
}

await toTransparentPng("folder-autumn.jpg", "folder-autumn.png", 85);
await toTransparentPng("board-frame.png", "board-frame-alpha.png", 40);
