// Проверяет WebP и повторное чтение публичных превью отдельным клиентом на разрешённом локальном стенде. Закрытые источники должны получать отказ, а не попадать в кеш.
import assert from "node:assert/strict";

// Run from a separate client container, never inside the memory-limited web.
// Only our temporary Docker preflight or localhost is eligible for this load.
const base = new URL(process.env.PREVIEW_SMOKE_URL || "http://127.0.0.1:8081");
assert.ok(
  ["127.0.0.1", "localhost"].includes(base.hostname) ||
    /^daryadarcy-image-preflight-[a-z0-9-]+$/.test(base.hostname),
  "Cold-album probe must not target the public site or other projects",
);
assert.equal(base.protocol, "http:");
assert.ok(!base.username && !base.password && !base.search && !base.hash);
assert.equal(base.pathname, "/");

const get = (path, extra = {}) => /* Выполняет ограниченный по времени запрос к заранее разрешённому локальному стенду превью. */ fetch(new URL(path, base), {
  signal: AbortSignal.timeout(30_000), ...extra,
});
for (let attempt = 0; ; attempt++) {
  try { assert.equal((await get("/")).status, 200); break; }
  catch (error) {
    if (attempt >= 30) throw error;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
for (const path of ["/club", "/feed", "/videos", "/quiz", "/privacy"]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/);
}
const catalog = await fetch("https://daryadarcy.dev.reeskeen.ru/api/trpc/feed.list", {
  signal: AbortSignal.timeout(15_000), redirect: "error",
});
assert.equal(catalog.status, 200);
const posts = (await catalog.json()).result.data.json;
const albums = posts.map(post => typeof post.photos === "string" ? JSON.parse(post.photos) : post.photos);
const album = albums.find(photos => Array.isArray(photos) && photos.length >= 9);
assert.ok(album, "Need a real public nine-photo album");
const photos = album.slice(0, 9);
assert.ok(photos.every(uri => /^https:\/\/s3\.twcstorage\.ru\/daryadarcy-s3\/feed\//.test(uri)));
const previewPath = (uri, width) => /* Кодирует исходную ссылку и ширину в запрос оптимизатора изображений. */ `/_next/image?url=${encodeURIComponent(uri)}&w=${width}&q=75`;
for (const width of [480, 1440]) {
  const started = performance.now();
  const replies = await Promise.all(photos.map(async uri => {
    const response = await get(previewPath(uri, width), { headers: { Accept: "image/webp" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.toString("ascii", 0, 4), "RIFF");
    assert.equal(body.toString("ascii", 8, 12), "WEBP");
    return { bytes: body.length, cache: response.headers.get("x-nextjs-cache") };
  }));
  console.log(JSON.stringify({ width, albumBytes: replies.reduce((n, r) => n + r.bytes, 0), durationMs: Math.round(performance.now() - started), cache: replies.map(r => r.cache) }));
}
const warmStarted = performance.now();
const warm = await get(previewPath(photos[0], 480), { headers: { Accept: "image/webp" } });
assert.equal(warm.status, 200);
assert.equal(warm.headers.get("x-nextjs-cache"), "HIT");
await warm.arrayBuffer();
console.log(JSON.stringify({ warmMs: Math.round(performance.now() - warmStarted) }));
for (const uri of [
  "http://127.0.0.1:3000/api/auth/me", "/api/auth/me",
  "https://s3.twcstorage.ru/daryadarcy-s3/club/a.jpg",
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/a.jpg?signature=secret",
  "https://example.test/a.jpg",
]) assert.equal((await get(previewPath(uri, 480))).status, 400);
console.log("PASS web runtime, cold album, warm cache and denied private sources");
