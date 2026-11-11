// Ищет ожидаемые фрагменты в локальной web-сборке; проверка относится к артефакту, а не к опубликованной версии сайта.
import fs from "node:fs";
import path from "node:path";

const dir = "web-dist/_expo/static/js/web";
// Сканируются локальные JS-чанки прежней Expo-сборки; найденные строки печатаются как диагностические признаки.
for (const f of fs.readdirSync(dir)) {
  if (!/\.js$/.test(f) || f.endsWith(".gz")) continue;
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const flags = [];
  if (s.includes("loshadka-cover")) flags.push("new_cover");
  if (s.includes("WDRmWxjeWyXWNrto")) flags.push("old_cover");
  if (s.includes("darcy_club_subscribed")) flags.push("sub_key");
  if (s.includes("darcy_club_profile_completed")) flags.push("profile_key");
  if (s.includes('target!=="club"') || s.includes("target!==\\\"club\\\"")) flags.push("target_filter");
  if (flags.length) console.log(f, flags.join(","));
}
