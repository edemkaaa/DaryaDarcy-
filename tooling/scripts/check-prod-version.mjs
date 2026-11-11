// Делает внешний запрос к прежнему production-домену, обходя клиентский кеш. Это сетевой операторский инструмент, а не локальная проверка исходников.
const html = await fetch(`https://daryadarcy.com/?t=${Date.now()}`, {
  headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
}).then((r) => r.text());

const tokens = [...html.matchAll(/\?v=([^"&]+)/g)].map((m) => m[1]);
console.log("PROD cache-bust:", [...new Set(tokens)].join(", "));
console.log("PROD common chunk:", html.match(/__common-[a-f0-9]+\.js/)?.[0] ?? "?");
console.log("LOCAL cache-bust: mt8lwmil (from last build)");
console.log("LOCAL common: __common-6277635c517403c3fe83e1fd3720e5b2.js");
