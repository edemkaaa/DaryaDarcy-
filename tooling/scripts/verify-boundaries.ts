// Обходит исходники и применяет правила зависимостей слоёв. Код приложений при проверке не исполняется.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { inspectBoundary } from "./check-boundaries";
const root = process.cwd();
const violations: string[] = [];
let checked = 0;
function walk(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".expo", ".next", "dist", "web-dist", ".git", "legacy-expo"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
      checked++;
      violations.push(...inspectBoundary(path, readFileSync(path, "utf8"), root));
    }
  }
}
walk(resolve(root, "apps")); walk(resolve(root, "packages"));
if (violations.length) { console.error(violations.join("\n")); process.exitCode = 1; }
else console.log(`Dependency boundaries: ${checked} files checked`);
