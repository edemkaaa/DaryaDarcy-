// Проверяет HTTP-границы выдачи, публикацию и byte range на управляемых источниках, а не на рабочем каталоге.
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
  // Поднимает loopback HTTP-сервер с коротким синтетическим MP4 и собственной очисткой, не используя рабочие файлы.

  const directory = await mkdtemp(join(tmpdir(), "video-http-test-"));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "fixture.mp4");
  await writeFile(path, Buffer.from("0123456789"));
  const server = createVideoServer({
    catalogUrl: "http://unused.invalid/api/trpc/videos.list",
    readCatalog: async () => /* Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи. */ [{ youtubeId: id, published: true }],
    cache: { acquire: async () => /* Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки. */ ({ path, release() {
      // Завершает подставную аренду без реальных внешних ресурсов.
} }) },
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

// Сценарий: Полная выдача содержит точные длину, MP4-тип и Range-заголовки.
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
// Сценарий: GET, HEAD, Range и обложка дважды проверяют компактную authority без чтения каталога.
test("uses compact authority twice for GET HEAD Range and thumbnails without reading the catalog", async () => {
  let checks = 0;
  const base = await start({
    readCatalog: async () => {
      // Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи.
 throw new Error("whole catalog must not be requested"); },
    readPublication: async requested => {
      // Подставляет компактное решение и считает обращения; проверки должны выполняться до и после чтения.
 assert.equal(requested, id); checks++; return true; },
    readThumbnail: async () => /* Предоставляет тестовые JPEG-байты либо запрещает чтение закрытой обложки. */ Buffer.from([0xff, 0xd8, 0xff]),
  });
  for (const [path, options, status] of [
    [`/api/yt/${id}`, {}, 200], [`/api/yt/${id}`, { method: "HEAD" }, 200],
    [`/api/yt/${id}`, { headers: { range: "bytes=0-3" } }, 206],
    [`/media/yt-thumb/${id}/hqdefault.jpg`, {}, 200],
  ]) {
    const response = await fetch(base + path, options); assert.equal(response.status, status); await response.arrayBuffer();
  }
  assert.equal(checks, 8);
});
// Сценарий: Снятие публикации во время подготовки запрещает выдачу байтов.
test("rechecks compact authority after preparation and never returns unpublished bytes", async () => {
  let published = true;
  const base = await start({
    readPublication: async () => /* Подставляет компактное решение и считает обращения; проверки должны выполняться до и после чтения. */ published,
    makeCache: path => /* Создаёт cache-двойник вокруг точного тестового пути для изменения публикации во время подготовки. */ ({ acquire: async () => {
      // Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки.
 published = false; return { path, release() {
      // Завершает подставную аренду без реальных внешних ресурсов.
} }; } }),
  });
  assert.equal((await fetch(`${base}/api/yt/${id}`)).status, 404);
});
// Сценарий: Явно клубная authority запрещает все виды чтения до подготовки.
test("rejects explicit club authority for GET HEAD Range and thumbnail before preparation", async () => {
  const base = await start({
    readCatalog: async () => /* Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи. */ [
      { youtubeId: id, published: true, access: "club" },
    ],
    cache: {
      acquire: async () => {
        // Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки.

        throw Error("club preparation reached");
      },
    },
    readThumbnail: async () => {
      // Предоставляет тестовые JPEG-байты либо запрещает чтение закрытой обложки.

      throw Error("club thumbnail reached");
    },
  });
  for (const [path, options] of [
    [`/api/yt/${id}`, {}],
    [`/api/yt/${id}`, { method: "HEAD" }],
    [`/api/yt/${id}`, { headers: { Range: "bytes=0-3" } }],
    [`/media/yt-thumb/${id}/hqdefault.jpg`, {}],
  ])
    assert.equal((await fetch(base + path, options)).status, 404);
});

// Сценарий: Обычный Range обеспечивает перемотку с точными байтами.
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

// Сценарий: Suffix и открытый конец ограничиваются размером файла.
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

// Сценарий: Некорректные, пустые и multipart-диапазоны получают 416.
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

// Сценарий: HEAD возвращает заголовки без тела.
test("HEAD reports video headers without a body", async () => {
  const base = await start();
  const response = await fetch(`${base}/api/yt/${id}`, { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), "10");
  assert.equal(await response.text(), "");
});

// Сценарий: Снятая публикация запрещает даже уже закешированный ролик и обложку.
test("unpublishing denies cached playback before preparing or reading media", async () => {
  let published = true;
  const base = await start({
    readCatalog: async () => /* Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи. */ [{ youtubeId: id, published }],
    makeCache: (path) => /* Создаёт cache-двойник вокруг точного тестового пути для изменения публикации во время подготовки. */ ({
      acquire: async () => {
        // Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки.

        if (!published)
          throw new Error("unpublished media must not be accessed");
        return { path, release() {
          // Завершает подставную аренду без реальных внешних ресурсов.
} };
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

// Сценарий: Неизвестный ID не запускает произвольное скачивание YouTube.
test("unknown IDs cannot turn the worker into an arbitrary YouTube downloader", async () => {
  const base = await start({
    cache: {
      acquire: async () => {
        // Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки.

        throw new Error("must not download");
      },
    },
  });
  assert.equal((await fetch(`${base}/api/yt/abcdefghijk`)).status, 404);
});

// Сценарий: Ошибка каталога возвращает общий 502 без внутренних подробностей.
test("catalog failures fail closed with generic errors", async () => {
  const base = await start({
    readCatalog: async () => {
      // Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи.

      throw new Error("private details and credentials");
    },
  });
  const response = await fetch(`${base}/api/yt/${id}`);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "video unavailable" });
});

// Сценарий: После долгой подготовки публикация проверяется снова.
test("rechecks publication after long preparation", async () => {
  let published = true;
  const base = await start({
    readCatalog: async () => /* Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи. */ [{ youtubeId: id, published }],
    cache: {
      acquire: async () => {
        // Имитирует файловую аренду либо запрещает её достижение, чтобы проверить порядок отказов до подготовки.

        published = false;
        return { path: "/absent", release() {
          // Завершает подставную аренду без реальных внешних ресурсов.
} };
      },
    },
  });
  assert.equal((await fetch(`${base}/api/yt/${id}`)).status, 404);
});

// Сценарий: Пути, query URL и изменяющие методы отклоняются.
test("rejects malformed IDs, URL input and mutating methods", async () => {
  const base = await start({
    readCatalog: async () => {
      // Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи.

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

// Сценарий: Health проверяет процесс независимо от интернета.
test("health does not depend on internet or the catalog", async () => {
  const base = await start({
    readCatalog: async () => {
      // Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи.

      throw new Error("offline");
    },
  });
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

// Сценарий: Опубликованная обложка возвращает проверенные JPEG-байты.
test("serves the existing published thumbnail route with JPEG bytes", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  const base = await start({ readThumbnail: async () => /* Предоставляет тестовые JPEG-байты либо запрещает чтение закрытой обложки. */ jpeg });
  const response = await fetch(`${base}/media/yt-thumb/${id}/hqdefault.jpg`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
});

// Сценарий: Тёплая обложка немедленно закрывается после снятия публикации.
test("a cached thumbnail is denied immediately after unpublishing", async () => {
  let published = true;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const base = await start({
    readCatalog: async () => /* Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи. */ [{ youtubeId: id, published }],
    readThumbnail: createThumbnailReader({ load: async () => /* Возвращает синтетическую обложку, позволяя проверить, что её тёплый кеш не обходит снятие публикации. */ jpeg }),
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

// Сценарий: Лимит HTTP-работы возвращает 503, сохраняя доступность health.
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
      // Подставляет разрешающий, закрытый, изменившийся или недоступный каталог для конкретной границы выдачи.

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
