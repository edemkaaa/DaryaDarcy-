import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployDir = path.join(root, "infrastructure", "deploy");
const out = path.join(deployDir, "daryadarcy-src.tgz");

for (const name of ["install.sh", "vps-fresh.sh", "apply-ip-nginx.sh", "restart.sh"]) {
  const file = path.join(deployDir, name);
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"), "utf8");
  }
}

const staging = path.join(deployDir, ".stage");
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

const copy = [
  "package.json",
  "pnpm-lock.yaml",
  ".npmrc",
  "dist/index.mjs",
  "infrastructure/deploy/nginx-daryadarcy.conf",
  "infrastructure/deploy/ecosystem.config.cjs",
  "infrastructure/deploy/install.sh",
  "infrastructure/deploy/restart.sh",
  "infrastructure/deploy/apply-ip-nginx.sh",
];

for (const rel of copy) {
  const from = path.join(root, rel);
  if (!fs.existsSync(from)) throw new Error(`Missing ${rel}`);
  const to = path.join(staging, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

const webDist = path.join(root, "web-dist");
if (!fs.existsSync(webDist)) throw new Error("Missing web-dist — run pnpm build:web first");
fs.cpSync(webDist, path.join(staging, "web-dist"), { recursive: true });

if (fs.existsSync(out)) fs.unlinkSync(out);
const tar = spawnSync(
  "tar",
  ["-czf", out, "-C", staging, "."],
  { stdio: "inherit" },
);
if (tar.status !== 0) throw new Error("tar failed");
fs.rmSync(staging, { recursive: true, force: true });
const stat = fs.statSync(out);
console.log(out);
console.log("bytes", stat.size);
