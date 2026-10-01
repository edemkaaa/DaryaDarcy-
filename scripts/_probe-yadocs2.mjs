const id = "i-BvaZX5lt_bWT3-2XlytCPegnqahzm72s0qoIz-cKg6VVRvWFlYSDJZdw";
const r = await fetch(`https://docs.yandex.ru/view/d/${id}`, {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const html = await r.text();
const idx = html.indexOf("2025-05-28 11-37-27");
console.log(html.slice(Math.max(0, idx - 400), idx + 400));
