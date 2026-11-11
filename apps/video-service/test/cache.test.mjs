// Проверяет объединение подготовки, отмену зрителей и вытеснение только свободных временных файлов; использует собственные каталоги и управляемое время.
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  access,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVideoCache } from "../cache.mjs";

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const id = "sq7pY1H_fYU";
const otherId = "abcdefghijk";
const exists = async (path) =>
  /* Проверяет наблюдаемое существование файла, чтобы асинхронную очистку не путать с моментом срабатывания таймера. */ access(path).then(
    () => true,
    () => false,
  );
const rejectionWithin = (promise, milliseconds = 100) =>
  /* Отличает своевременную отмену от зависшего ожидания, не оставляя тест бесконечно заблокированным. */ Promise.race([
    promise.then(
      () => ({ name: "UnexpectedSuccess" }),
      (error) => error,
    ),
    new Promise((resolve) =>
      setTimeout(() => resolve({ name: "StillPending" }), milliseconds),
    ),
  ]);

async function cacheWith(options = {}) {
  // Создаёт собственный каталог и cache с подставной подготовкой, регистрируя освобождение обоих после теста.

  const root = await mkdtemp(join(tmpdir(), "video-cache-test-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const cache = await createVideoCache({
    root,
    prepare: async (_id, directory) =>
      /* Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube. */ writeFile(join(directory, "video.mp4"), "01234567"),
    ...options,
  });
  cleanups.push(() => cache.close());
  return { cache, root };
}

// Сценарий: Готовый файл повторно используется без новой подготовки.
test("caches a completed preparation and reuses its file", async () => {
  let preparations = 0;
  const { cache } = await cacheWith({
    prepare: async (_id, directory) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      preparations++;
      await writeFile(join(directory, "video.mp4"), "01234567");
    },
  });
  const first = await cache.acquire(id);
  assert.ok(first);
  assert.equal(await readFile(first.path, "utf8"), "01234567");
  first.release();
  const second = await cache.acquire(id);
  assert.ok(second);
  assert.equal(second.path, first.path);
  assert.equal(preparations, 1);
  second.release();
});

// Сценарий: Зрители одного ID разделяют подготовку, другой ID получает занятость.
test("coalesces requests for the same video but refuses another preparation", async () => {
  let begin;
  let finish;
  const started = new Promise((resolve) => {
    begin = resolve;
  });
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  let preparations = 0;
  const { cache } = await cacheWith({
    prepare: async (_id, directory) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      preparations++;
      begin();
      await gate;
      await writeFile(join(directory, "video.mp4"), "01234567");
    },
  });
  const one = cache.acquire(id);
  const two = cache.acquire(id);
  assert.equal(
    await Promise.race([started.then(() => true), one.then(() => false)]),
    true,
  );
  await assert.rejects(cache.acquire(otherId), { code: "BUSY" });
  finish();
  const [first, second] = await Promise.all([one, two]);
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.path, second.path);
  assert.equal(preparations, 1);
  first.release();
  second.release();
});

// Сценарий: Ошибка убирает частичные файлы и допускает следующий явный запрос.
test("failed preparation deletes partial files and can be retried", async () => {
  let fail = true;
  const { cache, root } = await cacheWith({
    prepare: async (_id, directory) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      await writeFile(join(directory, "source.part"), "partial");
      if (fail) throw new Error("upstream failed");
      await writeFile(join(directory, "video.mp4"), "01234567");
    },
  });
  await assert.rejects(cache.acquire(id), /upstream failed/);
  assert.deepEqual(await readdir(root), []);
  fail = false;
  const lease = await cache.acquire(id);
  assert.ok(lease);
  assert.equal(await readFile(lease.path, "utf8"), "01234567");
  lease.release();
});

// Сценарий: Бюджет вытесняет только свободные файлы.
test("evicts idle files to respect its byte budget", async () => {
  const { cache } = await cacheWith({ maxBytes: 8, maxFileBytes: 8 });
  const first = await cache.acquire(id);
  assert.ok(first);
  first.release();
  const second = await cache.acquire(otherId);
  assert.ok(second);
  assert.equal(await exists(first.path), false);
  assert.equal(await exists(second.path), true);
  second.release();
});

// Сценарий: Читаемый файл не вытесняется новой подготовкой.
test("does not evict a file being streamed", async () => {
  const { cache } = await cacheWith({ maxBytes: 8, maxFileBytes: 8 });
  const first = await cache.acquire(id);
  assert.ok(first);
  await assert.rejects(cache.acquire(otherId), { code: "BUSY" });
  assert.equal(await exists(first.path), true);
  first.release();
  const second = await cache.acquire(otherId);
  assert.ok(second);
  second.release();
});

// Сценарий: Истёкший TTL создаёт новый файл вместо бесконечной выдачи старого.
test("expired files are replaced rather than served indefinitely", async () => {
  let now = 100;
  const { cache } = await cacheWith({ ttlMs: 10, now: () => /* Управляет временем TTL детерминированно, не ожидая настоящего срока жизни кеша. */ now });
  const first = await cache.acquire(id);
  assert.ok(first);
  first.release();
  now = 111;
  const second = await cache.acquire(id);
  assert.ok(second);
  assert.notEqual(first.path, second.path);
  assert.equal(await exists(first.path), false);
  second.release();
});

