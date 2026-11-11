// Сверяет размещение модулей в собранных клиентских чанках; результаты зависят от конкретного артефакта сборки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "web-dist", "_expo", "static", "js", "web");
const BASE = "https://daryadarcy.com";

const ROUTE_CHECKS = {
  "feed-": [
    ["Array.isArray", "photos normalization"],
    ["viewerVisible", "lazy PhotoViewer"],
    ["setActivePost(null)", "delete clears active post"],
    ["listPaginated.invalidate", "cache invalidation"],
    ["NaturalPhotoStack", "photo layout"],
  ],
  "shop-": [
    ["DIGITAL_ROW_BOTTOM", "digital row anchor"],
    ["0.52", "price tag offset"],
  ],
  "library-": [
    ["1176/1500", "loshadka aspect"],
    ['item.id==="loshadka"', "loshadka cover mode"],
  ],
  "videos-": [
    ['contentFit:"contain"', "rose hips contain"],
    ["72", "rose hip width"],
  ],
  "interactive-": [
    ["нужно с чем-то расстаться", "quiz Q8"],
    ["Заберусь на удобную ветку", "quiz Q9"],
    ["Открываешь глаза", "quiz Q1"],
  ],
  "index-": [
    ["secret-garden-poster", "garden poster"],
  ],
};

function chunkFor(prefix) {
  // Находит конкретный локальный legacy-chunk раздела; отсутствие файла не подменяется маркером другой сборки.

  return fs.readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith(".js"));
}

console.log("=== LOCAL chunks ===");
for (const [prefix, checks] of Object.entries(ROUTE_CHECKS)) {
  const file = chunkFor(prefix);
  if (!file) {
    console.log(`\n${prefix} MISSING`);
    continue;
  }
  const js = fs.readFileSync(path.join(dir, file), "utf8");
  console.log(`\n${file}`);
  for (const [needle, label] of checks) {
    console.log(`  ${js.includes(needle) ? "OK  " : "MISS"} ${label}`);
  }
}

console.log("\n=== PROD chunks ===");
for (const [prefix, checks] of Object.entries(ROUTE_CHECKS)) {
  const file = chunkFor(prefix);
  if (!file) {
    console.log(`\n${prefix} MISSING locally`);
    continue;
  }
  const url = `${BASE}/_expo/static/js/web/${file}?t=${Date.now()}`;
  const res = await fetch(url);
  console.log(`\n${file} HTTP ${res.status}`);
  const js = await res.text();
  for (const [needle, label] of checks) {
    console.log(`  ${js.includes(needle) ? "OK  " : "MISS"} ${label}`);
  }
}
