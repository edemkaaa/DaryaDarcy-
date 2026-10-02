/** Fix require() paths after PNG → WebP conversion in assets/ */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(root, "apps", "frontend");
const skip = /node_modules|web-dist|\.git|\.tmp-/;
const codeExt = new Set([".ts", ".tsx", ".js"]);
let changed = 0;

function walkCode(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (skip.test(full)) continue;
    if (name.isDirectory()) walkCode(full);
    else if (codeExt.has(path.extname(name.name))) {
      let text = fs.readFileSync(full, "utf8");
      let hit = false;
      const re = /@\/assets\/[^"']+\.png/g;
      const seen = new Set();
      for (const m of text.matchAll(re)) {
        const req = m[0];
        if (seen.has(req)) continue;
        seen.add(req);
        const rel = req.slice(2);
        const webp = rel.replace(/\.png$/, ".webp");
        if (fs.existsSync(path.join(frontendRoot, webp))) {
          text = text.split(req).join(req.replace(/\.png$/, ".webp"));
          hit = true;
        }
      }
      if (hit) {
        fs.writeFileSync(full, text);
        changed++;
        console.log("updated", path.relative(root, full));
      }
    }
  }
}

walkCode(root);
console.log(`Fixed ${changed} file(s)`);
