import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDist = path.join(root, "web-dist");
const staging = path.join(root, "deploy", ".web-stage");
const out = path.join(root, "deploy", "web-dist.tgz");

if (!fs.existsSync(path.join(webDist, "index.html"))) {
  throw new Error("Missing web-dist — run npm run build:web first");
}

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(webDist, path.join(staging, "web-dist"), { recursive: true });
if (fs.existsSync(out)) fs.unlinkSync(out);

const tar = spawnSync("tar", ["-czf", out, "-C", staging, "."], { stdio: "inherit" });
if (tar.status !== 0) throw new Error("tar failed");

fs.rmSync(staging, { recursive: true, force: true });
console.log("packed", out, "bytes", fs.statSync(out).size);
