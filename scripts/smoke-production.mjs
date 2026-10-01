/**
 * Post-deploy smoke check for daryadarcy.com
 */
const BASE = process.env.SMOKE_BASE_URL || "https://daryadarcy.com";
const TIMEOUT_MS = 15000;

const checks = [
  { name: "home", url: `${BASE}/` },
  { name: "feed", url: `${BASE}/feed` },
  { name: "api_health", url: `${BASE}/api/health` },
  {
    name: "trpc_feed_tags",
    url: `${BASE}/api/trpc/feed.tags?batch=1&input=${encodeURIComponent('{"0":{"json":null}}')}`,
  },
];

let failed = 0;

for (const check of checks) {
  try {
    const res = await fetch(check.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "daryadarcy-smoke/1.0" },
    });
    if (res.status !== 200) {
      console.error(`FAIL ${check.name}: HTTP ${res.status}`);
      failed++;
    } else {
      console.log(`OK   ${check.name}: ${res.status}`);
    }
  } catch (err) {
    console.error(`FAIL ${check.name}:`, err.message || err);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}

console.log("\nAll smoke checks passed");
