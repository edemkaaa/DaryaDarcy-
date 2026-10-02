const BASE = "https://daryadarcy.com";

const TARGETS = [
  { name: "health", url: `${BASE}/api/health` },
  { name: "home", url: `${BASE}/` },
  { name: "library", url: `${BASE}/library` },
  { name: "about-me", url: `${BASE}/library/about-me` },
  { name: "aesthetics", url: `${BASE}/library/aesthetics-guide` },
  { name: "feed", url: `${BASE}/feed` },
  { name: "shop", url: `${BASE}/shop` },
  { name: "club", url: `${BASE}/club` },
  { name: "articles.list", url: `${BASE}/api/trpc/articles.list` },
  { name: "article.missing", url: `${BASE}/library/article/1` },
];

const CONCURRENCY = 8;
const PER_TARGET = 24;
const TIMEOUT_MS = 15000;

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function hit(url) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
    await res.arrayBuffer();
    return { ok: res.ok, status: res.status, ms: performance.now() - started };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: performance.now() - started,
      error: err instanceof Error ? err.name : "error",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runTarget(target) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < PER_TARGET) {
      cursor += 1;
      results.push(await hit(target.url));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, PER_TARGET) }, () => worker()));
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const statuses = {};
  for (const row of results) {
    const key = String(row.status || row.error || "err");
    statuses[key] = (statuses[key] || 0) + 1;
  }
  const ok = results.filter((r) => r.ok).length;
  return {
    name: target.name,
    url: target.url,
    requests: results.length,
    ok,
    errors: results.length - ok,
    errorRate: Number((((results.length - ok) / results.length) * 100).toFixed(1)),
    min: Math.round(times[0] || 0),
    p50: Math.round(percentile(times, 50)),
    p95: Math.round(percentile(times, 95)),
    p99: Math.round(percentile(times, 99)),
    max: Math.round(times[times.length - 1] || 0),
    statuses,
  };
}

const startedAt = new Date().toISOString();
const wallStart = performance.now();
const rows = [];
for (const target of TARGETS) {
  rows.push(await runTarget(target));
}
const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  wallMs: Math.round(performance.now() - wallStart),
  concurrency: CONCURRENCY,
  perTarget: PER_TARGET,
  rows,
};

console.log(JSON.stringify(summary, null, 2));
