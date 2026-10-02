/** Apply URL replacements from tooling/data/.s3-url-map.json */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mapPath = path.join(root, "tooling", "data", ".s3-url-map.json");
if (!fs.existsSync(mapPath)) {
  console.error("No tooling/data/.s3-url-map.json — run optimize-s3-assets.mjs first");
  process.exit(1);
}

/** @type {{ from: string; to: string }[]} */
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const codeExt = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".md"]);
const skipDir = /node_modules|web-dist|\.git/;

let filesChanged = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (skipDir.test(full)) continue;
    if (name.isDirectory()) walk(full);
    else if (codeExt.has(path.extname(name.name))) {
      let text = fs.readFileSync(full, "utf8");
      let changed = false;
      for (const { from, to } of map) {
        if (text.includes(from)) {
          text = text.split(from).join(to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, text);
        filesChanged++;
        console.log("updated", path.relative(root, full));
      }
    }
  }
}

walk(root);
console.log(`Applied ${map.length} URL(s) across ${filesChanged} file(s)`);
