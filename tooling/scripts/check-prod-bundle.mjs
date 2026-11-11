// Сравнивает локальный legacy-bundle с реальными ответами прежнего production-домена. Наличие строки в сборке не доказывает работу пользовательского сценария.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const webDist = path.join(root, "web-dist", "_expo", "static", "js", "web");

const MARKERS = [
  ["secret-garden-poster", "Secret Garden poster"],
  ["normalizeFeedPost", "Feed normalization"],
  ["PRICE_TAG_TOP", "Shop price tags"],
  ["нужно с чем-то расстаться", "Quiz Q8"],
  ["Заберусь на удобную ветку", "Quiz Q9"],
  ["1176 / 1500", "Loshadka cover"],
  ["viewerVisible ?", "Lazy PhotoViewer"],
  ["listPaginated.invalidate", "Feed cache invalidation"],
];

function checkBundle(label, dir) {
  // Сканирует заданный каталог локальных JS-чанков на ожидаемые маркеры и сообщает отсутствующий артефакт отдельно.

  if (!fs.existsSync(dir)) {
    console.log(`\n${label}: MISSING ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
  const hits = new Map();
  for (const file of files) {
    const js = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [needle] of MARKERS) {
      if (js.includes(needle)) hits.set(needle, file);
    }
  }
  console.log(`\n${label} (${files.length} chunks):`);
  for (const [needle, name] of MARKERS) {
    const file = hits.get(needle);
    console.log(`${file ? "OK  " : "MISS"} ${name}${file ? ` → ${file}` : ""}`);
  }
}

// Сначала проверяется локальная статика, затем выполняются реальные GET прежнего production-домена.
checkBundle("LOCAL web-dist", webDist);

const BASE = process.env.SMOKE_BASE_URL || "https://daryadarcy.com";
const html = await fetch(`${BASE}/?t=${Date.now()}`).then((r) => r.text());
const entryMatch = html.match(/entry-[a-f0-9]+\.js/);
console.log(`\nPROD entry: ${entryMatch?.[0] ?? "?"}`);

// По опубликованному HTML и lazy-ссылкам ищутся маркеры; результат не заменяет сквозной пользовательский тест.
const prodHits = new Map();
for (const rel of [
  entryMatch?.[0],
  "feed-",
  "shop-",
  "library-",
  "videos-",
  "interactive-",
  "index-",
].filter(Boolean)) {
  let url;
  if (rel.startsWith("entry-")) {
    url = `${BASE}/_expo/static/js/web/${rel}?t=${Date.now()}`;
  } else {
    const list = [...html.matchAll(new RegExp(`/_expo/static/js/web/${rel}[a-f0-9]+\\.js`, "g"))].map((m) => m[0]);
    if (!list.length) continue;
    url = `${BASE}${list[0]}?t=${Date.now()}`;
  }
  const js = await fetch(url).then((r) => r.text());
  const file = url.split("/").pop().split("?")[0];
  for (const [needle] of MARKERS) {
    if (js.includes(needle)) prodHits.set(needle, file);
  }
}

// Also scan lazy chunks referenced inside entry
if (entryMatch) {
  const entryJs = await fetch(`${BASE}/_expo/static/js/web/${entryMatch[0]}?t=${Date.now()}`).then((r) => r.text());
  const lazy = [...entryJs.matchAll(/\/_expo\/static\/js\/web\/([a-z0-9._-]+\.js)/g)].map((m) => m[1]);
  const unique = [...new Set(lazy)];
  console.log(`PROD lazy refs in entry: ${unique.length}`);
  for (const file of unique.slice(0, 40)) {
    const js = await fetch(`${BASE}/_expo/static/js/web/${file}?t=${Date.now()}`).then((r) => r.text());
    for (const [needle] of MARKERS) {
      if (js.includes(needle)) prodHits.set(needle, file);
    }
  }
}

console.log(`\nPROD bundle:`);
for (const [needle, name] of MARKERS) {
  const file = prodHits.get(needle);
  console.log(`${file ? "OK  " : "MISS"} ${name}${file ? ` → ${file}` : ""}`);
}
