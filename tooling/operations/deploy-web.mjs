// Сохраняет прежний статический pipeline, но останавливается при обнаружении Next. Новый серверный frontend нельзя публиковать как Expo web-dist.
/**
 * Safe web deploy: verify → build → upload tarball → SSH deploy → smoke.
 * Usage: node tooling/operations/deploy-web.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// The previous deploy pipeline publishes a static Expo bundle. Next.js needs
// a Node.js deployment; fail before removing artifacts or contacting services.
const frontendPackage = JSON.parse(fs.readFileSync(path.join(root, "apps/frontend/package.json"), "utf8"));
if (frontendPackage.dependencies?.next) {
  console.error("Deploy stopped: apps/frontend now uses Next.js. Configure a Next.js server deployment before publishing.");
  process.exit(1);
}

function run(label, command, args = []) {
  // Запускает одну историческую стадию с остановкой при ненулевом коде; не обеспечивает откат уже выполненных стадий.

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
run("Upload web-dist.tgz to S3", "node", ["tooling/operations/upload-web-dist.mjs"]);
run("Deploy on VPS", "python3", ["tooling/operations/ssh-deploy-web.py"]);
run("Production smoke", "node", ["tooling/operations/smoke-production.mjs"]);

console.log("\nDeploy complete.");
