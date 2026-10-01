import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "site", "public");

function copyDir(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Missing ${from}`);
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

copyDir(path.join(root, "assets", "fonts"), path.join(publicDir, "fonts"));
copyDir(path.join(root, "assets", "images", "home"), path.join(publicDir, "home"));
console.log("copied fonts + home images into site/public");
