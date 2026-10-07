import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVideoServer } from "../server.mjs";
import { createThumbnailReader } from "../upstream.mjs";

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const id = "sq7pY1H_fYU";

async function start(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "video-http-test-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "fixture.mp4");
  await writeFile(path, Buffer.from("0123456789"));
  const server = createVideoServer({
    catalogUrl: "http://unused.invalid/api/trpc/videos.list",
    readCatalog: async () => [{ youtubeId: id, published: true }],
    cache: { acquire: async () => ({ path, release() {} }) },
    ...options,
    ...(options.makeCache ? { cache: options.makeCache(path) } : {}),
  });
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  cleanups.push(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

test("serves a complete prepared video with a bounded content length", async () => {
  const base = await start();
  const response = await fetch(`${base}/api/yt/${id}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("content-length"), "10");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "0123456789");
});

test("serves a byte range for browser seeking", async () => {
  const base = await start();
  const response = await fetch(`${base}/api/yt/${id}`, {
    headers: { range: "bytes=3-5" },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 3-5/10");
  assert.equal(response.headers.get("content-length"), "3");
  assert.equal(await response.text(), "345");
});

test("serves suffix and open-ended ranges", async () => {
  const base = await start();
  for (const [range, want, contentRange] of [
    ["bytes=-2", "89", "bytes 8-9/10"],
    ["bytes=8-", "89", "bytes 8-9/10"],
    ["bytes=8-999", "89", "bytes 8-9/10"],
  ]) {
    const response = await fetch(`${base}/api/yt/${id}`, {
      headers: { range },
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), contentRange);
    assert.equal(await response.text(), want);
  }
});

test("rejects invalid, unsatisfiable and multipart ranges", async () => {
  const base = await start();
  for (const range of [
    "bytes=10-",
    "bytes=4-2",
    "bytes=-0",
    "bytes=0-1,3-4",
    "other=0-2",
    "bytes=9007199254740992-",
  ]) {
    const response = await fetch(`${base}/api/yt/${id}`, {
      headers: { range },
    });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */10");
  }
});

test("HEAD reports video headers without a body", async () => {
  const base = await start();
  const response = await fetch(`${base}/api/yt/${id}`, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), "10");
  assert.equal(await response.text(), "");
});

test("unpublishing denies cached playback before preparing or reading media", async () => {
  let published = true;
  const base = await start({
    readCatalog: async () => [{ youtubeId: id, published }],
    makeCache: (path) => ({
      acquire: async () => {
        if (!published)
          throw new Error("unpublished media must not be accessed");
        return { path, release() {} };
      },
    }),
  });
  assert.equal((await fetch(`${base}/api/yt/${id}`)).status, 200);
  published = false;
  assert.equal((await fetch(`${base}/api/yt/${id}`)).status, 404);
  assert.equal(
    (await fetch(`${base}/media/yt-thumb/${id}/hqdefault.jpg`)).status,
    404,
  );
});

test("unknown IDs cannot turn the worker into an arbitrary YouTube downloader", async () => {
  const base = await start({
    cache: {
      acquire: async () => {
        throw new Error("must not download");
      },
    },
  });
  assert.equal((await fetch(`${base}/api/yt/abcdefghijk`)).status, 404);
});

test("catalog failures fail closed with generic errors", async () => {
  const base = await start({
    readCatalog: async () => {
      throw new Error("private details and credentials");
    },
  });
  const response = await fetch(`${base}/api/yt/${id}`);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "video unavailable" });
});

test("rechecks publication after long preparation", async () => {
  let published = true;
  const base = await start({
    readCatalog: async () => [{ youtubeId: id, published }],
    cache: {
      acquire: async () => {
        published = false;
        return { path: "/absent", release() {} };
      },
    },
  });
  assert.equal((await fetch(`${base}/api/yt/${id}`)).status, 404);
});

test("rejects malformed IDs, URL input and mutating methods", async () => {
  const base = await start({
    readCatalog: async () => {
      throw new Error("must not read catalog");
    },
  });
  assert.equal((await fetch(`${base}/api/yt/a`)).status, 400);
  assert.equal(
    (await fetch(`${base}/api/yt/${id}?url=http://127.0.0.1`)).status,
    400,
  );
  const response = await fetch(`${base}/api/yt/${id}`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});

test("health does not depend on internet or the catalog", async () => {
  const base = await start({
    readCatalog: async () => {
      throw new Error("offline");
    },
  });
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test("serves the existing published thumbnail route with JPEG bytes", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const base = await start({ readThumbnail: async () => jpeg });
  const response = await fetch(`${base}/media/yt-thumb/${id}/hqdefault.jpg`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
});

test("a cached thumbnail is denied immediately after unpublishing", async () => {
  let published = true;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const base = await start({
    readCatalog: async () => [{ youtubeId: id, published }],
    readThumbnail: createThumbnailReader({ load: async () => jpeg }),
  });
  const url = `${base}/media/yt-thumb/${id}/hqdefault.jpg`;
  for (let i = 0; i < 2; i++) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  published = false;
  assert.equal((await fetch(url)).status, 404);
});

test("bounds concurrent HTTP work and still serves health while busy", async () => {
  let begin;
  let finish;
  const started = new Promise((resolve) => {
    begin = resolve;
  });
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const base = await start({
    maxRequests: 1,
    readCatalog: async () => {
      begin();
      await gate;
      return [{ youtubeId: id, published: true }];
    },
  });
  const first = fetch(`${base}/api/yt/${id}`);
  await started;
  const busy = await Promise.race([
    fetch(`${base}/api/yt/${id}`),
    new Promise((resolve) => setTimeout(() => resolve({ status: 0 }), 100)),
  ]);
  const healthy = await fetch(`${base}/health`);
  finish();
  assert.equal(busy.status, 503);
  assert.equal(healthy.status, 200);
  assert.equal((await first).status, 200);
});
