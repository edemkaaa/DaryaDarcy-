#!/usr/bin/env node
// Сопоставляет каталоги публичного Яндекс Диска с иллюстрациями теста. Перед записью нужно сверить наборы эстетик; доступность источника зависит от сети.
/**
 * Download quiz images from Darya's public Yandex Disk folder.
 * Maps folders: Лес -> landscapes, Портреты -> outfits, Кто ты сказоч? -> shelters
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC_KEY = "https://disk.yandex.ru/d/KJ2NPBMLMGoO6w";
const API = "https://cloud-api.yandex.net/v1/disk/public/resources";

/** Folder names on https://disk.yandex.ru/d/KJ2NPBMLMGoO6w */
const FOLDER_MAP = {
  "что ты видишь?": "landscapes",
  укрытие: "shelters",
  дом: "houses",
};

const AESTHETIC_MAP = {
  cottagecore: "cottagecore",
  goblincore: "goblincore",
  witchcore: "witchcore",
  castlecore: "castlecore",
  fairycore: "fairycore",
  "dark academia": "dark-academia",
  "light academia": "light-academia",
};

async function api(pathParam = "") {
  const url = new URL(API);
  url.searchParams.set("public_key", PUBLIC_KEY);
  if (pathParam) url.searchParams.set("path", pathParam);
  url.searchParams.set("limit", "100");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadHref(href, dest) {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function parseAesthetic(filename) {
  const m = filename.match(/\(([^)]+)\)/i);
  if (!m) return null;
  const key = m[1].trim().toLowerCase();
  return AESTHETIC_MAP[key] ?? null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rootListing = await api("/");
  let count = 0;

  for (const item of rootListing._embedded?.items ?? []) {
    if (item.type !== "dir") continue;
    const target = FOLDER_MAP[item.name];
    if (!target) {
      console.warn("skip unknown folder:", item.name);
      continue;
    }
    console.log(`\n=== ${item.name} -> assets/quiz/${target} ===`);
    const sub = await api(item.path);
    for (const file of sub._embedded?.items ?? []) {
      if (file.type !== "file") continue;
      const aesthetic = parseAesthetic(file.name);
      if (!aesthetic) {
        console.warn("  skip (no aesthetic):", file.name);
        continue;
      }
      const dl = await api(file.path);
      const href = dl.file;
      const dest = path.join(root, "apps", "frontend", "assets", "quiz", target, `${aesthetic}.jpg`);
      console.log(`  ${file.name} -> ${path.relative(root, dest)}`);
      if (!dryRun && href) {
        await downloadHref(href, dest);
        count += 1;
      }
    }
  }

  console.log(dryRun ? "\n(dry run)" : `\nDownloaded ${count} files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
