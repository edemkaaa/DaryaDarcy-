/** Подготавливает окружение исполняемого процесса до импорта приложения. */
import fs from "node:fs";
import path from "node:path";

/** Читает простой key=value env-файл, удаляет BOM/внешние кавычки и заполняет лишь отсутствующие либо пустые переменные процесса. */
function applyEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }
}

applyEnvFile("/var/www/daryadarcy/.env");
applyEnvFile(path.resolve(process.cwd(), ".env"));
applyEnvFile(path.resolve(process.cwd(), "../.env"));
