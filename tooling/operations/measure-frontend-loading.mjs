/** Read-only guest benchmark: deployed baseline versus a local production build. */
import { chromium } from "@playwright/test";
import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const baseline = option("baseline", "https://daryadarcy.dev.reeskeen.ru");
const current = option("current", "http://127.0.0.1:8081");
const output = option("output", "/tmp/daryadarcy-loading-2026-10-06");
const runs = Number(option("runs", "3"));
const windowMs = Number(option("window", "20000"));
const port = Number(option("proxy-port", "8082"));
const apiMode = option("api-mode", "live");
const snapshotFile = option("api-snapshot", "");
const targets = option("targets", "baseline,current").split(",");
const settings = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  latency: 150, downloadThroughput: 3_000_000 / 8, uploadThroughput: 750_000 / 8,
  cpuSlowdown: 4, windowMs, runs, serviceWorkers: "block", apiMode, snapshotFile };
await fs.mkdir(output, { recursive: true });
const apiSnapshots = new Map();
if (snapshotFile) {
  for (const [endpoint, body] of Object.entries(JSON.parse(await fs.readFile(snapshotFile, "utf8")))) apiSnapshots.set(endpoint, body);
} else if (apiMode === "fixture") {
  apiSnapshots.set("/api/auth/me", JSON.stringify({ user: null }));
  apiSnapshots.set("/api/capabilities", JSON.stringify({ smsLogin: false, penPals: false, shopOnlinePayment: false, webPush: false }));
} else if (apiMode === "snapshot") {
  for (const endpoint of ["/api/auth/me", "/api/capabilities"]) {
    const response = await fetch(baseline + endpoint, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Cannot capture public guest API ${endpoint}: ${response.status}`);
    apiSnapshots.set(endpoint, await response.text());
  }
  await fs.writeFile(path.join(output, "guest-api-snapshot.json"), JSON.stringify(Object.fromEntries(apiSnapshots), null, 2));
}
let localServer;
if (process.argv.includes("--start-current")) {
  localServer = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"),
    "start", "--hostname", "127.0.0.1", "--port", new URL(current).port],
  { cwd: path.join(root, "apps/frontend"), stdio: "ignore" });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { ready = (await fetch(current, { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) { localServer.kill("SIGTERM"); throw new Error("Local production server did not start"); }
}
// Use the SAME real public guest API for the new build. No fake success replies,
// credentials, mutations, database startup or changes to the deployed service.
const proxy = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
  const upstream = new URL(req.url, req.url.startsWith("/api/") || req.url.startsWith("/media/") ? baseline : current);
  const headers = { ...req.headers, host: upstream.host };
  delete headers.cookie;
  delete headers.authorization;
  const request = (upstream.protocol === "https:" ? https : http).request(upstream, { method: req.method, headers }, (response) => {
    const clean = { ...response.headers };
    delete clean["set-cookie"];
    res.writeHead(response.statusCode, clean);
    response.pipe(res);
  });
  request.setTimeout(30000, () => request.destroy(new Error("Guest upstream timed out")));
  request.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.on("aborted", () => request.destroy());
  request.end();
});
await new Promise((resolve, reject) => { proxy.once("error", reject); proxy.listen(port, "127.0.0.1", resolve); });
const browser = await chromium.launch({ executablePath: option("chromium", "/usr/bin/chromium"), headless: true });
const results = [];
const audit = JSON.parse(await fs.readFile(path.join(root, "tooling/data/frontend-audits/frontend-external-image-audit-2026-10-06.json"), "utf8"));
const originalSizes = new Map(audit.results.map((entry) => [entry.url, entry.before]));
const localAudit = JSON.parse(await fs.readFile(path.join(root, "tooling/data/frontend-audits/frontend-image-audit-2026-10-06.json"), "utf8"));
for (const entry of localAudit.results) originalSizes.set(entry.uri, entry.before);

function observe() {
  localStorage.setItem("@darcy_install_guide_seen", "1");
  const data = window.__loadingProbe = { lcp: null, cls: 0, longTaskBlockingMs: 0, firstViewportImagesReady: null };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) data.lcp = { ms: entry.startTime, url: entry.url || null, tag: entry.element?.tagName ?? null };
  }).observe({ type: "largest-contentful-paint", buffered: true });
  let sessionStart = 0, sessionLast = 0, sessionValue = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      if (entry.startTime - sessionLast > 1000 || entry.startTime - sessionStart > 5000) {
        sessionStart = entry.startTime; sessionValue = 0;
      }
      sessionLast = entry.startTime; sessionValue += entry.value;
      data.cls = Math.max(data.cls, sessionValue);
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) data.longTaskBlockingMs += Math.max(0, entry.duration - 50);
  }).observe({ type: "longtask", buffered: true });
  setInterval(() => {
    if (data.firstViewportImagesReady !== null) return;
    const marker = location.pathname === "/" ? "hero_header" : "9e3aec1f0a5d";
    if (![...document.images].some((img) => (img.currentSrc || img.src).includes(marker))) return;
    const visible = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0)) return false;
      for (let el = img; el; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
      }
      return true;
    });
    if (visible.length && visible.every((img) => img.complete && img.naturalWidth > 0)) data.firstViewportImagesReady = performance.now();
  }, 100);
}

async function measure(context, label, route, run, cache, scroll = false) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  await cdp.send("Network.emulateNetworkConditionsByRule", { offline: false, matchedNetworkConditions: [{
    urlPattern: "", latency: settings.latency, downloadThroughput: settings.downloadThroughput,
    uploadThroughput: settings.uploadThroughput,
  }] });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: settings.cpuSlowdown });
  if (apiSnapshots.size) {
    await cdp.send("Fetch.enable", { patterns: [...apiSnapshots.keys()].map((endpoint) => ({ urlPattern: `*${endpoint}` })) });
    cdp.on("Fetch.requestPaused", async (event) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await cdp.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json; charset=utf-8" }, { name: "Cache-Control", value: "no-store" }],
        body: Buffer.from(apiSnapshots.get(new URL(event.request.url).pathname)).toString("base64"),
      }).catch(() => {});
    });
  }
  const requests = new Map();
  cdp.on("Network.requestWillBeSent", (e) => requests.set(e.requestId, { url: e.request.url, type: e.type,
    started: e.timestamp, partialWireBytes: 0 }));
  cdp.on("Network.responseReceived", (e) => {
    const r = requests.get(e.requestId); if (!r) return;
    Object.assign(r, { status: e.response.status, mime: e.response.mimeType,
      responseAt: e.timestamp,
      cache: e.response.fromDiskCache || e.response.fromServiceWorker || r.cache || false,
      contentLength: Number(Object.entries(e.response.headers).find(([key]) => key.toLowerCase() === "content-length")?.[1]) || null });
  });
  cdp.on("Network.requestServedFromCache", (e) => { const r = requests.get(e.requestId); if (r) r.cache = true; });
  cdp.on("Network.dataReceived", (e) => { const r = requests.get(e.requestId); if (r) r.partialWireBytes += e.encodedDataLength; });
  cdp.on("Network.loadingFinished", (e) => { const r = requests.get(e.requestId); if (r) Object.assign(r, { finished: e.timestamp, wireBytes: e.encodedDataLength }); });
  cdp.on("Network.loadingFailed", (e) => { const r = requests.get(e.requestId); if (r) r.failure = e.errorText; });
  await page.addInitScript(observe);
  const start = Date.now();
  let navigationError = null;
  try {
    await page.goto((label === "baseline" ? baseline : `http://127.0.0.1:${port}`) + route,
      { waitUntil: "commit", timeout: 30000 });
    await page.waitForTimeout(Math.max(0, windowMs - (Date.now() - start)));
  } catch (error) { navigationError = error.message; }
  const elapsedMs = Date.now() - start;
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return { ...window.__loadingProbe, ttfb: nav?.responseStart ?? null,
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
      domContentLoaded: nav?.domContentLoadedEventEnd || null, load: nav?.loadEventEnd || null,
      title: document.title, contentError: document.body.innerText.includes("Сервер не ответил вовремя") || document.body.innerText.includes("Не удалось загрузить"),
      markerPresent: [...document.images].some((img) => (img.currentSrc || img.src).includes(location.pathname === "/" ? "hero_header" : "9e3aec1f0a5d")),
      images: [...document.images].map((img) => ({
        url: img.currentSrc || img.src, complete: img.complete, naturalWidth: img.naturalWidth,
        loading: img.loading, rect: { top: img.getBoundingClientRect().top, width: img.getBoundingClientRect().width },
      })) };
  }).catch(() => null);
  const rows = [...requests.values()].map((row) => ({ ...row }));
  const images = rows.filter((row) => row.type === "Image" || row.mime?.startsWith("image/"));
  function estimatedImageBytes(row) {
    if (row.contentLength) return row.contentLength;
    if (row.finished) return row.wireBytes;
    if (originalSizes.has(row.url)) return originalSizes.get(row.url);
    if (label === "baseline") return originalSizes.get(new URL(row.url).pathname) ?? null;
    return null;
  }
  const wireBytes = (row) => row.cache ? 0 : (row.wireBytes ?? row.partialWireBytes);
  const record = { label, route, run, cache, elapsedMs, navigationError, metrics,
    network: { requests: rows.length, imageRequests: images.length, imageFileBytesRequested: images.reduce((s, r) => s + (estimatedImageBytes(r) ?? 0), 0),
      imageFileBytesUnknown: images.filter((r) => estimatedImageBytes(r) === null).length,
      wireBytes: rows.reduce((s, r) => s + wireBytes(r), 0), imageWireBytes: images.reduce((s, r) => s + wireBytes(r), 0),
      pending: rows.filter((r) => !r.finished && !r.failure).length, cached: rows.filter((r) => r.cache).length,
      httpErrors: rows.filter((r) => r.status >= 400).map(({ url, status }) => ({ url, status })),
      failures: rows.filter((r) => r.failure).map(({ url, failure }) => ({ url, failure })),
    }, requests: rows };
  console.log(JSON.stringify({ label, route, run, cache, ttfb: metrics?.ttfb, fcp: metrics?.fcp, lcp: metrics?.lcp?.ms,
    viewportReady: metrics?.firstViewportImagesReady, markerPresent: metrics?.markerPresent, contentError: metrics?.contentError, ...record.network, navigationError }));
  // A separate below-fold scenario; its interaction must not change initial LCP.
  if (scroll && !navigationError) {
    record.scroll = [];
    for (const stem of ["0479fc01d16a-MSbIPSMMSqmZweYd", "250423a7ec62-uyAaCmBzfqhlMwpt"]) {
      const image = page.locator(`img[src*="${stem}"]`).first();
      const began = Date.now();
      try {
        await image.scrollIntoViewIfNeeded({ timeout: 5000 });
        await image.evaluate((img) => Promise.race([
          img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error("decode timeout 30s")), 30000)),
        ]));
        record.scroll.push({ stem, decoded: true, ms: Date.now() - began, source: await image.getAttribute("src") });
      } catch (error) { record.scroll.push({ stem, decoded: false, ms: Date.now() - began, error: error.message }); }
    }
    console.log(JSON.stringify({ label, route, scroll: record.scroll }));
  }
  if (run === 1 || scroll) await page.screenshot({ path: path.join(output, `${label}-${route === "/" ? "home" : "club"}-${run}-${cache}.png`), timeout: 10000 }).catch(() => {});
  await fs.writeFile(path.join(output, `${label}-${route === "/" ? "home" : "club"}-${run}-${cache}.json`), JSON.stringify(record, null, 2));
  results.push(record);
  await page.close();
}

try {
  for (const route of ["/", "/club"]) {
    for (let run = 1; run <= runs; run++) {
      // Alternate order to avoid consistently giving one target warmer servers.
      for (const label of (run % 2 ? ["baseline", "current"] : ["current", "baseline"]).filter((label) => targets.includes(label))) {
        const context = await browser.newContext({ viewport: settings.viewport, deviceScaleFactor: settings.deviceScaleFactor,
          isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "ru-RU" });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.clearBrowserCache");
        await page.close();
        await measure(context, label, route, run, "cold", route === "/club" && run === runs);
        if (run === 1) await measure(context, label, route, run, "warm");
        await context.close();
      }
      await fs.writeFile(path.join(output, "results.json"), JSON.stringify({ capturedAt: new Date().toISOString(), baseline, current, settings,
        browser: browser.version(), results }, null, 2));
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => proxy.close(resolve));
  localServer?.kill("SIGTERM");
}
