/**
 * Safe web deploy: verify → build → upload tarball → SSH deploy → smoke.
 * Usage: node scripts/deploy-web.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command, args = []) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nDeploy aborted at step: ${label}`);
    process.exit(result.status ?? 1);
  }
}

run("Verify (regression tests)", "npm", ["run", "verify"]);
const webDist = path.join(root, "web-dist");
if (fs.existsSync(webDist)) {
  fs.rmSync(webDist, { recursive: true, force: true });
  console.log("Removed stale web-dist before build");
}
run("Build web", "npm", ["run", "build:web"]);
run("Verify built artifacts", "npx", ["cross-env", "CHECK_WEB_DIST=1", "npm", "run", "test:regression"]);
run("Upload web-dist.tgz to S3", "node", ["scripts/upload-web-dist.mjs"]);
run("Deploy on VPS", "python", ["scripts/ssh-deploy-web.py"]);
run("Production smoke", "node", ["scripts/smoke-production.mjs"]);

console.log("\nDeploy complete.");