// Сценарий: Слишком большой результат не принимается в кеш.
test("oversized output is not cached", async () => {
  const { cache, root } = await cacheWith({ maxFileBytes: 7 });
  await assert.rejects(cache.acquire(id), /invalid prepared video/);
  assert.deepEqual(await readdir(root), []);
});

// Сценарий: Путь вместо ID отвергается до работы с диском.
test("rejects path-like IDs before touching disk", async () => {
  const { cache, root } = await cacheWith();
  await assert.rejects(cache.acquire("../outside"), /invalid video id/);
  assert.deepEqual(await readdir(root), []);
});

// Сценарий: Symlink не даёт выдать файл за пределами кеша.
test("rejects symlink output rather than serving files outside its cache", async () => {
  const { cache, root } = await cacheWith({
    prepare: async (_id, directory) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      await symlink("/etc/hosts", join(directory, "video.mp4"));
    },
  });
  await assert.rejects(cache.acquire(id), /invalid prepared video/);
  assert.deepEqual(await readdir(root), []);
});

// Сценарий: Уход одного зрителя не прерывает подготовку оставшемуся.
test("one disconnected viewer does not cancel another viewer's preparation", async () => {
  let begin;
  let finish;
  const started = new Promise((resolve) => {
    begin = resolve;
  });
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const { cache } = await cacheWith({
    prepare: async (_id, directory, signal) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      begin();
      await gate;
      signal.throwIfAborted();
      await writeFile(join(directory, "video.mp4"), "01234567");
    },
  });
  const controller = new AbortController();
  const abandoned = cache.acquire(id, controller.signal);
  const surviving = cache.acquire(id);
  await started;
  controller.abort();
  const failure = await rejectionWithin(abandoned);
  finish();
  const lease = await surviving;
  assert.ok(lease);
  assert.equal(await readFile(lease.path, "utf8"), "01234567");
  lease.release();
  assert.equal(failure.name, "AbortError");
});

// Сценарий: Уход последнего зрителя отменяет работу и убирает частичный результат.
test("the last disconnected viewer cancels preparation and cleans partial output", async () => {
  let begin;
  const started = new Promise((resolve) => {
    begin = resolve;
  });
  const { cache, root } = await cacheWith({
    prepare: async (_id, directory, signal) => {
      // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

      await writeFile(join(directory, "source.part"), "partial");
      begin();
      await new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    },
  });
  const controller = new AbortController();
  const abandoned = cache.acquire(id, controller.signal);
  await started;
  controller.abort();
  const failure = await rejectionWithin(abandoned);
  await cache.close();
  assert.deepEqual(await readdir(root), []);
  assert.equal(failure.name, "AbortError");
});

// Сценарий: Deadline подготовки отменяет работу и удаляет временные файлы.
test(
  "preparation timeout cancels work and removes partial output",
  { timeout: 5000 },
  async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    let begin;
    const started = new Promise((resolve) => {
      begin = resolve;
    });
    let preparationSignal;
    const { cache, root } = await cacheWith({
      prepareTimeoutMs: 25,
      prepare: async (_id, directory, signal) => {
        // Подставляет запись тестового результата, задержку, частичный файл или отказ согласно сценарию без скачивания YouTube.

        await writeFile(join(directory, "source.part"), "partial");
        signal.throwIfAborted();
        preparationSignal = signal;
        begin();
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    });
    const result = cache.acquire(id).catch((error) => error);
    await started;
    context.mock.timers.tick(24);
    assert.equal(preparationSignal.aborted, false);
    assert.equal((await readdir(root)).length, 1);
    context.mock.timers.tick(1);
    assert.equal(preparationSignal.aborted, true);
    assert.equal(preparationSignal.reason.name, "TimeoutError");
    const failure = await result;
    await cache.close();
    assert.deepEqual(await readdir(root), []);
    assert.equal(failure.name, "TimeoutError");
  },
);

// Сценарий: Sweeper удаляет просроченный файл без следующего просмотра.
test(
  "idle TTL cleanup removes expired files without a new playback request",
  { timeout: 5000 },
  async (context) => {
    context.mock.timers.enable({ apis: ["setInterval", "Date"], now: 1000 });
    const { cache } = await cacheWith({ ttlMs: 20 });
    const lease = await cache.acquire(id);
    assert.ok(lease);
    lease.release();
    context.mock.timers.tick(19);
    assert.equal(await exists(lease.path), true);
    context.mock.timers.tick(1);
    // The clock fires the sweeper, but filesystem removal is genuinely async.
    // Wait for its observable completion, not an assumed machine speed.
    const deadline = performance.now() + 4000;
    while (await exists(lease.path)) {
      assert.ok(performance.now() < deadline, "idle file was not removed");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(await exists(lease.path), false);
  },
);
