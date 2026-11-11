// Старый путь выпуска через SSH/PM2, оставленный для прежнего окружения. Тесты перед запуском не исправляют Windows-пути и не заменяют проверку Docker-релиза.
/**
 * Build API bundle and upload to VPS via SSH.
 * Usage: node tooling/operations/deploy-api.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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

run("Verify (regression tests)", "npm", ["run", "test:regression"]);
run("Build API", "npm", ["run", "build"]);
run("Upload + restart on VPS", "python3", ["tooling/operations/ssh-deploy-api.py"]);
run("Check prod env (masked)", "python3", ["tooling/operations/ssh-check-prodamus-env.py"]);

console.log("\nAPI deploy complete.");
