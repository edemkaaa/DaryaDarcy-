const id = "i-BvaZX5lt_bWT3-2XlytCPegnqahzm72s0qoIz-cKg6VVRvWFlYSDJZdw";
const r = await fetch(`https://docs.yandex.ru/view/d/${id}`, {
  headers: { "User-Agent": "Mozilla/5.0" },
});
const html = await r.text();
console.log("status", r.status, "len", html.length);
const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
console.log("title", title);
for (const pat of ["download", "docx", "export", "downloader.disk", "public_key"]) {
  const re = new RegExp(`.{0,40}${pat}.{0,80}`, "gi");
  const m = html.match(re);
  if (m) console.log(pat, [...new Set(m)].slice(0, 3));
}
