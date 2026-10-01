import fs from "node:fs";

const file = process.argv[2] || "web-dist2/_expo/static/js/web/entry-b62fcfeab093001ef911bcb70681f67e.js";
const s = fs.readFileSync(file, "utf8");
const routes = [...s.matchAll(/"\.\/[^"]+"/g)].map((x) => x[0].slice(1, -1));
for (const r of routes.sort()) console.log(r);
